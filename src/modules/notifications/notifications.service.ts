import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { Notification } from './entities/notification.entity';
import { UserFcmToken } from './entities/user-fcm-token.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private fcmEnabled = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(UserFcmToken)
    private readonly fcmTokenRepo: Repository<UserFcmToken>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.initializeFirebaseAdmin();
  }

  private initializeFirebaseAdmin() {
    try {
      if (getApps().length > 0) {
        this.fcmEnabled = true;
        this.logger.log('Firebase Admin already initialized.');
        return;
      }

      const credsJson = this.configService.get<string>('FIREBASE_CREDENTIALS_JSON');
      const credsPath = this.configService.get<string>('FIREBASE_CREDENTIALS_PATH');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      let credential: ServiceAccount | undefined;

      if (credsJson) {
        try {
          credential = JSON.parse(credsJson);
          this.logger.log('Loading Firebase credentials from JSON environment variable.');
        } catch (e) {
          this.logger.error('Failed to parse FIREBASE_CREDENTIALS_JSON', e);
        }
      }

      if (!credential && projectId && clientEmail && privateKey) {
        credential = {
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        };
        this.logger.log('Loading Firebase credentials from individual environment variables.');
      }

      if (!credential && credsPath) {
        try {
          const fs = require('fs');
          const path = require('path');
          const resolvedPath = path.isAbsolute(credsPath)
            ? credsPath
            : path.join(process.cwd(), credsPath);

          if (fs.existsSync(resolvedPath)) {
            credential = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
            this.logger.log(`Loading Firebase credentials from file: ${resolvedPath}`);
          } else {
            this.logger.warn(`Firebase credential file not found at path: ${resolvedPath}`);
          }
        } catch (e) {
          this.logger.error('Failed to load FIREBASE_CREDENTIALS_PATH', e);
        }
      }

      if (credential) {
        initializeApp({
          credential: cert(credential),
        });
        this.fcmEnabled = true;
        this.logger.log('Firebase Admin initialized successfully.');
      } else {
        this.logger.warn('Firebase credentials not configured. FCM push notifications will be disabled.');
      }
    } catch (error) {
      this.logger.error('Error during Firebase Admin initialization:', error);
    }
  }

  async registerToken(userId: string, token: string, deviceType?: string): Promise<UserFcmToken> {
    // Delete this token from any other users to avoid duplicate device delivery
    await this.fcmTokenRepo.delete({ token });

    try {
      let userFcmToken = await this.fcmTokenRepo.findOne({ where: { userId, token } });
      if (!userFcmToken) {
        userFcmToken = this.fcmTokenRepo.create({
          userId,
          token,
          deviceType,
        });
        await this.fcmTokenRepo.save(userFcmToken);
        this.logger.log(`Registered new FCM token for user ${userId}`);
      } else if (deviceType && userFcmToken.deviceType !== deviceType) {
        userFcmToken.deviceType = deviceType;
        await this.fcmTokenRepo.save(userFcmToken);
      }
      return userFcmToken;
    } catch (error: any) {
      if (error.code === '23505') {
        this.logger.warn(`FCM token registration race condition handled for user ${userId}`);
        const existingToken = await this.fcmTokenRepo.findOne({ where: { userId, token } });
        if (existingToken) {
          return existingToken;
        }
      }
      throw error;
    }
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.fcmTokenRepo.delete({ userId, token });
    this.logger.log(`Removed FCM token for user ${userId}`);
  }

  async getNotifications(
    userId: string,
    pageNum: number = 1,
    limitNum: number = 10,
  ): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found.`);
    }
    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async sendNotificationToUser(
    userId: string,
    payload: { title: string; content: string; type?: string; metadata?: any },
  ): Promise<Notification> {
    // 1. Save notification to database
    const notification = this.notificationRepo.create({
      userId,
      title: payload.title,
      content: payload.content,
      type: payload.type || 'info',
      metadata: payload.metadata || null,
    });
    const savedNotification = await this.notificationRepo.save(notification);


    // 3. Deliver via FCM push notification if enabled
    if (this.fcmEnabled) {
      try {
        const userTokens = await this.fcmTokenRepo.find({ where: { userId } });
        const tokens = userTokens.map((t) => t.token);

        if (tokens.length > 0) {
          const message: MulticastMessage = {
            tokens,
            notification: {
              title: payload.title,
              body: payload.content,
            },
            data: payload.metadata ? this.serializeMetadata(payload.metadata) : undefined,
          };

          const response = await getMessaging().sendEachForMulticast(message);
          
          const tokensToRemove: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              if (
                errCode === 'messaging/registration-token-not-registered' ||
                errCode === 'messaging/invalid-registration-token'
              ) {
                tokensToRemove.push(tokens[idx]);
              } else {
                this.logger.warn(`FCM send error for token index ${idx}: ${resp.error?.message}`);
              }
            }
          });

          if (tokensToRemove.length > 0) {
            await this.fcmTokenRepo.delete({ token: In(tokensToRemove) });
            this.logger.log(`Cleaned up ${tokensToRemove.length} inactive FCM tokens.`);
          }
        }
      } catch (fcmError) {
        this.logger.error(`Failed to send FCM push notifications: ${fcmError.message}`);
      }
    }

    return savedNotification;
  }

  private serializeMetadata(metadata: any): Record<string, string> {
    const serialized: Record<string, string> = {};
    if (typeof metadata !== 'object' || metadata === null) {
      return { data: String(metadata) };
    }
    for (const key of Object.keys(metadata)) {
      const val = metadata[key];
      serialized[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
    return serialized;
  }
}

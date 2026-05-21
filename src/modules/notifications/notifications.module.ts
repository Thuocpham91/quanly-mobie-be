import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SECRETKEY') || 'defaultSecret',
      }),
    }),
  ],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('NotificationsGateway');
  private connectedUsers: Map<string, string> = new Map(); // socketId -> userId

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('Notifications Socket Initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers['authorization'];
      
      if (!token) {
        this.logger.warn(`Client disconnected (No token): ${client.id}`);
        client.disconnect();
        return;
      }

      // Extract token if it's in 'Bearer <token>' format
      const extractedToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

      const payload = this.jwtService.verify(extractedToken);
      const userId = payload.sub; // Or payload.id depending on your token structure
      
      this.connectedUsers.set(client.id, userId);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
      
      // Send a welcome test notification
      client.emit('notification', {
        type: 'success',
        message: 'Socket connected successfully!',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Client disconnected (Invalid token): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
  }

  // Example method to send notification to a specific user
  sendNotificationToUser(userId: string, notification: any) {
    for (const [socketId, connectedUserId] of this.connectedUsers.entries()) {
      if (connectedUserId === userId) {
        this.server.to(socketId).emit('notification', notification);
      }
    }
  }

  // Example method to send notification to all users
  broadcastNotification(notification: any) {
    this.server.emit('notification', notification);
  }
}

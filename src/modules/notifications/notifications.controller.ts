import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterFcmTokenDto, SendNotificationTestDto } from './dto/notifications.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('fcm-token')
  @HttpCode(HttpStatus.OK)
  async registerToken(@Request() req, @Body() registerFcmTokenDto: RegisterFcmTokenDto) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.notificationsService.registerToken(
      userId,
      registerFcmTokenDto.token,
      registerFcmTokenDto.deviceType,
    );
  }

  @Delete('fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeToken(@Request() req, @Body() registerFcmTokenDto: RegisterFcmTokenDto) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    await this.notificationsService.removeToken(userId, registerFcmTokenDto.token);
  }

  @Get()
  async getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return this.notificationsService.getNotifications(userId, pageNum, limitNum);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Request() req) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('send-test')
  async sendTestNotification(@Body() sendNotificationTestDto: SendNotificationTestDto) {
    return this.notificationsService.sendNotificationToUser(sendNotificationTestDto.userId, {
      title: sendNotificationTestDto.title,
      content: sendNotificationTestDto.content,
      type: sendNotificationTestDto.type,
      metadata: sendNotificationTestDto.metadata,
    });
  }
}

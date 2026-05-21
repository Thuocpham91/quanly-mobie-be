import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly mailerService: MailerService) {}

  async sendAddPointConfirmation(
    to: string,
    email: string,
    code: string,
    point: number,
  ): Promise<void> {
    this.logger.log(`Sending confirm add point mail to ${to}`);
    await this.mailerService.sendMail({
      to,
      subject: 'Xác nhận cộng điểm',
      template: 'confirm-add-point',
      context: { to, email, code, point },
    });
  }

  async sendCheckoutConfirmation(
    to: string,
    orderCode: string,
    code: string,
    amount: number,
  ): Promise<void> {
    try {
      this.logger.log(`Sending confirm checkout mail to ${to}`);

      const result = await this.mailerService.sendMail({
        to,
        subject: 'Xác nhận thanh toán đơn hàng',
        template: 'confirm-checkout-order',
        context: { to, orderCode, code, amount },
      });

      console.log('MAIL SENT SUCCESS:', result);
    } catch (error) {
      console.error('MAIL SEND ERROR:', error);
    }
  }

  async sendPaymentSuccess(
    to: string,
    orderCode: string,
    amount: number,
    paymentDate: string,
  ): Promise<void> {
    this.logger.log(`Sending payment success mail to ${to}`);
    await this.mailerService.sendMail({
      to,
      subject: 'Thanh toán thành công',
      template: 'payment-success',
      context: { to, orderCode, amount, paymentDate },
    });
  }

  async sendAdminReceivePoint(
    to: string,
    customerEmail: string,
    orderCode: string,
    amount: number,
    paymentDate: string,
  ) {
    this.logger.log(`Sending admin add point mail to ${to}`);
    await this.mailerService.sendMail({
      to,
      subject: `Cộng điểm từ đơn hàng #${orderCode}`,
      template: 'payment-admin-receive-point',
      context: { customerEmail, orderCode, amount, paymentDate },
    });
  }

  async sendAdminCredentials(
    to: string,
    credentials: { email: string; password: string; loginUrl: string },
  ): Promise<void> {
    this.logger.log(`Sending admin credentials mail to ${to}`);
    await this.mailerService.sendMail({
      to,
      subject: 'Thông tin tài khoản của bạn',
      template: 'admin-credentials',
      context: credentials,
    });
  }
}

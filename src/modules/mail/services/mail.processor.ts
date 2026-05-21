import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { MailService } from "./mail.service";
import { MailJob, QueueName } from "./mail.constants";

@Processor(QueueName.MAIL)
export class MailProcessor {
  constructor(private readonly mailService: MailService) {}

  @Process(MailJob.CONFIRM_ADD_POINT)
  async handleSendConfirmAddPoint(job: Job<{ to: string; email: string; code: string; point: number }>) {
    const { to, email, code, point } = job.data;
    await this.mailService.sendAddPointConfirmation(to, email, code, point);
  }

  @Process(MailJob.CONFIRM_CHECKOUT_ORDER)
  async handleSendConfirmCheckout(job: Job<{ to: string; orderCode: string; code: string; amount: number }>) {
     console.log('MAIL PROCESSOR RUNNING', job.data);
    const { to, orderCode, code, amount } = job.data;
    await this.mailService.sendCheckoutConfirmation(to, orderCode, code, amount);
  }

  @Process(MailJob.PAYMENT_SUCCESS)
  async handlePaymentSuccess(job: Job<{ to: string; orderCode: string; amount: number; paymentDate: string }>) {
    const { to, orderCode, amount, paymentDate } = job.data;
    await this.mailService.sendPaymentSuccess(to, orderCode, amount, paymentDate);
  }

  @Process(MailJob.ADMIN_RECEIVE_POINT)
  async handleAdminReceivePoint(
    job: Job<{ to: string; customerEmail: string; orderCode: string; amount: number; paymentDate: string }>,
  ) {
    const { to, customerEmail, orderCode, amount, paymentDate } = job.data;
    await this.mailService.sendAdminReceivePoint(to, customerEmail, orderCode, amount, paymentDate);
  }
}

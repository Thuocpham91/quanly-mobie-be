import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './services/mail.service';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { MailProcessor } from './services/mail.processor';

@Module({
    imports: [
        ConfigModule,
        MailerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                transport: {
                    host: config.get<string>('MAIL_HOST'),
                    port: config.get<number>('MAIL_PORT'),
                    secure: config.get<string>('MAIL_SECURE') === 'true',
                    auth: {
                        user: config.get<string>('MAIL_USER'),
                        pass: config.get<string>('MAIL_PASS'),
                    },
                },
                defaults: {
                    from: `"${config.get('MAIL_FROM_NAME')}" <${config.get('MAIL_FROM')}>`,
                },
                template: {
                    dir: join(__dirname, '..', 'templates', 'vi'),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                }
            }),
        }),

    ],
    providers: [MailService, MailProcessor],
    exports: [MailService],
})
export class MailModule { }

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const corsOriginsEnv = process.env.CORS_ORIGINS;
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (!corsOriginsEnv || corsOriginsEnv.trim() === '*') {
        return callback(null, true);
      }

      const allowedOrigins = corsOriginsEnv
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);

      const cleanOrigin = origin.replace(/\/$/, '');

      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      if (process.env.FRONTEND_URL && cleanOrigin === process.env.FRONTEND_URL.replace(/\/$/, '')) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-branch-id',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'uploads/(.*)', method: RequestMethod.ALL },
    ],
  });

  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    index: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        console.error('--- VALIDATION ERROR ---');
        errors.forEach((err) => {
          console.error(`Property: ${err.property}`);
          console.error(`Constraints:`, err.constraints);
        });
        console.error('------------------------');
        const messages = errors
          .map((error) => Object.values(error.constraints || {}))
          .flat();
        return new BadRequestException(messages);
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

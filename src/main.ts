import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true });
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  let corsOrigins: boolean | string | string[] = true;
  if (corsOriginsEnv) {
    if (corsOriginsEnv.trim() === '*') {
      corsOrigins = '*';
    } else {
      corsOrigins = corsOriginsEnv.split(',').map((origin) => origin.trim());
    }
  }

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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

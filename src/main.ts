import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN')?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  // API prefix
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Swagger documentation
  if (configService.get('SWAGGER_ENABLED') === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Fireflies.ai Clone API')
      .setDescription('AI-powered meeting assistant API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('meetings', 'Meeting management')
      .addTag('transcripts', 'Meeting transcripts')
      .addTag('analytics', 'Meeting analytics')
      .addTag('search', 'Search functionality')
      .addTag('integrations', 'External integrations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = configService.get('SWAGGER_PATH') || '/api/docs';
    SwaggerModule.setup(swaggerPath, app, document);

    logger.log(`Swagger documentation available at: ${swaggerPath}`);
  }

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3001,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  helmetEnabled: process.env.HELMET_ENABLED === 'true',
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  swaggerPath: process.env.SWAGGER_PATH || '/api/docs',
  logLevel: process.env.LOG_LEVEL || 'info',
  logFileEnabled: process.env.LOG_FILE_ENABLED === 'true',
}));

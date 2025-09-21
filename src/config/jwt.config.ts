// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-default-secret-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));

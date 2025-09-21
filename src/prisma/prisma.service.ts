// src/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const logLevel =
      configService.get('LOG_LEVEL') === 'debug'
        ? ['query', 'info', 'warn', 'error']
        : ['info', 'warn', 'error'];

    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log: logLevel as any,
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const modelNames = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    ) as string[];

    return Promise.all(
      modelNames.map((modelName) => (this as any)[modelName].deleteMany()),
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}

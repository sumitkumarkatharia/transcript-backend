// src/integrations/integrations.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationType } from '@prisma/client';

export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  config: any;
  credentials: any;
  organizationId: string;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService) {}

  async createIntegration(integrationConfig: IntegrationConfig): Promise<any> {
    try {
      // Encrypt credentials before storing (in production, use proper encryption)
      const encryptedCredentials = this.encryptCredentials(
        integrationConfig.credentials,
      );

      const integration = await this.prisma.integration.create({
        data: {
          type: integrationConfig.type,
          name: integrationConfig.name,
          config: integrationConfig.config,
          credentials: encryptedCredentials,
          organizationId: integrationConfig.organizationId,
          isActive: true,
        },
      });

      this.logger.log(
        `Integration created: ${integrationConfig.type} for org ${integrationConfig.organizationId}`,
      );
      return integration;
    } catch (error) {
      this.logger.error('Failed to create integration', error);
      throw new BadRequestException('Failed to create integration');
    }
  }

  async getIntegrations(organizationId: string): Promise<any[]> {
    return this.prisma.integration.findMany({
      where: { organizationId },
      select: {
        id: true,
        type: true,
        name: true,
        config: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't return credentials for security
      },
    });
  }

  async updateIntegration(
    integrationId: string,
    updates: Partial<IntegrationConfig>,
  ): Promise<any> {
    const updateData: any = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.config) updateData.config = updates.config;
    if (updates.credentials)
      updateData.credentials = this.encryptCredentials(updates.credentials);

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: updateData,
    });
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    await this.prisma.integration.delete({
      where: { id: integrationId },
    });
  }

  async toggleIntegration(
    integrationId: string,
    isActive: boolean,
  ): Promise<any> {
    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { isActive },
    });
  }

  async getIntegrationCredentials(integrationId: string): Promise<any> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { credentials: true },
    });

    if (!integration) {
      throw new BadRequestException('Integration not found');
    }

    return this.decryptCredentials(integration.credentials);
  }

  private encryptCredentials(credentials: any): any {
    // In production, use proper encryption (AES-256, etc.)
    // For demo purposes, we'll just base64 encode
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  private decryptCredentials(encryptedCredentials: any): any {
    // In production, decrypt properly
    // For demo purposes, decode base64
    try {
      return JSON.parse(Buffer.from(encryptedCredentials, 'base64').toString());
    } catch (error) {
      this.logger.error('Failed to decrypt credentials', error);
      return {};
    }
  }
}

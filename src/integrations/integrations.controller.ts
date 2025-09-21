// src/integrations/integrations.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { IntegrationsService } from './integrations.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  createIntegration(
    @Body() createIntegrationDto: CreateIntegrationDto,
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.createIntegration({
      ...createIntegrationDto,
      organizationId: user.organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all integrations for organization' })
  @ApiResponse({
    status: 200,
    description: 'Integrations retrieved successfully',
  })
  getIntegrations(@CurrentUser() user: any) {
    return this.integrationsService.getIntegrations(user.organizationId);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update integration' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  updateIntegration(
    @Param('id') id: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.updateIntegration(id, updateIntegrationDto);
  }

  @Put(':id/toggle')
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Toggle integration active status' })
  @ApiResponse({ status: 200, description: 'Integration status updated' })
  toggleIntegration(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.integrationsService.toggleIntegration(id, body.isActive);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete integration' })
  @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
  deleteIntegration(@Param('id') id: string) {
    return this.integrationsService.deleteIntegration(id);
  }
}

// src/integrations/dto/integration.dto.ts
import { IsString, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IntegrationType } from '@prisma/client';

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiProperty({ example: 'Google Calendar Integration' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Integration configuration object' })
  @IsObject()
  config: any;

  @ApiProperty({ description: 'Integration credentials object' })
  @IsObject()
  credentials: any;
}

export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {}

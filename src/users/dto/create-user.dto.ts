// src/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  // Remove password from update DTO - use separate change password endpoint
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailSummaries?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  slackNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  realTimeAlerts?: boolean;

  @ApiPropertyOptional({ enum: ['concise', 'detailed', 'executive'] })
  @IsOptional()
  @IsString()
  summaryStyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoTranscription?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  calendarSync?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  crmSync?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  dataRetentionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shareAnalytics?: boolean;
}

// src/meetings/dto/meeting.dto.ts
// src/meetings/dto/meeting.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateMeetingDto {
  @ApiProperty({ example: 'Team Standup Meeting' })
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title cannot be empty' })
  @MaxLength(100, { message: 'Title cannot exceed 100 characters' })
  title: string;

  @ApiPropertyOptional({
    example: 'Weekly team sync to discuss progress and blockers',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiProperty({ example: '2025-09-22T15:00:00.000Z' })
  @IsDateString({}, { message: 'Start time must be a valid ISO date string' })
  startTime: string; // ✅ Fixed: Changed from Date to string

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt({ message: 'Duration must be an integer' })
  @Min(15, { message: 'Duration must be at least 15 minutes' })
  @Max(480, { message: 'Duration cannot exceed 8 hours' }) // 8 hours max
  duration?: number; // in minutes

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt({ message: 'Max participants must be an integer' })
  @Min(1, { message: 'Max participants must be at least 1' })
  @Max(500, { message: 'Max participants cannot exceed 500' })
  maxParticipants?: number;

  @ApiProperty({ example: 'cmfsgu96o0000lr5kx6tq77c1' })
  @IsString({ message: 'Organization ID must be a string' })
  @MinLength(1, { message: 'Organization ID cannot be empty' })
  organizationId: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'Auto join bot must be a boolean' })
  autoJoinBot?: boolean;
}

export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {}

export class JoinMeetingDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString({ message: 'Full name must be a string' })
  @MinLength(1, { message: 'Full name cannot be empty' })
  @MaxLength(50, { message: 'Full name cannot exceed 50 characters' })
  fullName: string;
}
export class SimpleMeetingDto {
  @ApiProperty({
    example: 'Team Meeting',
    description: 'Meeting title',
  })
  @IsString({ message: 'Title must be a string' })
  @MinLength(1, { message: 'Title cannot be empty' })
  @MaxLength(100, { message: 'Title cannot exceed 100 characters' })
  title: string;

  @ApiPropertyOptional({
    example: 'Weekly team sync',
    description: 'Optional meeting description',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiProperty({
    example: '2025-09-22T15:00:00.000Z',
    description: 'Meeting start time in ISO format',
  })
  @IsDateString({}, { message: 'Start time must be a valid ISO date string' })
  startTime: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Meeting duration in minutes',
  })
  @IsOptional()
  @IsInt({ message: 'Duration must be an integer' })
  @Min(15, { message: 'Duration must be at least 15 minutes' })
  @Max(480, { message: 'Duration cannot exceed 8 hours' })
  duration?: number;

  @ApiProperty({
    example: 'cmfsgu96o0000lr5kx6tq77c1',
    description: 'Organization ID',
  })
  @IsString({ message: 'Organization ID must be a string' })
  @MinLength(1, { message: 'Organization ID cannot be empty' })
  organizationId: string;
}

// Also create a version with no validation for testing
export class NoValidationMeetingDto {
  title: string;
  description?: string;
  startTime: string;
  duration?: number;
  organizationId: string;
}

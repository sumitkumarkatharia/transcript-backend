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

export class CreateMeetingDto {
  @ApiProperty({ example: 'Team Standup Meeting' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    example: 'Weekly team sync to discuss progress and blockers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  startTime: Date;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480) // 8 hours max
  duration?: number; // in minutes

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxParticipants?: number;

  @ApiProperty()
  @IsString()
  organizationId: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoJoinBot?: boolean;
}

export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {}

export class JoinMeetingDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  fullName: string;
}

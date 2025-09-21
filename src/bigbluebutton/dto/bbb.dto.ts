// src/bigbluebutton/dto/bbb.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUrl,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMeetingDto {
  @ApiProperty({ example: 'Team Standup Meeting' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'meeting-123-456' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  meetingID: string;

  @ApiProperty({ example: 'attendee123' })
  @IsString()
  @MinLength(1)
  attendeePW: string;

  @ApiProperty({ example: 'moderator123' })
  @IsString()
  @MinLength(1)
  moderatorPW: string;

  @ApiPropertyOptional({ example: 'Welcome to our team meeting!' })
  @IsOptional()
  @IsString()
  welcome?: string;

  @ApiPropertyOptional({ example: '70000' })
  @IsOptional()
  @IsString()
  voiceBridge?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  @ApiPropertyOptional({ example: 'https://example.com/logout' })
  @IsOptional()
  @IsUrl()
  logoutURL?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  record?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  duration?: number; // in minutes

  @ApiPropertyOptional({ example: 'Important meeting information' })
  @IsOptional()
  @IsString()
  moderatorOnlyMessage?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoStartRecording?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowStartStopRecording?: boolean;
}

export class JoinMeetingDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  fullName: string;

  @ApiProperty({ example: 'meeting-123-456' })
  @IsString()
  meetingID: string;

  @ApiProperty({ example: 'attendee123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'user-123' })
  @IsOptional()
  @IsString()
  userID?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarURL?: string;
}

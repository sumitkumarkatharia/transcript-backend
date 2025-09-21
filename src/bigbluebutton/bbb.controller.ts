// src/bigbluebutton/bbb.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { BigBlueButtonService } from './bbb.service';
import { CreateMeetingDto, JoinMeetingDto } from './dto/bbb.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('bigbluebutton')
@Controller('bbb')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BigBlueButtonController {
  constructor(private readonly bbbService: BigBlueButtonService) {}

  @Post('meetings')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new BBB meeting' })
  @ApiResponse({ status: 201, description: 'Meeting created successfully' })
  createMeeting(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: any,
  ) {
    console.log('Creating meeting for user:', user.id);
    return this.bbbService.createMeeting(createMeetingDto);
  }

  @Post('meetings/:meetingId/join')
  @ApiOperation({ summary: 'Generate join URL for BBB meeting' })
  @ApiResponse({ status: 200, description: 'Join URL generated successfully' })
  joinMeeting(
    @Param('meetingId') meetingId: string,
    @Body() joinMeetingDto: JoinMeetingDto,
  ) {
    return this.bbbService.joinMeeting({
      ...joinMeetingDto,
      meetingID: meetingId,
    });
  }

  @Get('meetings/:meetingId')
  @ApiOperation({ summary: 'Get BBB meeting information' })
  @ApiResponse({
    status: 200,
    description: 'Meeting info retrieved successfully',
  })
  getMeetingInfo(
    @Param('meetingId') meetingId: string,
    @Query('password') password: string,
  ) {
    return this.bbbService.getMeetingInfo(meetingId, password);
  }

  @Delete('meetings/:meetingId')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'End BBB meeting' })
  @ApiResponse({ status: 200, description: 'Meeting ended successfully' })
  endMeeting(
    @Param('meetingId') meetingId: string,
    @Query('password') password: string,
  ) {
    return this.bbbService.endMeeting(meetingId, password);
  }

  @Get('recordings')
  @ApiOperation({ summary: 'Get BBB recordings' })
  @ApiResponse({
    status: 200,
    description: 'Recordings retrieved successfully',
  })
  getRecordings(@Query('meetingId') meetingId?: string) {
    return this.bbbService.getRecordings(meetingId);
  }

  @Post('recordings/:recordId/publish')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Publish/unpublish BBB recording' })
  @ApiResponse({
    status: 200,
    description: 'Recording publication status updated',
  })
  publishRecording(
    @Param('recordId') recordId: string,
    @Body() body: { publish: boolean },
  ) {
    return this.bbbService.publishRecording(recordId, body.publish);
  }

  @Delete('recordings/:recordId')
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete BBB recording' })
  @ApiResponse({ status: 200, description: 'Recording deleted successfully' })
  deleteRecording(@Param('recordId') recordId: string) {
    return this.bbbService.deleteRecording(recordId);
  }
}

// src/meetings/meetings.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { BigBlueButtonService } from '../bigbluebutton/bbb.service';

import { MeetingsService } from './meetings.service';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  JoinMeetingDto,
} from './dto/meeting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('meetings')
@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly prisma: PrismaService,
    private readonly bbbService: BigBlueButtonService,
  ) {}

  // Test BBB service directly
  @Get('test-bbb-direct')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Test BBB service directly' })
  @ApiResponse({ status: 200, description: 'BBB test results' })
  async testBBBDirect() {
    console.log('=== Testing BBB Service Directly ===');

    try {
      // Test BBB connection first
      const connectionTest = await this.bbbService.testBBBConnection();
      console.log('BBB Connection Test:', connectionTest);

      return {
        success: true,
        connectionTest: connectionTest,
      };
    } catch (error) {
      console.error('BBB Direct Test Error:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  // Create meeting without BBB integration for debugging
  @Post('create-simple-no-bbb')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({
    summary: 'Create meeting without BBB integration for debugging',
  })
  @ApiResponse({ status: 201, description: 'Meeting created successfully' })
  async createSimpleNoBBB(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: any,
  ) {
    console.log('=== Creating Meeting WITHOUT BBB ===');
    console.log('Meeting:', createMeetingDto.title);

    try {
      // Generate meeting details
      const bbbMeetingId = `meeting_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const moderatorPassword = Math.random().toString(36).substr(2, 12);
      const attendeePassword = Math.random().toString(36).substr(2, 12);
      const joinUrl = `${process.env.BBB_API_URL?.replace(
        '/api',
        '',
      )}/join/${bbbMeetingId}`;

      // Create only in database
      const meeting = await this.prisma.meeting.create({
        data: {
          title: createMeetingDto.title.trim(),
          description: createMeetingDto.description?.trim() || null,
          bbbMeetingId,
          bbbMeetingName: createMeetingDto.title.trim(),
          moderatorPassword,
          attendeePassword,
          joinUrl,
          startTime: new Date(createMeetingDto.startTime),
          duration: createMeetingDto.duration || null,
          status: 'SCHEDULED',
          hostId: user.id,
          organizationId: createMeetingDto.organizationId,
          audioFileUrl: null,
          recordingUrl: null,
          botJoined: false,
          botJoinedAt: null,
          botLeftAt: null,
        },
        include: {
          host: { select: { id: true, name: true, email: true, avatar: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      console.log('Meeting created successfully (DB only):', meeting.id);

      return {
        success: true,
        data: meeting,
        message: 'Meeting created successfully (database only)',
        note: 'BBB integration bypassed for debugging',
      };
    } catch (error) {
      console.error('Meeting creation error (DB only):', error);
      throw new BadRequestException(
        `Failed to create meeting: ${error.message}`,
      );
    }
  }

  @Post()
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new meeting with BBB integration' })
  @ApiResponse({ status: 201, description: 'Meeting created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: any,
  ) {
    console.log('=== Creating BBB Meeting ===');
    console.log('User:', user.id, user.email);
    console.log('Meeting:', createMeetingDto.title);

    try {
      // Generate BBB meeting details
      const bbbMeetingId = `meeting_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const moderatorPassword = Math.random().toString(36).substr(2, 12);
      const attendeePassword = Math.random().toString(36).substr(2, 12);

      // Create BBB meeting first with detailed logging
      const bbbMeetingData = {
        name: createMeetingDto.title,
        meetingID: bbbMeetingId,
        attendeePW: attendeePassword,
        moderatorPW: moderatorPassword,
        welcome:
          createMeetingDto.description ||
          `Welcome to ${createMeetingDto.title}!`,
        record: true,
        autoStartRecording: true,
        allowStartStopRecording: true,
        duration: createMeetingDto.duration || 120,
        maxParticipants: createMeetingDto.maxParticipants || 50,
      };

      console.log('BBB Meeting Data:', JSON.stringify(bbbMeetingData, null, 2));
      console.log('BBB API URL:', process.env.BBB_API_URL);
      console.log('BBB Secret Key exists:', !!process.env.BBB_SECRET_KEY);

      let bbbMeeting;
      let joinUrl = `${process.env.BBB_API_URL?.replace(
        '/api',
        '',
      )}/join/${bbbMeetingId}`;

      try {
        console.log('Attempting to create BBB meeting...');
        bbbMeeting = await this.bbbService.createMeeting(bbbMeetingData);
        console.log(
          'BBB Meeting Response:',
          JSON.stringify(bbbMeeting, null, 2),
        );

        if (!bbbMeeting) {
          throw new Error('BBB service returned null/undefined');
        }
      } catch (bbbError) {
        console.error('BBB Creation Error Details:', {
          message: bbbError.message,
          stack: bbbError.stack,
          response: bbbError.response,
        });

        // Continue with database creation even if BBB fails
        console.log('Continuing with database creation despite BBB failure...');
      }

      // Create meeting in database
      console.log('Creating meeting in database...');
      const meeting = await this.prisma.meeting.create({
        data: {
          title: createMeetingDto.title.trim(),
          description: createMeetingDto.description?.trim() || null,
          bbbMeetingId,
          bbbMeetingName: createMeetingDto.title.trim(),
          moderatorPassword,
          attendeePassword,
          joinUrl,
          startTime: new Date(createMeetingDto.startTime),
          duration: createMeetingDto.duration || null,
          status: 'SCHEDULED',
          hostId: user.id,
          organizationId: createMeetingDto.organizationId,
          audioFileUrl: null,
          recordingUrl: null,
          botJoined: false,
          botJoinedAt: null,
          botLeftAt: null,
        },
        include: {
          host: { select: { id: true, name: true, email: true, avatar: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      console.log('Meeting created successfully in database:', meeting.id);

      return {
        success: true,
        data: meeting,
        message: 'Meeting created successfully',
        bbbStatus: bbbMeeting
          ? 'BBB meeting created'
          : 'BBB failed, using database only',
      };
    } catch (error) {
      console.error('Meeting creation error:', error);
      throw new BadRequestException(
        `Failed to create meeting: ${error.message}`,
      );
    }
  }

  @Post('simple')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({
    summary: 'Create a simple meeting with direct BBB integration',
  })
  @ApiResponse({
    status: 201,
    description: 'Simple meeting created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createSimple(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: any,
  ) {
    console.log('=== Creating Simple BBB Meeting ===');
    console.log('Meeting:', createMeetingDto.title);
    console.log('User:', user.id);

    // Use the regular create method for consistency
    return this.create(createMeetingDto, user);
  }

  @Post('simple/:id/join-url')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Generate join URL using BBB service' })
  @ApiResponse({ status: 200, description: 'Join URL generated successfully' })
  async getJoinUrl(
    @Param('id') meetingId: string,
    @Body() joinData: { fullName: string; isModerator?: boolean },
    @CurrentUser() user: any,
  ) {
    console.log('=== Generating Join URL ===');
    console.log('Meeting ID:', meetingId);
    console.log('User:', joinData.fullName);

    try {
      const meeting = await this.meetingsService.findOne(meetingId);

      if (!meeting) {
        throw new BadRequestException('Meeting not found');
      }

      if (meeting.status === 'COMPLETED') {
        throw new BadRequestException('Meeting has already ended');
      }

      // Use correct password based on role
      const password = joinData.isModerator
        ? meeting.moderatorPassword
        : meeting.attendeePassword;

      console.log('BBB Meeting ID:', meeting.bbbMeetingId);

      // Create join DTO for BBB service
      const joinMeetingDto = {
        fullName: joinData.fullName,
        meetingID: meeting.bbbMeetingId,
        password: password,
        userID: user.email,
      };

      // Use BBB service to generate join URL
      const joinUrl = await this.bbbService.joinMeeting(joinMeetingDto);

      console.log('Join URL generated successfully');

      // Record participant
      try {
        await this.meetingsService.addParticipant(
          meetingId,
          user.id,
          joinData.fullName,
        );
      } catch (participantError) {
        console.log(
          'Participant recording failed (non-critical):',
          participantError.message,
        );
      }

      return {
        success: true,
        joinUrl: joinUrl,
        meetingInfo: {
          title: meeting.title,
          bbbMeetingId: meeting.bbbMeetingId,
          status: meeting.status,
          startTime: meeting.startTime,
        },
      };
    } catch (error) {
      console.error('Join URL generation error:', error);
      throw new BadRequestException(
        `Failed to generate join URL: ${error.message}`,
      );
    }
  }

  @Post('simple/:id/start')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Start meeting and update status' })
  @ApiResponse({ status: 200, description: 'Meeting started successfully' })
  async startSimpleMeeting(
    @Param('id') meetingId: string,
    @CurrentUser() user: any,
  ) {
    console.log('=== Starting Simple Meeting ===');
    console.log('Meeting ID:', meetingId);
    console.log('Started by:', user.email);

    try {
      const meeting = await this.meetingsService.startMeeting(meetingId);

      return {
        success: true,
        message: 'Meeting started successfully',
        data: meeting,
      };
    } catch (error) {
      console.error('Meeting start error:', error);
      throw new BadRequestException(
        `Failed to start meeting: ${error.message}`,
      );
    }
  }

  @Post('simple/:id/end')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'End meeting with BBB integration' })
  @ApiResponse({ status: 200, description: 'Meeting ended successfully' })
  async endSimpleMeeting(
    @Param('id') meetingId: string,
    @CurrentUser() user: any,
  ) {
    console.log('=== Ending Simple Meeting ===');
    console.log('Meeting ID:', meetingId);
    console.log('Ended by:', user.email);

    try {
      const meeting = await this.meetingsService.findOne(meetingId);

      if (!meeting) {
        throw new BadRequestException('Meeting not found');
      }

      // End BBB meeting first
      try {
        await this.bbbService.endMeeting(
          meeting.bbbMeetingId,
          meeting.moderatorPassword,
        );
        console.log('BBB meeting ended successfully');
      } catch (bbbError) {
        console.log('BBB meeting end failed (non-critical):', bbbError.message);
      }

      // Update meeting status in database
      const endedMeeting = await this.meetingsService.endMeeting(meetingId);

      return {
        success: true,
        message: 'Meeting ended successfully',
        data: endedMeeting,
      };
    } catch (error) {
      console.error('Meeting end error:', error);
      throw new BadRequestException(`Failed to end meeting: ${error.message}`);
    }
  }

  @Get('test-bbb')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Test BigBlueButton connectivity' })
  @ApiResponse({ status: 200, description: 'BBB connectivity test results' })
  async testBBBConnection() {
    console.log('=== Testing BBB Connection ===');

    try {
      const debugInfo = await this.meetingsService.debugBBBConnection();

      return {
        success: true,
        message: 'BBB connectivity test completed',
        data: debugInfo,
      };
    } catch (error) {
      console.error('BBB connection test error:', error);
      return {
        success: false,
        message: 'BBB connectivity test failed',
        error: error.message,
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all meetings' })
  @ApiResponse({ status: 200, description: 'Meetings retrieved successfully' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user?: any,
  ) {
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    return this.meetingsService.findAll(organizationId, userId, page, limit);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search meetings' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'organizationId', required: false })
  searchMeetings(
    @Query('q') query: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    return this.meetingsService.searchMeetings(query, organizationId, userId);
  }

  @Get('debug/bbb')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Debug BBB connection (Admin only)' })
  @ApiResponse({ status: 200, description: 'BBB debug information' })
  async debugBBB() {
    return this.meetingsService.debugBBBConnection();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meeting by ID' })
  @ApiResponse({ status: 200, description: 'Meeting retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  findOne(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update meeting' })
  @ApiResponse({ status: 200, description: 'Meeting updated successfully' })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  update(@Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto) {
    return this.meetingsService.update(id, updateMeetingDto);
  }

  @Delete(':id')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete meeting with BBB cleanup' })
  @ApiResponse({ status: 200, description: 'Meeting deleted successfully' })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  async remove(@Param('id') id: string) {
    console.log('=== Deleting Meeting ===');
    console.log('Meeting ID:', id);

    try {
      const meeting = await this.meetingsService.findOne(id);

      if (!meeting) {
        throw new BadRequestException('Meeting not found');
      }

      // End BBB meeting if it's running
      if (meeting.status === 'LIVE') {
        try {
          await this.bbbService.endMeeting(
            meeting.bbbMeetingId,
            meeting.moderatorPassword,
          );
          console.log('BBB meeting ended before deletion');
        } catch (bbbError) {
          console.log(
            'BBB meeting end failed (non-critical):',
            bbbError.message,
          );
        }
      }

      // Delete from database
      await this.meetingsService.remove(id);

      return {
        success: true,
        message: 'Meeting deleted successfully',
      };
    } catch (error) {
      console.error('Meeting deletion error:', error);
      throw new BadRequestException(
        `Failed to delete meeting: ${error.message}`,
      );
    }
  }

  @Post(':id/start')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Start meeting' })
  @ApiResponse({ status: 200, description: 'Meeting started successfully' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be started' })
  startMeeting(@Param('id') id: string) {
    return this.meetingsService.startMeeting(id);
  }

  @Post(':id/end')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'End meeting' })
  @ApiResponse({ status: 200, description: 'Meeting ended successfully' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be ended' })
  endMeeting(@Param('id') id: string) {
    return this.meetingsService.endMeeting(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join meeting using BBB service' })
  @ApiResponse({ status: 200, description: 'Join URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Failed to generate join URL' })
  async joinMeeting(
    @Param('id') id: string,
    @Body() joinMeetingDto: JoinMeetingDto,
    @CurrentUser() user?: any,
  ) {
    console.log('=== Join Meeting Request ===');
    console.log('Meeting ID:', id);
    console.log('User:', joinMeetingDto.fullName);

    try {
      const meeting = await this.meetingsService.findOne(id);

      if (!meeting) {
        throw new BadRequestException('Meeting not found');
      }

      // Create join DTO for BBB service
      const bbbJoinDto = {
        fullName: joinMeetingDto.fullName,
        meetingID: meeting.bbbMeetingId,
        password: meeting.attendeePassword, // Default to attendee
        userID: user?.email || '',
      };

      // Use BBB service
      const joinUrl = await this.bbbService.joinMeeting(bbbJoinDto);

      // Record participant
      if (user?.id) {
        try {
          await this.meetingsService.addParticipant(
            id,
            user.id,
            joinMeetingDto.fullName,
          );
        } catch (participantError) {
          console.log(
            'Participant recording failed (non-critical):',
            participantError.message,
          );
        }
      }

      return {
        success: true,
        joinUrl: joinUrl,
        meetingInfo: {
          title: meeting.title,
          status: meeting.status,
        },
      };
    } catch (error) {
      console.error('Join meeting error:', error);
      throw new BadRequestException(`Failed to join meeting: ${error.message}`);
    }
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get meeting analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Analytics not found' })
  getMeetingAnalytics(@Param('id') id: string) {
    return this.meetingsService.getMeetingAnalytics(id);
  }

  @Get(':id/transcripts')
  @ApiOperation({ summary: 'Get meeting transcripts' })
  @ApiResponse({
    status: 200,
    description: 'Transcripts retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMeetingTranscripts(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.meetingsService.getMeetingTranscripts(id, page, limit);
  }

  @Get(':id/action-items')
  @ApiOperation({ summary: 'Get meeting action items' })
  @ApiResponse({
    status: 200,
    description: 'Action items retrieved successfully',
  })
  getMeetingActionItems(@Param('id') id: string) {
    return this.meetingsService.getMeetingActionItems(id);
  }

  @Get(':id/summaries')
  @ApiOperation({ summary: 'Get meeting summaries' })
  @ApiResponse({ status: 200, description: 'Summaries retrieved successfully' })
  getMeetingSummaries(@Param('id') id: string) {
    return this.meetingsService.getMeetingSummaries(id);
  }

  @Get(':id/recordings')
  @ApiOperation({ summary: 'Get meeting recordings using BBB service' })
  @ApiResponse({
    status: 200,
    description: 'Recordings retrieved successfully',
  })
  async getMeetingRecordings(@Param('id') id: string) {
    console.log('=== Getting Meeting Recordings ===');
    console.log('Meeting ID:', id);

    try {
      const meeting = await this.meetingsService.findOne(id);

      if (!meeting) {
        throw new BadRequestException('Meeting not found');
      }

      // Use BBB service to get recordings
      const recordings = await this.bbbService.getRecordings(
        meeting.bbbMeetingId,
      );

      return {
        success: true,
        recordings: recordings || [],
        meetingInfo: {
          title: meeting.title,
          bbbMeetingId: meeting.bbbMeetingId,
        },
      };
    } catch (error) {
      console.error('Get recordings error:', error);
      return {
        success: false,
        recordings: [],
        error: error.message,
      };
    }
  }
}

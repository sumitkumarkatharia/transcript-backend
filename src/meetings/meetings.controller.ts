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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

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
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new meeting' })
  @ApiResponse({ status: 201, description: 'Meeting created successfully' })
  create(@Body() createMeetingDto: CreateMeetingDto, @CurrentUser() user: any) {
    return this.meetingsService.create(createMeetingDto, user.id);
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
    // Non-admin users can only see their own meetings
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
  update(@Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto) {
    return this.meetingsService.update(id, updateMeetingDto);
  }

  @Delete(':id')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete meeting' })
  @ApiResponse({ status: 200, description: 'Meeting deleted successfully' })
  remove(@Param('id') id: string) {
    return this.meetingsService.remove(id);
  }

  @Post(':id/start')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Start meeting' })
  @ApiResponse({ status: 200, description: 'Meeting started successfully' })
  startMeeting(@Param('id') id: string) {
    return this.meetingsService.startMeeting(id);
  }

  @Post(':id/end')
  @Roles(Role.USER, Role.ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'End meeting' })
  @ApiResponse({ status: 200, description: 'Meeting ended successfully' })
  endMeeting(@Param('id') id: string) {
    return this.meetingsService.endMeeting(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join meeting' })
  @ApiResponse({ status: 200, description: 'Join URL generated successfully' })
  joinMeeting(
    @Param('id') id: string,
    @Body() joinMeetingDto: JoinMeetingDto,
    @CurrentUser() user?: any,
  ) {
    return this.meetingsService.joinMeeting(
      id,
      joinMeetingDto.fullName,
      user?.id,
    );
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get meeting analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
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
  @ApiOperation({ summary: 'Get meeting recordings' })
  @ApiResponse({
    status: 200,
    description: 'Recordings retrieved successfully',
  })
  getMeetingRecordings(@Param('id') id: string) {
    return this.meetingsService.getMeetingRecordings(id);
  }
}

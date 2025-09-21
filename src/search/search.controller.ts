// src/search/search.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search across all content' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Content type filter',
  })
  @ApiQuery({
    name: 'meetingId',
    required: false,
    description: 'Specific meeting filter',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit' })
  search(
    @Query('q') query: string,
    @Query('type') type?: string,
    @Query('meetingId') meetingId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchContent(query, {
      type: type as any,
      meetingId,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('meetings')
  @ApiOperation({ summary: 'Search meetings' })
  @ApiResponse({ status: 200, description: 'Meeting search results' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  searchMeetings(@Query('q') query: string, @CurrentUser() user: any) {
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    return this.searchService.searchMeetings(query, userId);
  }

  @Get('transcripts')
  @ApiOperation({ summary: 'Search transcripts' })
  @ApiResponse({ status: 200, description: 'Transcript search results' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({
    name: 'meetingId',
    required: false,
    description: 'Meeting filter',
  })
  searchTranscripts(
    @Query('q') query: string,
    @Query('meetingId') meetingId?: string,
  ) {
    return this.searchService.searchTranscripts(query, meetingId);
  }

  @Get('ask')
  @ApiOperation({ summary: 'Ask a question about meetings' })
  @ApiResponse({ status: 200, description: 'Question answered' })
  @ApiQuery({ name: 'q', description: 'Question to ask' })
  @ApiQuery({
    name: 'meetingId',
    required: false,
    description: 'Meeting context',
  })
  askQuestion(
    @Query('q') question: string,
    @Query('meetingId') meetingId?: string,
  ) {
    return this.searchService.answerQuestion(question, meetingId);
  }
}

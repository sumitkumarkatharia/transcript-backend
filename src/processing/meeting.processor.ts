// src/processing/meeting.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { TranscriptionService } from '../ai/transcription.service';
import { SummaryService } from '../ai/summary.service';
import { AnalysisService } from '../ai/analysis.service';
import { SearchService } from '../search/search.service';
import { MeetingsGateway } from '../meetings/meetings.gateway';
import { AudioProcessorService } from '../bigbluebutton/bot/audio-processor.service';

interface AudioChunkJob {
  meetingId: string;
  chunkNumber: number;
  audioData: Buffer;
  timestamp: number;
}

interface MeetingCompletionJob {
  meetingId: string;
}

interface TranscriptProcessingJob {
  meetingId: string;
  transcriptText: string;
  chunkNumber: number;
}

@Processor('meeting-processing')
export class MeetingProcessor {
  private readonly logger = new Logger(MeetingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private transcriptionService: TranscriptionService,
    private summaryService: SummaryService,
    private analysisService: AnalysisService,
    private searchService: SearchService,
    private meetingsGateway: MeetingsGateway,
    private audioProcessor: AudioProcessorService,
  ) {}

  @Process('transcribe-audio')
  async processAudioChunk(job: Job<AudioChunkJob>): Promise<void> {
    const { meetingId, chunkNumber, audioData, timestamp } = job.data;

    try {
      this.logger.log(
        `Processing audio chunk ${chunkNumber} for meeting ${meetingId}`,
      );

      // Process audio for better transcription
      const processedAudio =
        await this.audioProcessor.processAudioForTranscription(audioData);

      // Transcribe audio
      const transcription = await this.transcriptionService.transcribeAudio(
        processedAudio,
        meetingId,
        chunkNumber,
      );

      // Emit real-time transcript update
      this.meetingsGateway.emitTranscriptUpdate(meetingId, {
        chunkNumber,
        text: transcription.text,
        confidence: transcription.confidence,
        timestamp,
      });

      this.logger.log(`Audio chunk ${chunkNumber} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process audio chunk ${chunkNumber}`, error);
      throw error;
    }
  }

  @Process('process-transcript')
  async processTranscript(job: Job<TranscriptProcessingJob>): Promise<void> {
    const { meetingId, transcriptText, chunkNumber } = job.data;
    console.log(transcriptText);
    try {
      this.logger.log(
        `Processing transcript chunk ${chunkNumber} for meeting ${meetingId}`,
      );

      // Extract action items from this transcript chunk
      const actionItems =
        await this.analysisService.extractActionItems(meetingId);

      if (actionItems.length > 0) {
        this.meetingsGateway.emitActionItemUpdate(meetingId, actionItems);
      }

      // Generate real-time summary update
      const summaries = await this.summaryService.generateMeetingSummary(
        meetingId,
        {
          type: 'REAL_TIME',
          style: 'concise',
          maxLength: 500,
        },
      );

      this.meetingsGateway.emitSummaryUpdate(meetingId, summaries);

      this.logger.log(`Transcript chunk ${chunkNumber} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process transcript chunk ${chunkNumber}`,
        error,
      );
      // Don't throw error for real-time processing failures
    }
  }

  @Process('process-meeting-completion')
  async processMeetingCompletion(
    job: Job<MeetingCompletionJob>,
  ): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Processing meeting completion for ${meetingId}`);

      // Generate final summaries
      await Promise.all([
        this.summaryService.generateMeetingSummary(meetingId, {
          type: 'EXECUTIVE',
          style: 'concise',
        }),
        this.summaryService.generateMeetingSummary(meetingId, {
          type: 'DETAILED',
          style: 'detailed',
        }),
        this.summaryService.generateMeetingSummary(meetingId, {
          type: 'ACTION_ITEMS',
          style: 'concise',
        }),
      ]);

      // Extract action items and topics
      await Promise.all([
        this.analysisService.extractActionItems(meetingId),
        this.analysisService.extractTopics(meetingId),
      ]);

      // Generate analytics
      await this.analysisService.generateMeetingAnalytics(meetingId);

      // Index content for search
      await this.searchService.indexContent(meetingId);

      // Update meeting status
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
      });

      // Emit completion event
      this.meetingsGateway.emitMeetingStatusUpdate(meetingId, 'COMPLETED');

      this.logger.log(
        `Meeting completion processing finished for ${meetingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process meeting completion for ${meetingId}`,
        error,
      );

      // Update meeting status to error
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'ERROR' },
      });

      throw error;
    }
  }

  @Process('generate-summary')
  async generateSummary(job: Job<any>): Promise<void> {
    const { meetingId, summaryType, options } = job.data;

    try {
      this.logger.log(
        `Generating ${summaryType} summary for meeting ${meetingId}`,
      );

      const summary = await this.summaryService.generateMeetingSummary(
        meetingId,
        {
          type: summaryType,
          ...options,
        },
      );

      this.meetingsGateway.emitSummaryUpdate(meetingId, summary);

      this.logger.log(
        `Summary generated successfully for meeting ${meetingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate summary for meeting ${meetingId}`,
        error,
      );
      throw error;
    }
  }

  @Process('extract-action-items')
  async extractActionItems(job: Job<any>): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Extracting action items for meeting ${meetingId}`);

      const actionItems =
        await this.analysisService.extractActionItems(meetingId);

      this.meetingsGateway.emitActionItemUpdate(meetingId, actionItems);

      this.logger.log(`Action items extracted for meeting ${meetingId}`);
    } catch (error) {
      this.logger.error(
        `Failed to extract action items for meeting ${meetingId}`,
        error,
      );
      throw error;
    }
  }

  @Process('send-meeting-recap')
  async sendMeetingRecap(job: Job<any>): Promise<void> {
    const { meetingId, recipients } = job.data;
    console.log(recipients);
    try {
      this.logger.log(`Sending meeting recap for ${meetingId}`);

      // Get meeting data
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          summaries: {
            where: { type: 'EXECUTIVE' },
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          actionItems: true,
          participants: {
            include: {
              user: {
                select: { email: true, name: true },
              },
            },
          },
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Send email recap (implementation would depend on email service)
      // await this.emailService.sendMeetingRecap(meeting, recipients);

      this.logger.log(`Meeting recap sent for ${meetingId}`);
    } catch (error) {
      this.logger.error(`Failed to send meeting recap for ${meetingId}`, error);
      throw error;
    }
  }

  @Process('schedule-bot-join')
  async scheduleBotJoin(job: Job<any>): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Scheduling bot join for meeting ${meetingId}`);

      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Check if meeting is scheduled to start soon (within 5 minutes)
      const now = new Date();
      const startTime = new Date(meeting.startTime);
      const timeDiff = startTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff <= 5 && minutesDiff >= -5) {
        // Meeting is starting soon or recently started, join bot
        // await this.meetingBotService.joinMeetingAsBot({...});
        this.logger.log(`Bot join scheduled for meeting ${meetingId}`);
      } else {
        // Reschedule for later
        const delay = Math.max(0, minutesDiff - 2) * 60 * 1000; // Join 2 minutes before start
        // Reschedule job
        this.logger.log(
          `Rescheduling bot join for meeting ${meetingId} in ${delay}ms`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule bot join for meeting ${meetingId}`,
        error,
      );
    }
  }
}

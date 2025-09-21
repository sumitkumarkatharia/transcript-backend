// src/processing/events.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { MeetingsGateway } from '../meetings/meetings.gateway';

@Processor('meeting-events')
export class EventsProcessor {
  private readonly logger = new Logger(EventsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private meetingsGateway: MeetingsGateway,
  ) {}

  @Process('participant-joined')
  async handleParticipantJoined(job: Job<any>): Promise<void> {
    const { meetingId, participant, timestamp } = job.data;

    try {
      // Update participant record
      await this.prisma.meetingParticipant.upsert({
        where: {
          meetingId_bbbUserId: {
            meetingId,
            bbbUserId: participant.userID,
          },
        },
        update: {
          joinTime: new Date(timestamp),
        },
        create: {
          meetingId,
          name: participant.fullName,
          bbbUserId: participant.userID,
          joinTime: new Date(timestamp),
        },
      });

      // Emit real-time update
      this.meetingsGateway.emitParticipantUpdate(
        meetingId,
        participant,
        'joined',
      );

      this.logger.log(
        `Participant joined: ${participant.fullName} in meeting ${meetingId}`,
      );
    } catch (error) {
      this.logger.error('Failed to handle participant joined event', error);
    }
  }

  @Process('participant-left')
  async handleParticipantLeft(job: Job<any>): Promise<void> {
    const { meetingId, participant, timestamp } = job.data;

    try {
      // Update participant record
      await this.prisma.meetingParticipant.updateMany({
        where: {
          meetingId,
          bbbUserId: participant.userID,
        },
        data: {
          leaveTime: new Date(timestamp),
        },
      });

      // Emit real-time update
      this.meetingsGateway.emitParticipantUpdate(
        meetingId,
        participant,
        'left',
      );

      this.logger.log(
        `Participant left: ${participant.fullName} from meeting ${meetingId}`,
      );
    } catch (error) {
      this.logger.error('Failed to handle participant left event', error);
    }
  }

  @Process('meeting-started')
  async handleMeetingStarted(job: Job<any>): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Meeting started: ${meetingId}`);

      // Emit real-time update
      this.meetingsGateway.emitMeetingStatusUpdate(meetingId, 'LIVE');
    } catch (error) {
      this.logger.error('Failed to handle meeting started event', error);
    }
  }

  @Process('meeting-ended')
  async handleMeetingEnded(job: Job<any>): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Meeting ended: ${meetingId}`);

      // Emit real-time update
      this.meetingsGateway.emitMeetingStatusUpdate(meetingId, 'PROCESSING');
    } catch (error) {
      this.logger.error('Failed to handle meeting ended event', error);
    }
  }

  @Process('recording-ready')
  async handleRecordingReady(job: Job<any>): Promise<void> {
    const { meetingId } = job.data;

    try {
      this.logger.log(`Recording ready for meeting: ${meetingId}`);

      // Process recording for additional transcription if needed
      // This could trigger additional processing workflows
    } catch (error) {
      this.logger.error('Failed to handle recording ready event', error);
    }
  }
}

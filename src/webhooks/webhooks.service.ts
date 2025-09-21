// src/webhooks/webhooks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('meeting-events') private eventsQueue: Queue,
  ) {}

  async handleBigBlueButtonWebhook(payload: any): Promise<void> {
    try {
      this.logger.log('Received BBB webhook', payload);

      const { event, meeting_id, timestamp } = payload;

      switch (event) {
        case 'meeting-started':
          await this.handleMeetingStarted(meeting_id, timestamp);
          break;
        case 'meeting-ended':
          await this.handleMeetingEnded(meeting_id, timestamp);
          break;
        case 'participant-joined':
          await this.handleParticipantJoined(payload);
          break;
        case 'participant-left':
          await this.handleParticipantLeft(payload);
          break;
        case 'recording-ready':
          await this.handleRecordingReady(payload);
          break;
        default:
          this.logger.warn(`Unknown BBB webhook event: ${event}`);
      }
    } catch (error) {
      this.logger.error('Failed to process BBB webhook', error);
      throw error;
    }
  }

  private async handleMeetingStarted(
    meetingId: string,
    timestamp: string,
  ): Promise<void> {
    await this.prisma.meeting.updateMany({
      where: { bbbMeetingId: meetingId },
      data: {
        status: 'LIVE',
        startTime: new Date(timestamp),
      },
    });

    await this.eventsQueue.add('meeting-started', {
      meetingId,
      timestamp,
    });
  }

  private async handleMeetingEnded(
    meetingId: string,
    timestamp: string,
  ): Promise<void> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { bbbMeetingId: meetingId },
    });

    if (meeting) {
      const duration = meeting.startTime
        ? Math.floor(
            (new Date(timestamp).getTime() - meeting.startTime.getTime()) /
              60000,
          )
        : null;

      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'PROCESSING',
          endTime: new Date(timestamp),
          duration,
        },
      });

      await this.eventsQueue.add('meeting-ended', {
        meetingId: meeting.id,
        bbbMeetingId: meetingId,
        timestamp,
      });
    }
  }

  private async handleParticipantJoined(payload: any): Promise<void> {
    const { meeting_id, user_id, user_name, timestamp } = payload;

    const meeting = await this.prisma.meeting.findFirst({
      where: { bbbMeetingId: meeting_id },
    });

    if (meeting) {
      await this.prisma.meetingParticipant.upsert({
        where: {
          meetingId_bbbUserId: {
            meetingId: meeting.id,
            bbbUserId: user_id,
          },
        },
        update: {
          name: user_name,
          joinTime: new Date(timestamp),
        },
        create: {
          meetingId: meeting.id,
          name: user_name,
          bbbUserId: user_id,
          joinTime: new Date(timestamp),
        },
      });
    }
  }

  private async handleParticipantLeft(payload: any): Promise<void> {
    const { meeting_id, user_id, timestamp } = payload;

    const meeting = await this.prisma.meeting.findFirst({
      where: { bbbMeetingId: meeting_id },
    });

    if (meeting) {
      await this.prisma.meetingParticipant.updateMany({
        where: {
          meetingId: meeting.id,
          bbbUserId: user_id,
        },
        data: {
          leaveTime: new Date(timestamp),
        },
      });
    }
  }

  private async handleRecordingReady(payload: any): Promise<void> {
    const { meeting_id, record_id, playback_url } = payload;

    const meeting = await this.prisma.meeting.findFirst({
      where: { bbbMeetingId: meeting_id },
    });

    if (meeting) {
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          bbbRecordingId: record_id,
          recordingUrl: playback_url,
        },
      });

      await this.eventsQueue.add('recording-ready', {
        meetingId: meeting.id,
        recordingUrl: playback_url,
      });
    }
  }
}

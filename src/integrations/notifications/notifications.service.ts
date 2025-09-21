// src/integrations/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { EmailService } from './email.service';
import { IntegrationType } from '@prisma/client';

export interface NotificationMessage {
  title: string;
  content: string;
  recipient?: string;
  channel?: string;
  attachments?: any[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private slackService: SlackService,
    private teamsService: TeamsService,
    private emailService: EmailService,
  ) {}

  async sendNotification(
    type: IntegrationType,
    credentials: any,
    message: NotificationMessage,
  ): Promise<any> {
    switch (type) {
      case 'SLACK':
        return this.slackService.sendMessage(credentials, message);
      case 'MICROSOFT_TEAMS':
        return this.teamsService.sendMessage(credentials, message);
      default:
        throw new Error(`Unsupported notification type: ${type}`);
    }
  }

  async sendMeetingSummary(
    type: IntegrationType,
    credentials: any,
    meetingData: any,
  ): Promise<any> {
    const message: NotificationMessage = {
      title: `Meeting Summary: ${meetingData.title}`,
      content: this.formatMeetingSummary(meetingData),
    };

    return this.sendNotification(type, credentials, message);
  }

  async sendMeetingRecap(
    recipients: string[],
    meetingData: any,
  ): Promise<void> {
    for (const recipient of recipients) {
      await this.emailService.sendMeetingRecap(recipient, meetingData);
    }
  }

  private formatMeetingSummary(meetingData: any): string {
    return `
📅 **${meetingData.title}**
🕐 Duration: ${meetingData.duration} minutes
👥 Participants: ${meetingData.participants?.length || 0}

📝 **Key Points:**
${meetingData.summary?.keyPoints?.map((point: string) => `• ${point}`).join('\n') || 'No key points available'}

✅ **Action Items:**
${meetingData.actionItems?.map((item: any) => `• ${item.title} (${item.assignedTo || 'Unassigned'})`).join('\n') || 'No action items'}
    `;
  }
}

// src/integrations/notifications/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  async sendMeetingRecap(recipient: string, meetingData: any): Promise<void> {
    try {
      this.logger.log(`Sending meeting recap email to: ${recipient}`);

      // In production, implement email service (SendGrid, SES, etc.)
      // Mock implementation for now
      const emailContent = this.generateMeetingRecapEmail(meetingData);
      console.log(`Email sent to ${recipient} with content:\n${emailContent}`);
      this.logger.log('Meeting recap email sent successfully');
    } catch (error) {
      this.logger.error('Failed to send meeting recap email', error);
      throw error;
    }
  }

  private generateMeetingRecapEmail(meetingData: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Meeting Recap: ${meetingData.title}</title>
</head>
<body>
    <h2>Meeting Recap: ${meetingData.title}</h2>
    <p><strong>Date:</strong> ${new Date(meetingData.startTime).toLocaleDateString()}</p>
    <p><strong>Duration:</strong> ${meetingData.duration} minutes</p>
    
    <h3>Summary</h3>
    <p>${meetingData.summary?.content || 'No summary available'}</p>
    
    <h3>Action Items</h3>
    <ul>
        ${
          meetingData.actionItems
            ?.map(
              (item: any) =>
                `<li>${item.title} - Assigned to: ${item.assignedTo || 'Unassigned'}</li>`,
            )
            .join('') || '<li>No action items</li>'
        }
    </ul>
    
    <p>Best regards,<br>Fireflies.ai Team</p>
</body>
</html>
    `;
  }
}

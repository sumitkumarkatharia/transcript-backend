// src/integrations/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { EmailService } from './email.service';

@Module({
  providers: [NotificationsService, SlackService, TeamsService, EmailService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

// src/integrations/calendar/calendar.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { IntegrationType } from '@prisma/client';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetingUrl?: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private googleCalendarService: GoogleCalendarService,
    private outlookCalendarService: OutlookCalendarService,
  ) {}

  async createEvent(
    type: IntegrationType,
    credentials: any,
    event: CalendarEvent,
  ): Promise<any> {
    switch (type) {
      case 'GOOGLE_CALENDAR':
        return this.googleCalendarService.createEvent(credentials, event);
      case 'OUTLOOK_CALENDAR':
        return this.outlookCalendarService.createEvent(credentials, event);
      default:
        throw new Error(`Unsupported calendar type: ${type}`);
    }
  }

  async syncEvents(
    type: IntegrationType,
    credentials: any,
  ): Promise<CalendarEvent[]> {
    switch (type) {
      case 'GOOGLE_CALENDAR':
        return this.googleCalendarService.syncEvents(credentials);
      case 'OUTLOOK_CALENDAR':
        return this.outlookCalendarService.syncEvents(credentials);
      default:
        throw new Error(`Unsupported calendar type: ${type}`);
    }
  }
}

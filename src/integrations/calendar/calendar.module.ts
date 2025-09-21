// src/integrations/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';

@Module({
  providers: [CalendarService, GoogleCalendarService, OutlookCalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}

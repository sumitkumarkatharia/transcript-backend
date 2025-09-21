// src/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

// Integration modules
import { CalendarModule } from './calendar/calendar.module';
import { CrmModule } from './crm/crm.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [CalendarModule, CrmModule, NotificationsModule],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}

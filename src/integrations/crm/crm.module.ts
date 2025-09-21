// src/integrations/crm/crm.module.ts
import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { SalesforceService } from './salesforce.service';
import { HubspotService } from './hubspot.service';

@Module({
  providers: [CrmService, SalesforceService, HubspotService],
  exports: [CrmService],
})
export class CrmModule {}

// src/integrations/crm/crm.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SalesforceService } from './salesforce.service';
import { HubspotService } from './hubspot.service';
import { IntegrationType } from '@prisma/client';

export interface CrmContact {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
}

export interface CrmDeal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  contactId: string;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private salesforceService: SalesforceService,
    private hubspotService: HubspotService,
  ) {}

  async syncContacts(
    type: IntegrationType,
    credentials: any,
  ): Promise<CrmContact[]> {
    switch (type) {
      case 'SALESFORCE':
        return this.salesforceService.syncContacts(credentials);
      case 'HUBSPOT':
        return this.hubspotService.syncContacts(credentials);
      default:
        throw new Error(`Unsupported CRM type: ${type}`);
    }
  }

  async createMeetingNote(
    type: IntegrationType,
    credentials: any,
    contactId: string,
    note: string,
  ): Promise<any> {
    switch (type) {
      case 'SALESFORCE':
        return this.salesforceService.createNote(credentials, contactId, note);
      case 'HUBSPOT':
        return this.hubspotService.createNote(credentials, contactId, note);
      default:
        throw new Error(`Unsupported CRM type: ${type}`);
    }
  }
}

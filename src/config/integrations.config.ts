// src/config/integrations.config.ts
import { registerAs } from '@nestjs/config';

export const integrationsConfig = registerAs('integrations', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
  teams: {
    clientId: process.env.TEAMS_CLIENT_ID,
    clientSecret: process.env.TEAMS_CLIENT_SECRET,
    tenantId: process.env.TEAMS_TENANT_ID,
  },
  salesforce: {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    loginUrl:
      process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
  },
  hubspot: {
    clientId: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
  },
}));

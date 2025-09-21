// src/config/email.config.ts
import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Fireflies.ai',
    address: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER,
  },
  templates: {
    meetingSummary: 'meeting-summary',
    actionItems: 'action-items',
    meetingInvite: 'meeting-invite',
  },
}));

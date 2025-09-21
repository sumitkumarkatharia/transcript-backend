// src/config/bigbluebutton.config.ts
import { registerAs } from '@nestjs/config';

export const bbbConfig = registerAs('bbb', () => ({
  apiUrl: process.env.BBB_API_URL,
  secretKey: process.env.BBB_SECRET_KEY,
  webhookUrl: process.env.BBB_WEBHOOK_URL,
  defaultMeetingDuration: parseInt(process.env.BBB_DEFAULT_DURATION) || 120, // minutes
  maxParticipants: parseInt(process.env.BBB_MAX_PARTICIPANTS) || 100,
  autoStartRecording: process.env.BBB_AUTO_START_RECORDING === 'true',
  allowStartStopRecording:
    process.env.BBB_ALLOW_START_STOP_RECORDING === 'true',
}));

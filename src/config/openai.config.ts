// src/config/openai.config.ts
import { registerAs } from '@nestjs/config';

export const openaiConfig = registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  orgId: process.env.OPENAI_ORG_ID,
  model: process.env.OPENAI_MODEL || 'gpt-4',
  whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
}));

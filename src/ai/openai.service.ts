// src/ai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Readable } from 'stream';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
      organization: this.configService.get('OPENAI_ORG_ID'),
    });
  }

  async transcribeAudio(audioBuffer: Buffer, language = 'en'): Promise<any> {
    try {
      // Create a readable stream from the buffer
      const audioStream = Readable.from(audioBuffer);
      // Add filename property to the stream for OpenAI API
      (audioStream as any).path = 'audio.wav';

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioStream as any,
        model: 'whisper-1',
        language,
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      return transcription;
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string, options: any = {}): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        ...options,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('Failed to generate completion', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return embedding.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      throw error;
    }
  }

  async generateFunctionCall(prompt: string, functions: any[]): Promise<any> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        functions,
        function_call: 'auto',
      });

      return completion.choices[0]?.message?.function_call;
    } catch (error) {
      this.logger.error('Failed to generate function call', error);
      throw error;
    }
  }
}

// src/ai/transcription.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
    @InjectQueue('ai-processing') private aiQueue: Queue,
  ) {}

  async transcribeAudio(
    audioBuffer: Buffer,
    meetingId: string,
    chunkNumber: number,
  ): Promise<TranscriptionResult> {
    try {
      this.logger.log(
        `Starting transcription for meeting ${meetingId}, chunk ${chunkNumber}`,
      );

      // Use OpenAI Whisper for transcription
      const whisperResult =
        await this.openAIService.transcribeAudio(audioBuffer);

      const result: TranscriptionResult = {
        text: whisperResult.text,
        confidence: this.calculateAverageConfidence(whisperResult.words || []),
        language: whisperResult.language || 'en',
        words: whisperResult.words?.map((word: any) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.probability || 0.8,
        })),
        segments: whisperResult.segments?.map((segment: any) => ({
          text: segment.text,
          start: segment.start,
          end: segment.end,
        })),
      };

      // Store transcription result
      await this.saveTranscription(meetingId, result, chunkNumber);

      this.logger.log(
        `Transcription completed for meeting ${meetingId}, chunk ${chunkNumber}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error);
      throw error;
    }
  }

  async processRealTimeTranscription(
    meetingId: string,
    audioStream: any,
  ): Promise<void> {
    console.log('processRealTimeTranscription called', audioStream);
    // Real-time transcription would require streaming implementation
    // This is a placeholder for the streaming transcription logic
    this.logger.log(
      `Starting real-time transcription for meeting: ${meetingId}`,
    );
  }

  async identifySpeakers(
    transcript: string,
    audioBuffer?: Buffer,
  ): Promise<any[]> {
    console.log('processRealTimeTranscription called', transcript, audioBuffer);

    // Speaker diarization logic
    // This would typically use a separate model or service

    // For now, return mock speaker identification
    return [
      {
        speaker: 'Speaker 1',
        confidence: 0.85,
        segments: [{ start: 0, end: 30, text: 'First part of transcript...' }],
      },
      {
        speaker: 'Speaker 2',
        confidence: 0.78,
        segments: [
          { start: 30, end: 60, text: 'Second part of transcript...' },
        ],
      },
    ];
  }

  private async saveTranscription(
    meetingId: string,
    result: TranscriptionResult,
    chunkNumber: number,
  ): Promise<void> {
    // Split into segments for storage
    if (result.segments) {
      for (const segment of result.segments) {
        await this.prisma.transcript.create({
          data: {
            meetingId,
            speakerName: segment.speaker || 'Unknown Speaker',
            content: segment.text,
            startTimestamp: segment.start,
            endTimestamp: segment.end,
            confidence: result.confidence,
            language: result.language,
            processingStatus: 'COMPLETED',
          },
        });
      }
    } else {
      // Save as single transcript
      await this.prisma.transcript.create({
        data: {
          meetingId,
          speakerName: 'Unknown Speaker',
          content: result.text,
          startTimestamp: 0,
          endTimestamp: 0,
          confidence: result.confidence,
          language: result.language,
          processingStatus: 'COMPLETED',
        },
      });
    }

    // Update audio chunk as transcribed
    await this.prisma.audioChunk.updateMany({
      where: {
        meetingId,
        chunkNumber,
      },
      data: {
        transcribed: true,
        transcribedAt: new Date(),
      },
    });

    // Queue for further AI processing
    await this.aiQueue.add('process-transcript', {
      meetingId,
      transcriptText: result.text,
      chunkNumber,
    });
  }

  private calculateAverageConfidence(words: any[]): number {
    if (!words || words.length === 0) return 0.8; // Default confidence

    const totalConfidence = words.reduce(
      (sum, word) => sum + (word.probability || 0.8),
      0,
    );
    return totalConfidence / words.length;
  }

  async getTranscriptsByMeeting(meetingId: string): Promise<any[]> {
    return this.prisma.transcript.findMany({
      where: { meetingId },
      orderBy: { startTimestamp: 'asc' },
    });
  }

  async searchTranscripts(query: string, meetingId?: string): Promise<any[]> {
    const where: any = {
      content: {
        contains: query,
        mode: 'insensitive',
      },
    };

    if (meetingId) {
      where.meetingId = meetingId;
    }

    return this.prisma.transcript.findMany({
      where,
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
      },
      orderBy: { startTimestamp: 'asc' },
    });
  }
}

// src/bigbluebutton/bot/meeting-bot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';

import { PrismaService } from '../../prisma/prisma.service';
import { BigBlueButtonService } from '../bbb.service';
import { AudioProcessorService } from './audio-processor.service';

export interface MeetingBotConfig {
  meetingId: string;
  botName: string;
  password: string;
  enableAudioCapture: boolean;
  enableTranscription: boolean;
}

export interface AudioChunk {
  meetingId: string;
  chunkNumber: number;
  audioData: Buffer;
  timestamp: number;
  duration: number;
}

export interface Participant {
  userId: string;
  name: string;
  role: string;
  timestamp?: number;
}

export interface MeetingEndedData {
  meetingId: string;
  reason?: string;
}

// Define proper event listener types
export type EventListenerMap = {
  audioChunk: (audioChunk: AudioChunk) => void;
  participantJoined: (participant: Participant) => void;
  participantLeft: (participant: Participant) => void;
  meetingEnded: (data?: MeetingEndedData) => void;
};

export type EventName = keyof EventListenerMap;
export type EventListener<T extends EventName> = EventListenerMap[T];

@Injectable()
export class MeetingBotService {
  private readonly logger = new Logger(MeetingBotService.name);
  private activeBots = new Map<string, MeetingBot>();

  constructor(
    private prisma: PrismaService,
    private bbbService: BigBlueButtonService,
    private audioProcessor: AudioProcessorService,
    private configService: ConfigService,
    @InjectQueue('audio-processing') private audioQueue: Queue,
    @InjectQueue('meeting-events') private eventsQueue: Queue,
  ) {}

  async joinMeetingAsBot(config: MeetingBotConfig): Promise<void> {
    try {
      // Check if bot is already in this meeting
      if (this.activeBots.has(config.meetingId)) {
        this.logger.warn(`Bot already active in meeting: ${config.meetingId}`);
        return;
      }

      // Update meeting status
      await this.prisma.meeting.update({
        where: { bbbMeetingId: config.meetingId },
        data: {
          botJoined: true,
          botJoinedAt: new Date(),
        },
      });

      // Create and start bot
      const bot = new MeetingBot(
        config,
        this.bbbService,
        this.audioProcessor,
        this.logger,
      );
      this.activeBots.set(config.meetingId, bot);

      await bot.join();

      // Set up audio processing
      if (config.enableAudioCapture) {
        bot.on('audioChunk', (audioChunk: AudioChunk) => {
          this.handleAudioChunk(audioChunk);
        });
      }

      // Set up meeting event handling
      bot.on('participantJoined', (participant: Participant) => {
        this.handleParticipantJoined(config.meetingId, participant);
      });

      bot.on('participantLeft', (participant: Participant) => {
        this.handleParticipantLeft(config.meetingId, participant);
      });

      bot.on('meetingEnded', () => {
        this.handleMeetingEnded(config.meetingId);
      });

      this.logger.log(`Bot successfully joined meeting: ${config.meetingId}`);
    } catch (error) {
      this.logger.error(
        `Failed to join meeting as bot: ${config.meetingId}`,
        error,
      );

      // Update meeting status on error
      await this.prisma.meeting.update({
        where: { bbbMeetingId: config.meetingId },
        data: {
          botJoined: false,
          status: 'ERROR',
        },
      });

      throw error;
    }
  }

  async leaveMeeting(meetingId: string): Promise<void> {
    const bot = this.activeBots.get(meetingId);
    if (!bot) {
      this.logger.warn(`No active bot found for meeting: ${meetingId}`);
      return;
    }

    try {
      await bot.leave();
      this.activeBots.delete(meetingId);

      // Update meeting status
      await this.prisma.meeting.update({
        where: { bbbMeetingId: meetingId },
        data: {
          botJoined: false,
          botLeftAt: new Date(),
        },
      });

      this.logger.log(`Bot left meeting: ${meetingId}`);
    } catch (error) {
      this.logger.error(`Failed to leave meeting: ${meetingId}`, error);
      throw error;
    }
  }

  async getActiveBots(): Promise<string[]> {
    return Array.from(this.activeBots.keys());
  }

  async getBotStatus(meetingId: string): Promise<boolean> {
    return this.activeBots.has(meetingId);
  }

  private async handleAudioChunk(audioChunk: AudioChunk): Promise<void> {
    // Store audio chunk in database
    await this.prisma.audioChunk.create({
      data: {
        meetingId: audioChunk.meetingId,
        chunkNumber: audioChunk.chunkNumber,
        startTimestamp: audioChunk.timestamp,
        endTimestamp: audioChunk.timestamp + audioChunk.duration,
        audioUrl: await this.audioProcessor.saveAudioChunk(audioChunk),
        duration: audioChunk.duration,
      },
    });

    // Queue for transcription
    await this.audioQueue.add('transcribe-audio', {
      meetingId: audioChunk.meetingId,
      chunkNumber: audioChunk.chunkNumber,
      audioData: audioChunk.audioData,
      timestamp: audioChunk.timestamp,
    });
  }

  private async handleParticipantJoined(
    meetingId: string,
    participant: Participant,
  ): Promise<void> {
    await this.eventsQueue.add('participant-joined', {
      meetingId,
      participant,
      timestamp: new Date(),
    });
  }

  private async handleParticipantLeft(
    meetingId: string,
    participant: Participant,
  ): Promise<void> {
    await this.eventsQueue.add('participant-left', {
      meetingId,
      participant,
      timestamp: new Date(),
    });
  }

  private async handleMeetingEnded(meetingId: string): Promise<void> {
    // Clean up bot
    await this.leaveMeeting(meetingId);

    // Update meeting status
    await this.prisma.meeting.update({
      where: { bbbMeetingId: meetingId },
      data: {
        status: 'PROCESSING',
        endTime: new Date(),
      },
    });

    // Queue final processing
    await this.eventsQueue.add('meeting-ended', {
      meetingId,
      timestamp: new Date(),
    });
  }
}

// Mock MeetingBot class (would need WebRTC implementation)
class MeetingBot {
  private eventListeners = new Map<EventName, EventListener<any>[]>();
  private ws: WebSocket | null = null;
  private audioStream: any = null;

  constructor(
    private config: MeetingBotConfig,
    private bbbService: BigBlueButtonService,
    private audioProcessor: AudioProcessorService,
    private logger: Logger,
  ) {}

  async join(): Promise<void> {
    try {
      // Generate join URL for bot
      const joinUrl = await this.bbbService.joinMeeting({
        fullName: this.config.botName,
        meetingID: this.config.meetingId,
        password: this.config.password,
        userID: `bot-${this.config.meetingId}`,
      });

      // In a real implementation, you would:
      // 1. Use WebRTC to connect to the BBB meeting
      // 2. Set up audio capture
      // 3. Handle meeting events

      this.logger.log(`Bot join URL generated: ${joinUrl}`);

      // Mock WebSocket connection for demonstration
      this.ws = new WebSocket('wss://mock-bbb-websocket.com');

      this.ws.on('open', () => {
        this.logger.log('Bot WebSocket connected');
        this.startAudioCapture();
      });

      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error('Bot WebSocket error', error);
      });

      this.ws.on('close', () => {
        this.logger.log('Bot WebSocket disconnected');
      });
    } catch (error) {
      this.logger.error('Failed to join meeting as bot', error);
      throw error;
    }
  }

  async leave(): Promise<void> {
    if (this.audioStream) {
      this.audioStream.destroy();
      this.audioStream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.eventListeners.clear();
  }

  // Type-safe event listener registration
  on<T extends EventName>(event: T, listener: EventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  // Type-safe event removal
  off<T extends EventName>(event: T, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit<T extends EventName>(
    event: T,
    data: Parameters<EventListener<T>>[0],
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  private startAudioCapture(): void {
    if (!this.config.enableAudioCapture) return;

    // Mock audio capture - in real implementation would use WebRTC
    let chunkNumber = 0;
    const interval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      // Generate mock audio chunk
      const audioChunk: AudioChunk = {
        meetingId: this.config.meetingId,
        chunkNumber: chunkNumber++,
        audioData: Buffer.alloc(1024), // Mock audio data
        timestamp: Date.now() / 1000,
        duration: 5, // 5 seconds
      };

      this.emit('audioChunk', audioChunk);
    }, 5000); // Every 5 seconds
  }

  private handleWebSocketMessage(data: any): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'participant_joined':
          this.emit('participantJoined', message.data as Participant);
          break;
        case 'participant_left':
          this.emit('participantLeft', message.data as Participant);
          break;
        case 'meeting_ended':
          this.emit('meetingEnded', message.data as MeetingEndedData);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', error);
    }
  }
}

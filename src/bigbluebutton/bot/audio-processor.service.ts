// src/bigbluebutton/bot/audio-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

import { AudioChunk } from './meeting-bot.service';

@Injectable()
export class AudioProcessorService {
  private readonly logger = new Logger(AudioProcessorService.name);
  private readonly s3: S3;
  private readonly useS3: boolean;
  private readonly localStoragePath: string;

  constructor(private configService: ConfigService) {
    this.useS3 = !!this.configService.get('AWS_S3_BUCKET');

    if (this.useS3) {
      this.s3 = new S3({
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        region: this.configService.get('AWS_REGION'),
      });
    } else {
      this.localStoragePath = path.join(process.cwd(), 'storage', 'audio');
      this.ensureDirectoryExists(this.localStoragePath);
    }
  }

  async saveAudioChunk(audioChunk: AudioChunk): Promise<string> {
    const fileName = `${audioChunk.meetingId}/chunk-${audioChunk.chunkNumber}-${uuidv4()}.wav`;

    try {
      if (this.useS3) {
        return await this.saveToS3(fileName, audioChunk.audioData);
      } else {
        return await this.saveToLocal(fileName, audioChunk.audioData);
      }
    } catch (error) {
      this.logger.error('Failed to save audio chunk', error);
      throw error;
    }
  }

  async getAudioChunk(audioUrl: string): Promise<Buffer> {
    try {
      if (this.useS3 && audioUrl.startsWith('https://')) {
        return await this.getFromS3(audioUrl);
      } else {
        return await this.getFromLocal(audioUrl);
      }
    } catch (error) {
      this.logger.error('Failed to get audio chunk', error);
      throw error;
    }
  }

  async deleteAudioChunk(audioUrl: string): Promise<void> {
    try {
      if (this.useS3 && audioUrl.startsWith('https://')) {
        await this.deleteFromS3(audioUrl);
      } else {
        await this.deleteFromLocal(audioUrl);
      }
    } catch (error) {
      this.logger.error('Failed to delete audio chunk', error);
      throw error;
    }
  }

  private async saveToS3(fileName: string, audioData: Buffer): Promise<string> {
    const bucket = this.configService.get('AWS_S3_BUCKET');

    const params = {
      Bucket: bucket,
      Key: `audio/${fileName}`,
      Body: audioData,
      ContentType: 'audio/wav',
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  private async saveToLocal(
    fileName: string,
    audioData: Buffer,
  ): Promise<string> {
    const filePath = path.join(this.localStoragePath, fileName);
    const directory = path.dirname(filePath);

    this.ensureDirectoryExists(directory);

    await fs.promises.writeFile(filePath, audioData);
    return filePath;
  }

  private async getFromS3(audioUrl: string): Promise<Buffer> {
    const bucket = this.configService.get('AWS_S3_BUCKET');
    const key = audioUrl.split('/').pop(); // Extract key from URL

    const params = {
      Bucket: bucket,
      Key: `audio/${key}`,
    };

    const result = await this.s3.getObject(params).promise();
    return result.Body as Buffer;
  }

  private async getFromLocal(audioUrl: string): Promise<Buffer> {
    return fs.promises.readFile(audioUrl);
  }

  private async deleteFromS3(audioUrl: string): Promise<void> {
    const bucket = this.configService.get('AWS_S3_BUCKET');
    const key = audioUrl.split('/').pop(); // Extract key from URL

    const params = {
      Bucket: bucket,
      Key: `audio/${key}`,
    };

    await this.s3.deleteObject(params).promise();
  }

  private async deleteFromLocal(audioUrl: string): Promise<void> {
    await fs.promises.unlink(audioUrl);
  }

  private ensureDirectoryExists(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  async processAudioForTranscription(audioData: Buffer): Promise<Buffer> {
    // Here you would implement audio processing logic:
    // 1. Convert to required format (usually WAV or MP3)
    // 2. Normalize audio levels
    // 3. Remove background noise
    // 4. Split by speaker if needed

    // For now, return the audio data as-is
    return audioData;
  }

  async combineAudioChunks(audioUrls: string[]): Promise<Buffer> {
    console.log('Combining audio chunks:', audioUrls);
    // Here you would implement audio combining logic:
    // 1. Download all audio chunks
    // 2. Combine them in chronological order
    // 3. Ensure smooth transitions

    // For now, return empty buffer
    return Buffer.alloc(0);
  }
}

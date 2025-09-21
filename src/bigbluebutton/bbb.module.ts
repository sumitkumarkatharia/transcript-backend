// src/bigbluebutton/bbb.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BigBlueButtonService } from './bbb.service';
import { BigBlueButtonController } from './bbb.controller';
import { MeetingBotService } from './bot/meeting-bot.service';
import { AudioProcessorService } from './bot/audio-processor.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'audio-processing',
    }),
    BullModule.registerQueue({
      name: 'meeting-events',
    }),
    WebhooksModule,
  ],
  providers: [BigBlueButtonService, MeetingBotService, AudioProcessorService],
  controllers: [BigBlueButtonController],
  exports: [BigBlueButtonService, MeetingBotService],
})
export class BigBlueButtonModule {}

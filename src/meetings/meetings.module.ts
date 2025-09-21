// src/meetings/meetings.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsGateway } from './meetings.gateway';
import { BigBlueButtonModule } from '../bigbluebutton/bbb.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meeting-processing',
    }),
    BigBlueButtonModule,
    AiModule,
  ],
  providers: [MeetingsService, MeetingsGateway],
  controllers: [MeetingsController],
  exports: [MeetingsService],
})
export class MeetingsModule {}

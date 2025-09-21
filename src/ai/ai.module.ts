import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { TranscriptionService } from './transcription.service';
import { SummaryService } from './summary.service';
import { AnalysisService } from './analysis.service';
import { OpenAIService } from './openai.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ai-processing',
    }),
  ],
  providers: [
    OpenAIService,
    TranscriptionService,
    SummaryService,
    AnalysisService,
  ],
  exports: [OpenAIService, TranscriptionService, SummaryService, AnalysisService],
})
export class AiModule {}

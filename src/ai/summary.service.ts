// src/ai/summary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { SummaryType } from '@prisma/client';

export interface SummaryOptions {
  type: SummaryType;
  style: 'concise' | 'detailed' | 'executive';
  maxLength?: number;
  language?: string;
}

export interface MeetingSummaryResult {
  content: string;
  keyPoints: string[];
  participants: string[];
  tokensUsed: number;
  model: string;
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  async generateMeetingSummary(
    meetingId: string,
    options: SummaryOptions = { type: 'EXECUTIVE', style: 'concise' },
  ): Promise<MeetingSummaryResult> {
    try {
      this.logger.log(
        `Generating ${options.type} summary for meeting: ${meetingId}`,
      );

      // Get meeting data
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          transcripts: {
            orderBy: { startTimestamp: 'asc' },
          },
          participants: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      if (!meeting || !meeting.transcripts.length) {
        throw new Error('No transcript data available for summary generation');
      }

      // Combine transcripts
      const fullTranscript = meeting.transcripts
        .map((t) => `${t.speakerName}: ${t.content}`)
        .join('\n');

      // Generate summary based on type
      let summary: MeetingSummaryResult;

      switch (options.type) {
        case 'EXECUTIVE':
          summary = await this.generateExecutiveSummary(
            fullTranscript,
            meeting,
            options,
          );
          break;
        case 'DETAILED':
          summary = await this.generateDetailedSummary(
            fullTranscript,
            meeting,
            options,
          );
          break;
        case 'ACTION_ITEMS':
          summary = await this.generateActionItemsSummary(
            fullTranscript,
            meeting,
            options,
          );
          break;
        case 'KEY_DECISIONS':
          summary = await this.generateKeyDecisionsSummary(
            fullTranscript,
            meeting,
            options,
          );
          break;
        default:
          summary = await this.generateExecutiveSummary(
            fullTranscript,
            meeting,
            options,
          );
      }

      // Save summary to database
      await this.prisma.meetingSummary.create({
        data: {
          meetingId,
          type: options.type,
          content: summary.content,
          keyPoints: summary.keyPoints,
          participants: summary.participants,
          model: summary.model,
          tokensUsed: summary.tokensUsed,
        },
      });

      this.logger.log(
        `Summary generated successfully for meeting: ${meetingId}`,
      );
      return summary;
    } catch (error) {
      this.logger.error('Failed to generate meeting summary', error);
      throw error;
    }
  }

  private async generateExecutiveSummary(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): Promise<MeetingSummaryResult> {
    const prompt = this.buildExecutiveSummaryPrompt(
      transcript,
      meeting,
      options,
    );

    const response = await this.openAIService.generateCompletion(prompt, {
      model: 'gpt-4',
      maxTokens: options.maxLength || 1000,
      temperature: 0.3,
    });

    return this.parseSummaryResponse(response, meeting, 'gpt-4');
  }

  private async generateDetailedSummary(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): Promise<MeetingSummaryResult> {
    const prompt = this.buildDetailedSummaryPrompt(
      transcript,
      meeting,
      options,
    );

    const response = await this.openAIService.generateCompletion(prompt, {
      model: 'gpt-4',
      maxTokens: options.maxLength || 2000,
      temperature: 0.3,
    });

    return this.parseSummaryResponse(response, meeting, 'gpt-4');
  }

  private async generateActionItemsSummary(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): Promise<MeetingSummaryResult> {
    const prompt = this.buildActionItemsPrompt(transcript, meeting, options);

    const response = await this.openAIService.generateCompletion(prompt, {
      model: 'gpt-4',
      maxTokens: options.maxLength || 1500,
      temperature: 0.2,
    });

    return this.parseSummaryResponse(response, meeting, 'gpt-4');
  }

  private async generateKeyDecisionsSummary(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): Promise<MeetingSummaryResult> {
    const prompt = this.buildKeyDecisionsPrompt(transcript, meeting, options);

    const response = await this.openAIService.generateCompletion(prompt, {
      model: 'gpt-4',
      maxTokens: options.maxLength || 1500,
      temperature: 0.2,
    });

    return this.parseSummaryResponse(response, meeting, 'gpt-4');
  }

  private buildExecutiveSummaryPrompt(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): string {
    const participants = meeting.participants
      .map((p: any) => p.user?.name || p.name)
      .join(', ');

    return `
Please generate a ${options.style} executive summary of the following meeting transcript.

Meeting Title: ${meeting.title}
Meeting Date: ${meeting.startTime}
Participants: ${participants}
Duration: ${meeting.duration || 'Unknown'} minutes

Format the summary as follows:
1. Overview (2-3 sentences)
2. Key Points (bullet points)
3. Decisions Made
4. Next Steps

Transcript:
${transcript}

Please provide a clear, professional summary that captures the essential information from this meeting.
    `.trim();
  }

  private buildDetailedSummaryPrompt(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): string {
    console.log('Building detailed summary prompt', meeting, options);
    const participants = meeting.participants
      .map((p: any) => p.user?.name || p.name)
      .join(', ');

    return `
Please generate a detailed summary of the following meeting transcript.

Meeting Title: ${meeting.title}
Meeting Date: ${meeting.startTime}
Participants: ${participants}
Duration: ${meeting.duration || 'Unknown'} minutes

Include the following sections:
1. Meeting Overview
2. Key Discussion Points (detailed)
3. Decisions Made
4. Action Items
5. Concerns or Issues Raised
6. Next Steps
7. Follow-up Required

Transcript:
${transcript}

Please provide a comprehensive summary that captures all important aspects of the discussion.
    `.trim();
  }

  private buildActionItemsPrompt(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): string {
    console.log('Building action items prompt', meeting, options);
    return `
Please extract all action items from the following meeting transcript.

Meeting Title: ${meeting.title}
Meeting Date: ${meeting.startTime}

For each action item, identify:
1. What needs to be done
2. Who is responsible (if mentioned)
3. When it should be completed (if mentioned)
4. Priority level (high/medium/low based on context)

Format as:
- Action: [description]
  Assignee: [name or "Not specified"]
  Due Date: [date or "Not specified"]
  Priority: [High/Medium/Low]

Transcript:
${transcript}

Only include clear, actionable tasks that were explicitly discussed or implied in the meeting.
    `.trim();
  }

  private buildKeyDecisionsPrompt(
    transcript: string,
    meeting: any,
    options: SummaryOptions,
  ): string {
    console.log('Building key decisions prompt', meeting, options);
    return `
Please identify all key decisions made during the following meeting.

Meeting Title: ${meeting.title}
Meeting Date: ${meeting.startTime}

For each decision, include:
1. What was decided
2. Who made the decision (if clear)
3. Context or reasoning (if provided)
4. Impact or implications

Format as:
- Decision: [what was decided]
  Decision Maker: [name or "Team/Group"]
  Reasoning: [context]
  Impact: [implications]

Transcript:
${transcript}

Focus only on concrete decisions that were finalized during the meeting.
    `.trim();
  }

  private parseSummaryResponse(
    response: string,
    meeting: any,
    model: string,
  ): MeetingSummaryResult {
    // Extract key points from the response
    const keyPointsMatch = response.match(
      /(?:Key Points?|Key Discussion Points?):\s*((?:[\s\S]*?)(?=\n\n|\n[A-Z]|\n\d+\.|$))/i,
    );
    const keyPointsText = keyPointsMatch ? keyPointsMatch[1] : '';

    const keyPoints = keyPointsText
      .split('\n')
      .filter(
        (line) =>
          line.trim().startsWith('-') ||
          line.trim().startsWith('•') ||
          line.trim().match(/^\d+\./),
      )
      .map((line) => line.replace(/^[-•\d\.\s]+/, '').trim())
      .filter((point) => point.length > 0);

    const participants = meeting.participants.map(
      (p: any) => p.user?.name || p.name,
    );

    return {
      content: response,
      keyPoints:
        keyPoints.length > 0 ? keyPoints : ['Summary generated successfully'],
      participants,
      tokensUsed: Math.ceil(response.length / 4), // Rough token estimation
      model,
    };
  }

  async updateSummary(summaryId: string, content: string): Promise<void> {
    await this.prisma.meetingSummary.update({
      where: { id: summaryId },
      data: {
        content,
        generatedAt: new Date(),
      },
    });
  }

  async getSummariesByMeeting(meetingId: string): Promise<any[]> {
    return this.prisma.meetingSummary.findMany({
      where: { meetingId },
      orderBy: { generatedAt: 'desc' },
    });
  }
}

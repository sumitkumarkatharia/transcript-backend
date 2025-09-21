// src/ai/analysis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { Priority, ActionItemStatus } from '@prisma/client';

export interface ActionItem {
  title: string;
  description?: string;
  assignedTo?: string;
  assignedToEmail?: string;
  dueDate?: Date;
  priority: Priority;
  sourceTimestamp?: number;
}

export interface Topic {
  name: string;
  mentions: number;
  sentiment?: number;
  keywords: string[];
  timeSpent?: number;
  relevanceScore?: number;
}

export interface SentimentResult {
  overall: number; // -1 to 1
  segments: Array<{
    text: string;
    sentiment: number;
    confidence: number;
    timestamp?: number;
  }>;
}

export interface AnalyticsResult {
  totalSpeakingTime: number;
  participantStats: any;
  interruptionCount: number;
  questionCount: number;
  overallSentiment?: number;
  engagementScore?: number;
  energyLevel?: number;
  topTopics: string[];
  actionItemCount: number;
  decisionCount: number;
  talkTimeDistribution: any;
  meetingPace?: number;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  async extractActionItems(meetingId: string): Promise<ActionItem[]> {
    try {
      this.logger.log(`Extracting action items for meeting: ${meetingId}`);

      const transcripts = await this.prisma.transcript.findMany({
        where: { meetingId },
        orderBy: { startTimestamp: 'asc' },
      });

      if (!transcripts.length) {
        return [];
      }

      const fullTranscript = transcripts
        .map((t) => `[${t.startTimestamp}s] ${t.speakerName}: ${t.content}`)
        .join('\n');

      const prompt = `
Analyze the following meeting transcript and extract all action items.

For each action item, provide:
1. A clear, actionable title
2. Brief description (if context is available)
3. Assigned person (if mentioned)
4. Due date (if mentioned)
5. Priority level (High/Medium/Low based on urgency and importance)
6. Timestamp when it was mentioned

Format as JSON array:
[
  {
    "title": "Action item title",
    "description": "Additional context",
    "assignedTo": "Person's name or null",
    "assignedToEmail": "email if mentioned or null",
    "dueDate": "YYYY-MM-DD or null",
    "priority": "HIGH|MEDIUM|LOW",
    "sourceTimestamp": 123.45
  }
]

Transcript:
${fullTranscript}

Only include clear, actionable tasks. Avoid vague or general statements.
      `;

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4',
        temperature: 0.2,
      });

      // Parse JSON response
      const actionItems = this.parseActionItemsResponse(response);

      // Save to database
      for (const item of actionItems) {
        await this.prisma.actionItem.create({
          data: {
            meetingId,
            title: item.title,
            description: item.description,
            assignedTo: item.assignedTo,
            assignedToEmail: item.assignedToEmail,
            dueDate: item.dueDate,
            priority: item.priority,
            status: 'OPEN',
            sourceTimestamp: item.sourceTimestamp,
          },
        });
      }

      this.logger.log(
        `Extracted ${actionItems.length} action items for meeting: ${meetingId}`,
      );
      return actionItems;
    } catch (error) {
      this.logger.error('Failed to extract action items', error);
      throw error;
    }
  }

  async analyzeSentiment(meetingId: string): Promise<SentimentResult> {
    try {
      this.logger.log(`Analyzing sentiment for meeting: ${meetingId}`);

      const transcripts = await this.prisma.transcript.findMany({
        where: { meetingId },
        orderBy: { startTimestamp: 'asc' },
      });

      if (!transcripts.length) {
        return { overall: 0, segments: [] };
      }

      const segments = [];
      let overallSentiment = 0;

      // Analyze sentiment for each transcript segment
      for (const transcript of transcripts) {
        const prompt = `
Analyze the sentiment of the following text. Respond with a JSON object containing:
- sentiment: a number between -1 (very negative) and 1 (very positive)
- confidence: a number between 0 and 1

Text: "${transcript.content}"

Respond only with the JSON object.
        `;

        const response = await this.openAIService.generateCompletion(prompt, {
          model: 'gpt-3.5-turbo',
          temperature: 0.1,
          maxTokens: 100,
        });

        try {
          const sentimentData = JSON.parse(response);
          segments.push({
            text: transcript.content,
            sentiment: sentimentData.sentiment || 0,
            confidence: sentimentData.confidence || 0.5,
            timestamp: transcript.startTimestamp,
          });
          overallSentiment += sentimentData.sentiment || 0;
        } catch (parseError) {
          this.logger.warn('Failed to parse sentiment response', parseError);
          segments.push({
            text: transcript.content,
            sentiment: 0,
            confidence: 0.5,
            timestamp: transcript.startTimestamp,
          });
        }
      }

      overallSentiment = overallSentiment / transcripts.length;

      this.logger.log(`Sentiment analysis completed for meeting: ${meetingId}`);
      return { overall: overallSentiment, segments };
    } catch (error) {
      this.logger.error('Failed to analyze sentiment', error);
      throw error;
    }
  }

  async extractTopics(meetingId: string): Promise<Topic[]> {
    try {
      this.logger.log(`Extracting topics for meeting: ${meetingId}`);

      const transcripts = await this.prisma.transcript.findMany({
        where: { meetingId },
        orderBy: { startTimestamp: 'asc' },
      });

      if (!transcripts.length) {
        return [];
      }

      const fullTranscript = transcripts.map((t) => t.content).join(' ');

      const prompt = `
Analyze the following meeting transcript and extract the main topics discussed.

For each topic, provide:
1. Topic name (2-4 words)
2. Number of times mentioned or referenced
3. Key keywords related to this topic
4. Estimated time spent discussing (as percentage of total)
5. Relevance score (0-1, how important this topic was to the meeting)

Format as JSON array:
[
  {
    "name": "Topic name",
    "mentions": 5,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "timeSpent": 15,
    "relevanceScore": 0.8
  }
]

Transcript:
${fullTranscript}

Focus on substantive topics, not procedural or small talk.
      `;

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4',
        temperature: 0.3,
      });

      const topics = this.parseTopicsResponse(response);

      // Save to database
      for (const topic of topics) {
        await this.prisma.meetingTopic.create({
          data: {
            meetingId,
            name: topic.name,
            mentions: topic.mentions,
            keywords: topic.keywords,
            timeSpent: topic.timeSpent,
            relevanceScore: topic.relevanceScore,
          },
        });
      }

      this.logger.log(
        `Extracted ${topics.length} topics for meeting: ${meetingId}`,
      );
      return topics;
    } catch (error) {
      this.logger.error('Failed to extract topics', error);
      throw error;
    }
  }

  async generateMeetingAnalytics(meetingId: string): Promise<AnalyticsResult> {
    try {
      this.logger.log(`Generating analytics for meeting: ${meetingId}`);

      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          participants: true,
          transcripts: true,
          actionItems: true,
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Calculate speaking time per participant
      const participantStats: any = {};
      let totalSpeakingTime = 0;

      for (const participant of meeting.participants) {
        participantStats[participant.name] = {
          speakingTime: participant.speakingTime || 0,
          percentage: 0,
        };
        totalSpeakingTime += participant.speakingTime || 0;
      }

      // Calculate percentages
      for (const [stats] of Object.entries(participantStats)) {
        (stats as any).percentage =
          totalSpeakingTime > 0
            ? ((stats as any).speakingTime / totalSpeakingTime) * 100
            : 0;
      }

      // Analyze transcript for additional metrics
      const fullTranscript = meeting.transcripts
        .map((t) => t.content)
        .join(' ');
      const questionCount = (fullTranscript.match(/\?/g) || []).length;
      const wordCount = fullTranscript.split(/\s+/).length;
      const meetingPace = meeting.duration ? wordCount / meeting.duration : 0;

      // Calculate engagement and energy (simplified)
      const engagementScore = Math.min(1, questionCount / 10); // Normalize to 0-1
      const energyLevel = Math.min(1, meetingPace / 200); // Normalize to 0-1

      // Get sentiment analysis
      const sentimentResult = await this.analyzeSentiment(meetingId);

      // Get top topics
      const topics = await this.extractTopics(meetingId);
      const topTopics = topics
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 5)
        .map((t) => t.name);

      const analytics: AnalyticsResult = {
        totalSpeakingTime,
        participantStats,
        interruptionCount: 0, // Would need more sophisticated analysis
        questionCount,
        overallSentiment: sentimentResult.overall,
        engagementScore,
        energyLevel,
        topTopics,
        actionItemCount: meeting.actionItems.length,
        decisionCount: 0, // Would need to analyze for decisions
        talkTimeDistribution: participantStats,
        meetingPace,
      };

      // Save analytics to database
      await this.prisma.meetingAnalytics.upsert({
        where: { meetingId },
        update: analytics,
        create: {
          meetingId,
          ...analytics,
        },
      });

      this.logger.log(`Analytics generated for meeting: ${meetingId}`);
      return analytics;
    } catch (error) {
      this.logger.error('Failed to generate analytics', error);
      throw error;
    }
  }

  async answerQuestion(question: string, meetingId: string): Promise<string> {
    try {
      const transcripts = await this.prisma.transcript.findMany({
        where: { meetingId },
        orderBy: { startTimestamp: 'asc' },
      });

      if (!transcripts.length) {
        return 'No transcript available for this meeting.';
      }

      const fullTranscript = transcripts
        .map((t) => `[${t.startTimestamp}s] ${t.speakerName}: ${t.content}`)
        .join('\n');

      const prompt = `
You are an AI assistant that answers questions based on the following meeting transcript.

Transcript:
${fullTranscript}

Question: ${question}

Provide a concise and accurate answer based on the transcript. If the answer is not present, respond with "The information is not available in the transcript."
        `;

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 300,
      });

      return response.trim();
    } catch (error) {
      this.logger.error('Failed to answer question', error);
      throw error;
    }
  }

  private parseActionItemsResponse(response: string): ActionItem[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const actionItems = JSON.parse(jsonMatch[0]);
      return actionItems.map((item: any) => ({
        title: item.title || 'Untitled Action Item',
        description: item.description || null,
        assignedTo: item.assignedTo || null,
        assignedToEmail: item.assignedToEmail || null,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        priority: this.validatePriority(item.priority),
        sourceTimestamp: item.sourceTimestamp || null,
      }));
    } catch (error) {
      this.logger.warn('Failed to parse action items response', error);
      return [];
    }
  }

  private parseTopicsResponse(response: string): Topic[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const topics = JSON.parse(jsonMatch[0]);
      return topics.map((topic: any) => ({
        name: topic.name || 'Unnamed Topic',
        mentions: topic.mentions || 1,
        keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
        timeSpent: topic.timeSpent || null,
        relevanceScore: topic.relevanceScore || 0.5,
      }));
    } catch (error) {
      this.logger.warn('Failed to parse topics response', error);
      return [];
    }
  }

  private validatePriority(priority: string): Priority {
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const upperPriority = priority?.toUpperCase();
    return validPriorities.includes(upperPriority)
      ? (upperPriority as Priority)
      : 'MEDIUM';
  }

  async updateActionItemStatus(
    actionItemId: string,
    status: ActionItemStatus,
  ): Promise<void> {
    await this.prisma.actionItem.update({
      where: { id: actionItemId },
      data: { status, updatedAt: new Date() },
    });
  }

  async getActionItemsByMeeting(meetingId: string): Promise<any[]> {
    return this.prisma.actionItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTopicsByMeeting(meetingId: string): Promise<any[]> {
    return this.prisma.meetingTopic.findMany({
      where: { meetingId },
      orderBy: { relevanceScore: 'desc' },
    });
  }
}

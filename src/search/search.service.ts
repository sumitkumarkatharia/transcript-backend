// src/search/search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../ai/openai.service';
import { SearchIndexType } from '@prisma/client';

export interface SearchResult {
  id: string;
  type: 'meeting' | 'transcript' | 'summary' | 'action_item';
  title: string;
  content: string;
  meetingId: string;
  meetingTitle: string;
  timestamp?: Date;
  score: number;
  highlights?: string[];
}

export interface SearchOptions {
  type?: SearchIndexType;
  meetingId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  async searchContent(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    try {
      this.logger.log(`Searching for: "${query}"`);

      // Generate embedding for semantic search
      const queryEmbedding = await this.openAIService.generateEmbedding(query);

      // Build search filters
      const where: any = {};

      if (options.type) {
        where.type = options.type;
      }

      if (options.meetingId) {
        where.meetingId = options.meetingId;
      }

      // Perform both text search and semantic search
      const [textResults, semanticResults] = await Promise.all([
        this.performTextSearch(query, where, options),
        this.performSemanticSearch(queryEmbedding, where, options),
      ]);

      // Combine and rank results
      const combinedResults = this.combineSearchResults(
        textResults,
        semanticResults,
      );

      // Apply final filters and sorting
      const filteredResults = combinedResults
        .filter((result) => {
          if (
            options.dateFrom &&
            result.timestamp &&
            result.timestamp < options.dateFrom
          ) {
            return false;
          }
          if (
            options.dateTo &&
            result.timestamp &&
            result.timestamp > options.dateTo
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(
          options.offset || 0,
          (options.offset || 0) + (options.limit || 20),
        );

      this.logger.log(`Found ${filteredResults.length} search results`);
      return filteredResults;
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  async searchMeetings(query: string, userId?: string): Promise<any[]> {
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (userId) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [
            { hostId: userId },
            {
              participants: {
                some: { userId },
              },
            },
          ],
        },
      ];
      delete where.OR;
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        host: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            participants: true,
            transcripts: true,
            actionItems: true,
          },
        },
      },
      orderBy: [{ startTime: 'desc' }],
      take: 20,
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
      orderBy: [{ meeting: { startTime: 'desc' } }, { startTimestamp: 'asc' }],
      take: 50,
    });
  }

  async answerQuestion(
    question: string,
    contextMeetingId?: string,
  ): Promise<string> {
    try {
      this.logger.log(`Answering question: "${question}"`);

      let context = '';

      if (contextMeetingId) {
        // Use specific meeting context
        const transcripts = await this.prisma.transcript.findMany({
          where: { meetingId: contextMeetingId },
          orderBy: { startTimestamp: 'asc' },
        });
        context = transcripts
          .map((t) => `${t.speakerName}: ${t.content}`)
          .join('\n');
      } else {
        // Search for relevant content across all meetings
        const searchResults = await this.searchContent(question, { limit: 10 });
        context = searchResults.map((r) => r.content).join('\n');
      }

      if (!context.trim()) {
        return "I don't have enough information to answer that question based on the available meeting data.";
      }

      const prompt = `
Based on the following meeting information, please answer the user's question accurately and helpfully.

Question: ${question}

Meeting Context:
${context}

Instructions:
- Provide a clear, direct answer based on the available information
- If the information is incomplete, acknowledge what you know and what you don't know
- Include relevant details and context from the meetings
- If referencing specific meetings or speakers, mention them
- Keep the response conversational but informative
      `;

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 1000,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to answer question', error);
      throw error;
    }
  }

  async indexContent(meetingId: string): Promise<void> {
    try {
      this.logger.log(`Indexing content for meeting: ${meetingId}`);

      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          transcripts: true,
          summaries: true,
          actionItems: true,
          topics: true,
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Index transcripts
      for (const transcript of meeting.transcripts) {
        const embedding = await this.openAIService.generateEmbedding(
          transcript.content,
        );

        await this.prisma.searchIndex.upsert({
          where: {
            meetingId_type: {
              meetingId,
              type: 'TRANSCRIPT',
            },
          },
          update: {
            content: transcript.content,
            metadata: {
              speakerName: transcript.speakerName,
              startTimestamp: transcript.startTimestamp,
              endTimestamp: transcript.endTimestamp,
              confidence: transcript.confidence,
            },
            embedding,
          },
          create: {
            meetingId,
            type: 'TRANSCRIPT',
            content: transcript.content,
            metadata: {
              speakerName: transcript.speakerName,
              startTimestamp: transcript.startTimestamp,
              endTimestamp: transcript.endTimestamp,
              confidence: transcript.confidence,
            },
            embedding,
          },
        });
      }

      // Index summaries
      for (const summary of meeting.summaries) {
        const embedding = await this.openAIService.generateEmbedding(
          summary.content,
        );

        await this.prisma.searchIndex.create({
          data: {
            meetingId,
            type: 'SUMMARY',
            content: summary.content,
            metadata: {
              type: summary.type,
              keyPoints: summary.keyPoints,
            },
            embedding,
          },
        });
      }

      // Index action items
      for (const actionItem of meeting.actionItems) {
        const content = `${actionItem.title} ${actionItem.description || ''}`;
        const embedding = await this.openAIService.generateEmbedding(content);

        await this.prisma.searchIndex.create({
          data: {
            meetingId,
            type: 'ACTION_ITEM',
            content,
            metadata: {
              title: actionItem.title,
              assignedTo: actionItem.assignedTo,
              priority: actionItem.priority,
              status: actionItem.status,
            },
            embedding,
          },
        });
      }

      this.logger.log(`Content indexed successfully for meeting: ${meetingId}`);
    } catch (error) {
      this.logger.error('Failed to index content', error);
      throw error;
    }
  }

  private async performTextSearch(
    query: string,
    where: any,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    // Search in meetings
    console.log('Performing text search for query:', query, where, options);
    const meetings = await this.prisma.meeting.findMany({
      where: {
        ...where,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    // Search in transcripts
    const transcripts = await this.prisma.transcript.findMany({
      where: {
        ...where,
        content: { contains: query, mode: 'insensitive' },
      },
      include: {
        meeting: {
          select: { id: true, title: true, startTime: true },
        },
      },
      take: 20,
    });

    const results: SearchResult[] = [];

    // Add meeting results
    meetings.forEach((meeting) => {
      results.push({
        id: meeting.id,
        type: 'meeting',
        title: meeting.title,
        content: meeting.description || meeting.title,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        timestamp: meeting.startTime,
        score: this.calculateTextScore(
          query,
          meeting.title + ' ' + (meeting.description || ''),
        ),
        highlights: this.extractHighlights(
          query,
          meeting.title + ' ' + (meeting.description || ''),
        ),
      });
    });

    // Add transcript results
    transcripts.forEach((transcript) => {
      results.push({
        id: transcript.id,
        type: 'transcript',
        title: `${transcript.speakerName} - ${transcript.meeting.title}`,
        content: transcript.content,
        meetingId: transcript.meetingId,
        meetingTitle: transcript.meeting.title,
        timestamp: transcript.meeting.startTime,
        score: this.calculateTextScore(query, transcript.content),
        highlights: this.extractHighlights(query, transcript.content),
      });
    });

    return results;
  }

  private async performSemanticSearch(
    embedding: number[],
    where: any,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    console.log('Extracting highlights for query:', embedding, where, options);

    // This would typically use a vector database like Pinecone or Weaviate
    // For now, we'll return empty results as this requires specialized infrastructure
    return [];
  }

  private combineSearchResults(
    textResults: SearchResult[],
    semanticResults: SearchResult[],
  ): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>();

    // Add text results
    textResults.forEach((result) => {
      combinedMap.set(result.id, result);
    });

    // Merge semantic results
    semanticResults.forEach((result) => {
      const existing = combinedMap.get(result.id);
      if (existing) {
        // Combine scores
        existing.score = Math.max(existing.score, result.score);
      } else {
        combinedMap.set(result.id, result);
      }
    });

    return Array.from(combinedMap.values());
  }

  private calculateTextScore(query: string, content: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let score = 0;
    let exactMatches = 0;

    queryTerms.forEach((term) => {
      if (contentLower.includes(term)) {
        score += 1;
        if (contentLower.includes(query.toLowerCase())) {
          exactMatches += 1;
        }
      }
    });

    // Boost exact phrase matches
    if (exactMatches > 0) {
      score *= 2;
    }

    return score / queryTerms.length;
  }

  private extractHighlights(
    query: string,
    content: string,
    maxLength = 150,
  ): string[] {
    console.log('Extracting highlights for query:', maxLength);
    const queryTerms = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];

    queryTerms.forEach((term) => {
      const index = content.toLowerCase().indexOf(term);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + term.length + 50);
        let highlight = content.substring(start, end);

        if (start > 0) highlight = '...' + highlight;
        if (end < content.length) highlight = highlight + '...';

        highlights.push(highlight);
      }
    });

    return highlights.slice(0, 3); // Limit to 3 highlights
  }
}

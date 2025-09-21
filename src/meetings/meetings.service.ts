// src/meetings/meetings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { BigBlueButtonService } from '../bigbluebutton/bbb.service';
import { MeetingBotService } from '../bigbluebutton/bot/meeting-bot.service';
import { CreateMeetingDto, UpdateMeetingDto } from './dto/meeting.dto';
import { Meeting, MeetingParticipant } from '@prisma/client';

export interface MeetingWithDetails extends Meeting {
  host: any;
  organization: any;
  participants: MeetingParticipant[];
  transcripts?: any[];
  summaries?: any[];
  actionItems?: any[];
  topics?: any[];
  analytics?: any;
  _count: {
    participants: number;
    transcripts: number;
    actionItems: number;
    summaries: number;
  };
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private prisma: PrismaService,
    private bbbService: BigBlueButtonService,
    private meetingBotService: MeetingBotService,
    @InjectQueue('meeting-processing') private meetingQueue: Queue,
  ) {}

  async create(
    createMeetingDto: CreateMeetingDto,
    hostId: string,
  ): Promise<Meeting> {
    try {
      // Generate BBB meeting details
      const bbbMeetingId = this.bbbService.generateMeetingID();
      const moderatorPassword = this.bbbService.generatePassword();
      const attendeePassword = this.bbbService.generatePassword();

      // Create BBB meeting
      const bbbMeeting = await this.bbbService.createMeeting({
        name: createMeetingDto.title,
        meetingID: bbbMeetingId,
        attendeePW: attendeePassword,
        moderatorPW: moderatorPassword,
        welcome:
          createMeetingDto.description ||
          `Welcome to ${createMeetingDto.title}!`,
        record: true,
        autoStartRecording: true,
        allowStartStopRecording: true,
        duration: createMeetingDto.duration || 120,
        maxParticipants: createMeetingDto.maxParticipants || 50,
      });
      if (!bbbMeeting) {
        throw new BadRequestException('Failed to create BBB meeting');
      }
      // Generate join URL
      const joinUrl = await this.bbbService.joinMeeting({
        fullName: 'Host',
        meetingID: bbbMeetingId,
        password: moderatorPassword,
      });

      // Create meeting in database
      const meeting = await this.prisma.meeting.create({
        data: {
          title: createMeetingDto.title,
          description: createMeetingDto.description,
          bbbMeetingId,
          bbbMeetingName: createMeetingDto.title,
          moderatorPassword,
          attendeePassword,
          joinUrl,
          startTime: createMeetingDto.startTime,
          duration: createMeetingDto.duration,
          status: 'SCHEDULED',
          hostId,
          organizationId: createMeetingDto.organizationId,
        },
        include: {
          host: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Meeting created: ${meeting.id} (BBB: ${bbbMeetingId})`);

      // Schedule bot to join meeting if auto-join is enabled
      if (createMeetingDto.autoJoinBot) {
        await this.scheduleBot(meeting.id);
      }

      return meeting;
    } catch (error) {
      this.logger.error('Failed to create meeting', error);
      throw new BadRequestException('Failed to create meeting');
    }
  }

  async findAll(
    organizationId?: string,
    userId?: string,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (userId) {
      where.OR = [
        { hostId: userId },
        {
          participants: {
            some: { userId },
          },
        },
      ];
    }

    const [meetings, total] = await Promise.all([
      this.prisma.meeting.findMany({
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
              summaries: true,
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return {
      meetings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<MeetingWithDetails> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        transcripts: {
          orderBy: { startTimestamp: 'asc' },
          take: 50, // Limit for performance
        },
        summaries: {
          orderBy: { generatedAt: 'desc' },
        },
        actionItems: {
          orderBy: { createdAt: 'desc' },
        },
        topics: {
          orderBy: { mentions: 'desc' },
        },
        analytics: true,
        _count: {
          select: {
            participants: true,
            transcripts: true,
            actionItems: true,
            summaries: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }

    return meeting;
  }

  async update(
    id: string,
    updateMeetingDto: UpdateMeetingDto,
  ): Promise<Meeting> {
    const existingMeeting = await this.findOne(id);
    if (!existingMeeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }
    try {
      const meeting = await this.prisma.meeting.update({
        where: { id },
        data: updateMeetingDto,
        include: {
          host: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Meeting updated: ${id}`);
      return meeting;
    } catch (error) {
      this.logger.error('Failed to update meeting', error);
      throw new BadRequestException('Failed to update meeting');
    }
  }

  async remove(id: string): Promise<void> {
    const meeting = await this.findOne(id);

    try {
      // End BBB meeting if it's running
      if (meeting.status === 'LIVE') {
        try {
          await this.bbbService.endMeeting(
            meeting.bbbMeetingId,
            meeting.moderatorPassword,
          );
        } catch (error) {
          this.logger.warn(
            'Failed to end BBB meeting, continuing with deletion',
            error,
          );
        }
      }

      // Remove bot if active
      if (meeting.botJoined) {
        try {
          await this.meetingBotService.leaveMeeting(meeting.bbbMeetingId);
        } catch (error) {
          this.logger.warn(
            'Failed to remove bot, continuing with deletion',
            error,
          );
        }
      }

      // Delete meeting from database
      await this.prisma.meeting.delete({
        where: { id },
      });

      this.logger.log(`Meeting deleted: ${id}`);
    } catch (error) {
      this.logger.error('Failed to delete meeting', error);
      throw new BadRequestException('Failed to delete meeting');
    }
  }

  async startMeeting(id: string): Promise<Meeting> {
    const meeting = await this.findOne(id);

    if (meeting.status !== 'SCHEDULED') {
      throw new BadRequestException('Meeting is not in scheduled status');
    }

    try {
      // Update meeting status
      const updatedMeeting = await this.prisma.meeting.update({
        where: { id },
        data: {
          status: 'LIVE',
          startTime: new Date(),
        },
      });

      // Start bot if auto-join is enabled
      if (!meeting.botJoined) {
        await this.startBot(id);
      }

      this.logger.log(`Meeting started: ${id}`);
      return updatedMeeting;
    } catch (error) {
      this.logger.error('Failed to start meeting', error);
      throw new BadRequestException('Failed to start meeting');
    }
  }

  async endMeeting(id: string): Promise<Meeting> {
    const meeting = await this.findOne(id);

    if (meeting.status !== 'LIVE') {
      throw new BadRequestException('Meeting is not live');
    }

    try {
      // End BBB meeting
      await this.bbbService.endMeeting(
        meeting.bbbMeetingId,
        meeting.moderatorPassword,
      );

      // Stop bot
      if (meeting.botJoined) {
        await this.meetingBotService.leaveMeeting(meeting.bbbMeetingId);
      }

      // Calculate duration
      const duration = Math.floor(
        (new Date().getTime() - meeting.startTime.getTime()) / 60000,
      );

      // Update meeting status
      const updatedMeeting = await this.prisma.meeting.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          endTime: new Date(),
          duration,
        },
      });

      // Queue post-meeting processing
      await this.meetingQueue.add('process-meeting-completion', {
        meetingId: id,
      });

      this.logger.log(`Meeting ended: ${id} (Duration: ${duration} minutes)`);
      return updatedMeeting;
    } catch (error) {
      this.logger.error('Failed to end meeting', error);
      throw new BadRequestException('Failed to end meeting');
    }
  }

  async joinMeeting(
    id: string,
    fullName: string,
    userId?: string,
  ): Promise<string> {
    const meeting = await this.findOne(id);

    try {
      // Generate join URL
      const joinUrl = await this.bbbService.joinMeeting({
        fullName,
        meetingID: meeting.bbbMeetingId,
        password: meeting.attendeePassword,
        userID: userId,
      });

      // Record participant if user is authenticated
      if (userId) {
        await this.addParticipant(id, userId, fullName);
      }

      this.logger.log(`Join URL generated for meeting: ${id}`);
      return joinUrl;
    } catch (error) {
      this.logger.error('Failed to generate join URL', error);
      throw new BadRequestException('Failed to join meeting');
    }
  }

  async addParticipant(
    meetingId: string,
    userId: string,
    name: string,
  ): Promise<MeetingParticipant> {
    try {
      const participant = await this.prisma.meetingParticipant.upsert({
        where: {
          meetingId_bbbUserId: {
            meetingId,
            bbbUserId: userId,
          },
        },
        update: {
          name,
          joinTime: new Date(),
        },
        create: {
          meetingId,
          userId,
          name,
          bbbUserId: userId,
          joinTime: new Date(),
        },
      });

      this.logger.log(`Participant added to meeting: ${meetingId}`);
      return participant;
    } catch (error) {
      this.logger.error('Failed to add participant', error);
      throw new BadRequestException('Failed to add participant');
    }
  }

  async getMeetingAnalytics(id: string): Promise<any> {
    const meeting = await this.findOne(id);

    if (!meeting.analytics) {
      throw new NotFoundException('Analytics not available for this meeting');
    }

    return meeting.analytics;
  }

  async getMeetingTranscripts(id: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [transcripts, total] = await Promise.all([
      this.prisma.transcript.findMany({
        where: { meetingId: id },
        orderBy: { startTimestamp: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.transcript.count({
        where: { meetingId: id },
      }),
    ]);

    return {
      transcripts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMeetingActionItems(id: string): Promise<any[]> {
    return this.prisma.actionItem.findMany({
      where: { meetingId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMeetingSummaries(id: string): Promise<any[]> {
    return this.prisma.meetingSummary.findMany({
      where: { meetingId: id },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async scheduleBot(meetingId: string): Promise<void> {
    await this.meetingQueue.add(
      'schedule-bot-join',
      {
        meetingId,
      },
      {
        delay: 2 * 60 * 1000, // Join 2 minutes after meeting creation
      },
    );
  }

  private async startBot(meetingId: string): Promise<void> {
    const meeting = await this.findOne(meetingId);

    await this.meetingBotService.joinMeetingAsBot({
      meetingId: meeting.bbbMeetingId,
      botName: 'Fireflies.ai Assistant',
      password: meeting.attendeePassword,
      enableAudioCapture: true,
      enableTranscription: true,
    });
  }

  async getMeetingRecordings(id: string): Promise<any[]> {
    const meeting = await this.findOne(id);

    try {
      const recordings = await this.bbbService.getRecordings(
        meeting.bbbMeetingId,
      );
      return recordings;
    } catch (error) {
      this.logger.error('Failed to get meeting recordings', error);
      return [];
    }
  }

  async searchMeetings(
    query: string,
    organizationId?: string,
    userId?: string,
  ) {
    const where: any = {
      AND: [
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    };

    if (organizationId) {
      where.AND.push({ organizationId });
    }

    if (userId) {
      where.AND.push({
        OR: [
          { hostId: userId },
          {
            participants: {
              some: { userId },
            },
          },
        ],
      });
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
            summaries: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 20,
    });
  }
}

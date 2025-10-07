// src/meetings/meetings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BigBlueButtonService } from '../bigbluebutton/bbb.service';
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
  ) {}

  async create(
    createMeetingDto: CreateMeetingDto,
    hostId: string,
  ): Promise<Meeting> {
    this.logger.log('=== Creating meeting ===');
    this.logger.log(`DTO: ${JSON.stringify(createMeetingDto)}`);
    this.logger.log(`Host ID: ${hostId}`);

    try {
      // Generate unique identifiers
      const bbbMeetingId = this.generateMeetingID();
      const moderatorPassword = this.generatePassword();
      const attendeePassword = this.generatePassword();
      let joinUrl = '';

      this.logger.log(`Generated BBB ID: ${bbbMeetingId}`);

      // Try to create BBB meeting (with fallback if service is unavailable)
      try {
        const bbbMeetingData = {
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
        };

        this.logger.log('Creating BBB meeting with data:', bbbMeetingData);
        const bbbMeeting = await this.bbbService.createMeeting(bbbMeetingData);

        if (bbbMeeting) {
          this.logger.log('BBB meeting created successfully');

          // Generate join URL
          joinUrl = await this.bbbService.joinMeeting({
            fullName: 'Host',
            meetingID: bbbMeetingId,
            password: moderatorPassword,
          });
          this.logger.log(`Join URL generated: ${joinUrl}`);
        } else {
          this.logger.warn(
            'BBB meeting creation returned null, using fallback',
          );
          joinUrl = `${process.env.BBB_API_URL?.replace(
            '/api',
            '',
          )}/join/${bbbMeetingId}`;
        }
      } catch (bbbError) {
        this.logger.error(
          'BBB meeting creation failed, continuing with database creation:',
          bbbError.message,
        );
        joinUrl = `${
          process.env.BBB_API_URL?.replace('/api', '') ||
          'https://bbb.example.com'
        }/join/${bbbMeetingId}`;
      }

      // Validate required fields before database creation
      if (
        !createMeetingDto.title ||
        !createMeetingDto.organizationId ||
        !hostId
      ) {
        throw new BadRequestException(
          'Missing required fields: title, organizationId, or hostId',
        );
      }

      // Create meeting in database
      this.logger.log('Creating meeting in database...');
      const meeting = await this.prisma.meeting.create({
        data: {
          title: createMeetingDto.title.trim(),
          description: createMeetingDto.description?.trim() || null,
          bbbMeetingId,
          bbbMeetingName: createMeetingDto.title.trim(),
          moderatorPassword,
          attendeePassword,
          joinUrl,
          startTime: new Date(createMeetingDto.startTime),
          duration: createMeetingDto.duration || null,
          status: 'SCHEDULED',
          hostId,
          organizationId: createMeetingDto.organizationId,
          // Required fields with defaults
          audioFileUrl: null,
          recordingUrl: null,
          botJoined: false,
          botJoinedAt: null,
          botLeftAt: null,
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

      this.logger.log(
        `Meeting created successfully: ${meeting.id} (BBB: ${bbbMeetingId})`,
      );
      return meeting;
    } catch (error) {
      this.logger.error('Failed to create meeting:', error);

      // Log detailed error information
      if (error.code) {
        this.logger.error(`Database error code: ${error.code}`);
      }
      if (error.meta) {
        this.logger.error(`Database error meta: ${JSON.stringify(error.meta)}`);
      }

      // Throw with more specific error message
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to create meeting: ${error.message || 'Unknown error'}`,
      );
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
          take: 50,
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

    return meeting as MeetingWithDetails;
  }

  async update(
    id: string,
    updateMeetingDto: UpdateMeetingDto,
  ): Promise<Meeting> {
    const existingMeeting = await this.findOne(id);

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
      const updatedMeeting = await this.prisma.meeting.update({
        where: { id },
        data: {
          status: 'LIVE',
          startTime: new Date(),
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
      // Try to end BBB meeting
      try {
        await this.bbbService.endMeeting(
          meeting.bbbMeetingId,
          meeting.moderatorPassword,
        );
      } catch (error) {
        this.logger.warn(
          'Failed to end BBB meeting, continuing with status update',
          error,
        );
      }

      // Calculate duration
      const duration = Math.floor(
        (new Date().getTime() - meeting.startTime.getTime()) / 60000,
      );

      const updatedMeeting = await this.prisma.meeting.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          duration,
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
  ): Promise<{ joinUrl: string }> {
    const meeting = await this.findOne(id);

    try {
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
      return { joinUrl };
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

  async getMeetingRecordings(id: string): Promise<any[]> {
    const meeting = await this.findOne(id);

    try {
      const recordings = await this.bbbService.getRecordings(
        meeting.bbbMeetingId,
      );
      return recordings || [];
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

  // Helper methods
  private generateMeetingID(): string {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `meeting_${timestamp}_${randomStr}`;
  }

  private generatePassword(): string {
    return Math.random().toString(36).substr(2, 12);
  }

  // Debug method
  async debugBBBConnection(): Promise<any> {
    this.logger.log('=== BBB DEBUG INFO ===');
    this.logger.log('BBB_API_URL:', process.env.BBB_API_URL);
    this.logger.log('BBB_SECRET_KEY set:', !!process.env.BBB_SECRET_KEY);

    try {
      // Test BBB service methods
      const testId = this.generateMeetingID();
      const testPassword = this.generatePassword();

      this.logger.log('Test meeting ID generated:', testId);
      this.logger.log('Test password generated:', testPassword);

      return {
        status: 'success',
        bbb_url: process.env.BBB_API_URL,
        secret_key_set: !!process.env.BBB_SECRET_KEY,
        test_meeting_id: testId,
        test_password: testPassword,
      };
    } catch (error) {
      this.logger.error('BBB Debug Error:', error);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}

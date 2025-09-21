// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { User, UserSettings } from '@prisma/client';

export type UserWithSettings = User & {
  settings?: UserSettings;
  organization?: any;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createUserDto: CreateUserDto & { hashedPassword: string },
  ): Promise<User> {
    const { hashedPassword, ...userData } = createUserDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          hashedPassword,
          settings: {
            create: {
              emailSummaries: true,
              slackNotifications: false,
              realTimeAlerts: true,
              summaryStyle: 'concise',
              languages: ['en'],
              autoTranscription: true,
              calendarSync: false,
              crmSync: false,
              dataRetentionDays: 365,
              shareAnalytics: true,
            },
          },
        },
        include: {
          settings: true,
          organization: true,
        },
      });

      this.logger.log(`Created user: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async findAll(organizationId?: string): Promise<User[]> {
    const where = organizationId ? { organizationId } : {};

    return this.prisma.user.findMany({
      where,
      include: {
        settings: true,
        organization: true,
        _count: {
          select: {
            meetings: true,
            hostedMeetings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<UserWithSettings> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        organization: true,
        _count: {
          select: {
            meetings: true,
            hostedMeetings: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserWithSettings> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        settings: true,
        organization: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const existingUser = await this.findOne(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
        include: {
          settings: true,
          organization: true,
        },
      });

      this.logger.log(`Updated user: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to update user', error);
      throw new BadRequestException('Failed to update user');
    }
  }

  async updateSettings(
    id: string,
    settings: Partial<UserSettings>,
  ): Promise<UserSettings> {
    const existingUser = await this.findOne(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    try {
      const updatedSettings = await this.prisma.userSettings.upsert({
        where: { userId: id },
        update: settings,
        create: {
          userId: id,
          ...settings,
        },
      });

      this.logger.log(`Updated settings for user: ${id}`);
      return updatedSettings;
    } catch (error) {
      this.logger.error('Failed to update user settings', error);
      throw new BadRequestException('Failed to update user settings');
    }
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.findOne(id);

    try {
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`Deleted user: ${existingUser.email}`);
    } catch (error) {
      this.logger.error('Failed to delete user', error);
      throw new BadRequestException('Failed to delete user');
    }
  }

  async getUserMeetings(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where: {
          OR: [
            { hostId: userId },
            {
              participants: {
                some: { userId },
              },
            },
          ],
        },
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
        orderBy: {
          startTime: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.meeting.count({
        where: {
          OR: [
            { hostId: userId },
            {
              participants: {
                some: { userId },
              },
            },
          ],
        },
      }),
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

  async getUserAnalytics(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const meetings = await this.prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: userId },
          {
            participants: {
              some: { userId },
            },
          },
        ],
        startTime: {
          gte: startDate,
        },
        status: 'COMPLETED',
      },
      include: {
        analytics: true,
        participants: {
          where: { userId },
        },
        _count: {
          select: {
            actionItems: true,
            transcripts: true,
          },
        },
      },
    });

    const totalMeetings = meetings.length;
    const totalDuration = meetings.reduce(
      (sum, meeting) => sum + (meeting.duration || 0),
      0,
    );
    const totalSpeakingTime = meetings.reduce((sum, meeting) => {
      const participant = meeting.participants[0];
      return sum + (participant?.speakingTime || 0);
    }, 0);
    const totalActionItems = meetings.reduce(
      (sum, meeting) => sum + meeting._count.actionItems,
      0,
    );

    return {
      totalMeetings,
      totalDuration,
      totalSpeakingTime,
      totalActionItems,
      averageMeetingDuration:
        totalMeetings > 0 ? totalDuration / totalMeetings : 0,
      averageSpeakingTime:
        totalMeetings > 0 ? totalSpeakingTime / totalMeetings : 0,
      meetingsPerWeek: (totalMeetings / days) * 7,
    };
  }
}

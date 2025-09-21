// src/bigbluebutton/bbb.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import fetch from 'node-fetch';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto, JoinMeetingDto } from './dto/bbb.dto';

const parseXML = promisify(parseString);

export interface BBBMeetingInfo {
  meetingID: string;
  meetingName: string;
  createTime: string;
  voiceBridge: string;
  attendeePW: string;
  moderatorPW: string;
  running: boolean;
  participantCount: number;
  moderatorCount: number;
  hasUserJoined: boolean;
  hasBeenForciblyEnded: boolean;
  startTime?: string;
  endTime?: string;
  participants?: BBBParticipant[];
}

export interface BBBParticipant {
  userID: string;
  fullName: string;
  role: string;
  isPresenter: boolean;
  isListeningOnly: boolean;
  hasJoinedVoice: boolean;
  hasVideo: boolean;
  clientType: string;
}

export interface BBBRecording {
  recordID: string;
  meetingID: string;
  name: string;
  published: boolean;
  state: string;
  startTime: string;
  endTime: string;
  playback: {
    format: string;
    link: string;
    duration: number;
  }[];
}

@Injectable()
export class BigBlueButtonService {
  private readonly logger = new Logger(BigBlueButtonService.name);
  private readonly apiUrl: string;
  private readonly secretKey: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get('BBB_API_URL');
    this.secretKey = this.configService.get('BBB_SECRET_KEY');

    if (!this.apiUrl || !this.secretKey) {
      throw new Error('BigBlueButton configuration is missing');
    }
  }

  async createMeeting(
    createMeetingDto: CreateMeetingDto,
  ): Promise<BBBMeetingInfo> {
    const params = new URLSearchParams({
      name: createMeetingDto.name,
      meetingID: createMeetingDto.meetingID,
      attendeePW: createMeetingDto.attendeePW,
      moderatorPW: createMeetingDto.moderatorPW,
      welcome:
        createMeetingDto.welcome || `Welcome to ${createMeetingDto.name}!`,
      dialNumber: '',
      voiceBridge: createMeetingDto.voiceBridge || '0',
      maxParticipants: createMeetingDto.maxParticipants?.toString() || '0',
      logoutURL: createMeetingDto.logoutURL || '',
      record: createMeetingDto.record ? 'true' : 'false',
      duration: createMeetingDto.duration?.toString() || '0',
      isBreakout: 'false',
      moderatorOnlyMessage: createMeetingDto.moderatorOnlyMessage || '',
      autoStartRecording: createMeetingDto.autoStartRecording
        ? 'true'
        : 'false',
      allowStartStopRecording: createMeetingDto.allowStartStopRecording
        ? 'true'
        : 'false',
      webcamsOnlyForModerator: 'false',
      logo: '',
      bannerText: '',
      bannerColor: '#FFFFFF',
      copyright: '',
      muteOnStart: 'false',
      allowModsToUnmuteUsers: 'true',
      lockSettingsDisablePrivateChat: 'false',
      lockSettingsDisablePublicChat: 'false',
      lockSettingsDisableNote: 'false',
      lockSettingsHideUserList: 'false',
      lockSettingsLockedLayout: 'false',
      lockSettingsLockOnJoin: 'true',
      lockSettingsLockOnJoinConfigurable: 'false',
      guestPolicy: 'ALWAYS_ACCEPT',
    });

    try {
      const response = await this.makeAPICall('create', params);

      if (response.returncode !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to create meeting: ${response.message}`,
        );
      }

      this.logger.log(
        `Meeting created successfully: ${createMeetingDto.meetingID}`,
      );

      return {
        meetingID: response.meetingID,
        meetingName: response.meetingName,
        createTime: response.createTime,
        voiceBridge: response.voiceBridge,
        attendeePW: response.attendeePW,
        moderatorPW: response.moderatorPW,
        running: false,
        participantCount: 0,
        moderatorCount: 0,
        hasUserJoined: false,
        hasBeenForciblyEnded: false,
      };
    } catch (error) {
      this.logger.error('Failed to create BBB meeting', error);
      throw new BadRequestException('Failed to create meeting');
    }
  }

  async joinMeeting(joinMeetingDto: JoinMeetingDto): Promise<string> {
    const params = new URLSearchParams({
      fullName: joinMeetingDto.fullName,
      meetingID: joinMeetingDto.meetingID,
      password: joinMeetingDto.password,
      createTime: '',
      userID: joinMeetingDto.userID || '',
      webVoiceConf: '',
      configToken: '',
      defaultLayout: '',
      avatarURL: joinMeetingDto.avatarURL || '',
      redirect: 'true',
      clientURL: '',
      joinViaHtml5: 'true',
      guest: 'false',
    });

    const joinURL = this.buildAPICall('join', params);

    this.logger.log(
      `Generated join URL for meeting: ${joinMeetingDto.meetingID}`,
    );

    return joinURL;
  }

  async getMeetingInfo(
    meetingID: string,
    password: string,
  ): Promise<BBBMeetingInfo> {
    const params = new URLSearchParams({
      meetingID,
      password,
    });

    try {
      const response = await this.makeAPICall('getMeetingInfo', params);

      if (response.returncode !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to get meeting info: ${response.message}`,
        );
      }

      const participants = response.attendees?.attendee
        ? Array.isArray(response.attendees.attendee)
          ? response.attendees.attendee
          : [response.attendees.attendee]
        : [];

      return {
        meetingID: response.meetingID,
        meetingName: response.meetingName,
        createTime: response.createTime,
        voiceBridge: response.voiceBridge,
        attendeePW: response.attendeePW,
        moderatorPW: response.moderatorPW,
        running: response.running === 'true',
        participantCount: parseInt(response.participantCount) || 0,
        moderatorCount: parseInt(response.moderatorCount) || 0,
        hasUserJoined: response.hasUserJoined === 'true',
        hasBeenForciblyEnded: response.hasBeenForciblyEnded === 'true',
        startTime: response.startTime,
        endTime: response.endTime,
        participants: participants.map((p: any) => ({
          userID: p.userID,
          fullName: p.fullName,
          role: p.role,
          isPresenter: p.isPresenter === 'true',
          isListeningOnly: p.isListeningOnly === 'true',
          hasJoinedVoice: p.hasJoinedVoice === 'true',
          hasVideo: p.hasVideo === 'true',
          clientType: p.clientType,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get BBB meeting info', error);
      throw new BadRequestException('Failed to get meeting info');
    }
  }

  async endMeeting(meetingID: string, password: string): Promise<void> {
    const params = new URLSearchParams({
      meetingID,
      password,
    });

    try {
      const response = await this.makeAPICall('end', params);

      if (response.returncode !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to end meeting: ${response.message}`,
        );
      }

      this.logger.log(`Meeting ended successfully: ${meetingID}`);
    } catch (error) {
      this.logger.error('Failed to end BBB meeting', error);
      throw new BadRequestException('Failed to end meeting');
    }
  }

  async getRecordings(meetingID?: string): Promise<BBBRecording[]> {
    const params = new URLSearchParams();
    if (meetingID) {
      params.append('meetingID', meetingID);
    }

    try {
      const response = await this.makeAPICall('getRecordings', params);

      if (response.returncode !== 'SUCCESS') {
        if (response.messageKey === 'noRecordings') {
          return [];
        }
        throw new BadRequestException(
          `Failed to get recordings: ${response.message}`,
        );
      }

      const recordings = response.recordings?.recording
        ? Array.isArray(response.recordings.recording)
          ? response.recordings.recording
          : [response.recordings.recording]
        : [];

      return recordings.map((r: any) => ({
        recordID: r.recordID,
        meetingID: r.meetingID,
        name: r.name,
        published: r.published === 'true',
        state: r.state,
        startTime: r.startTime,
        endTime: r.endTime,
        playback: Array.isArray(r.playback?.format)
          ? r.playback.format
          : r.playback?.format
            ? [r.playback.format]
            : [],
      }));
    } catch (error) {
      this.logger.error('Failed to get BBB recordings', error);
      throw new BadRequestException('Failed to get recordings');
    }
  }

  async publishRecording(recordID: string, publish: boolean): Promise<void> {
    const params = new URLSearchParams({
      recordID,
      publish: publish ? 'true' : 'false',
    });

    try {
      const response = await this.makeAPICall('publishRecordings', params);

      if (response.returncode !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to publish recording: ${response.message}`,
        );
      }

      this.logger.log(
        `Recording ${publish ? 'published' : 'unpublished'}: ${recordID}`,
      );
    } catch (error) {
      this.logger.error('Failed to publish BBB recording', error);
      throw new BadRequestException('Failed to publish recording');
    }
  }

  async deleteRecording(recordID: string): Promise<void> {
    const params = new URLSearchParams({
      recordID,
    });

    try {
      const response = await this.makeAPICall('deleteRecordings', params);

      if (response.returncode !== 'SUCCESS') {
        throw new BadRequestException(
          `Failed to delete recording: ${response.message}`,
        );
      }

      this.logger.log(`Recording deleted: ${recordID}`);
    } catch (error) {
      this.logger.error('Failed to delete BBB recording', error);
      throw new BadRequestException('Failed to delete recording');
    }
  }

  private async makeAPICall(
    endpoint: string,
    params: URLSearchParams,
  ): Promise<any> {
    const apiCall = this.buildAPICall(endpoint, params);

    const response = await fetch(apiCall);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlData = await response.text();
    const result = await parseXML(xmlData);

    return result;
  }

  private buildAPICall(endpoint: string, params: URLSearchParams): string {
    const queryString = params.toString();
    const checksumString = endpoint + queryString + this.secretKey;
    const checksum = createHash('sha1').update(checksumString).digest('hex');

    return `${this.apiUrl}/${endpoint}?${queryString}&checksum=${checksum}`;
  }

  generateMeetingID(): string {
    return `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generatePassword(): string {
    return Math.random().toString(36).substr(2, 10);
  }
}

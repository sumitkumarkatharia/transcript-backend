import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { MeetingsService } from './meetings.service';

interface SocketWithAuth extends Socket {
  user?: any;
  meetingId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'meetings',
})
export class MeetingsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingsGateway.name);
  private connectedUsers = new Map<string, SocketWithAuth>();
  private meetingRooms = new Map<string, Set<string>>();

  constructor(private meetingsService: MeetingsService) {}

  async handleConnection(client: SocketWithAuth) {
    try {
      // Extract token from handshake auth
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      // Validate token and get user (simplified - in real app use JWT validation)
      // const user = await this.validateToken(token);
      // client.user = user;

      this.connectedUsers.set(client.id, client);
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error('Failed to authenticate client', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: SocketWithAuth) {
    this.connectedUsers.delete(client.id);

    // Remove from meeting room
    if (client.meetingId) {
      this.leaveMeetingRoom(client.id, client.meetingId);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_meeting')
  async handleJoinMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    try {
      const { meetingId } = data;

      // Validate meeting access
      const meeting = await this.meetingsService.findOne(meetingId);
      if (!meeting) {
        client.emit('error', { message: 'Meeting not found' });
        return;
      }

      // Join meeting room
      client.join(`meeting:${meetingId}`);
      client.meetingId = meetingId;

      // Track connected users in meeting
      if (!this.meetingRooms.has(meetingId)) {
        this.meetingRooms.set(meetingId, new Set());
      }
      this.meetingRooms.get(meetingId)!.add(client.id);

      // Notify others about user joining
      client.to(`meeting:${meetingId}`).emit('user_joined', {
        userId: client.user?.id,
        userName: client.user?.name,
        timestamp: new Date(),
      });

      // Send current meeting state
      client.emit('meeting_joined', {
        meetingId,
        status: meeting.status,
        participants: meeting.participants?.length || 0,
        timestamp: new Date(),
      });

      this.logger.log(`User joined meeting room: ${meetingId}`);
    } catch (error) {
      this.logger.error('Failed to join meeting', error);
      client.emit('error', { message: 'Failed to join meeting' });
    }
  }

  @SubscribeMessage('leave_meeting')
  handleLeaveMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    const { meetingId } = data;
    this.leaveMeetingRoom(client.id, meetingId);

    client.emit('meeting_left', { meetingId, timestamp: new Date() });
  }

  private leaveMeetingRoom(clientId: string, meetingId: string) {
    const client = this.connectedUsers.get(clientId);
    if (client) {
      client.leave(`meeting:${meetingId}`);
      client.meetingId = undefined;

      // Remove from meeting room tracking
      const room = this.meetingRooms.get(meetingId);
      if (room) {
        room.delete(clientId);
        if (room.size === 0) {
          this.meetingRooms.delete(meetingId);
        }
      }

      // Notify others about user leaving
      client.to(`meeting:${meetingId}`).emit('user_left', {
        userId: client.user?.id,
        userName: client.user?.name,
        timestamp: new Date(),
      });
    }
  }

  // Methods to emit events from services
  emitTranscriptUpdate(meetingId: string, transcript: any) {
    this.server.to(`meeting:${meetingId}`).emit('transcript_update', {
      meetingId,
      transcript,
      timestamp: new Date(),
    });
  }

  emitSummaryUpdate(meetingId: string, summary: any) {
    this.server.to(`meeting:${meetingId}`).emit('summary_update', {
      meetingId,
      summary,
      timestamp: new Date(),
    });
  }

  emitActionItemUpdate(meetingId: string, actionItem: any) {
    this.server.to(`meeting:${meetingId}`).emit('action_item_update', {
      meetingId,
      actionItem,
      timestamp: new Date(),
    });
  }

  emitMeetingStatusUpdate(meetingId: string, status: string) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_status_update', {
      meetingId,
      status,
      timestamp: new Date(),
    });
  }

  emitParticipantUpdate(
    meetingId: string,
    participant: any,
    action: 'joined' | 'left',
  ) {
    this.server.to(`meeting:${meetingId}`).emit('participant_update', {
      meetingId,
      participant,
      action,
      timestamp: new Date(),
    });
  }

  getConnectedUsers(meetingId: string): number {
    return this.meetingRooms.get(meetingId)?.size || 0;
  }
}

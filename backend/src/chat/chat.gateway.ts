import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/auth.service';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  namespace: '/app',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('Chat socket connection rejected: no token');
      this.rejectUnauthorized(client);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }
      const userId = payload.sub;
      (client as any).userId = userId;
      await this.redisService.setUserPresence(userId, 'app', client.id);
      this.logger.log(`Chat client connected: ${client.id} (user: ${userId})`);
    } catch (error) {
      this.logger.warn('Chat socket connection rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: Socket) {
    void this.redisService.removeSocketPresence(client.id);
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:ride')
  async handleJoinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string },
  ) {
    const userId = (client as any).userId;
    await this.chatService.assertRideParticipant(userId, data.rideId);
    client.join(`ride:${data.rideId}`);
    (client as any).rideId = data.rideId;
    this.logger.log(`User ${userId} joined chat for ride ${data.rideId}`);
  }

  @SubscribeMessage('send:message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string; receiverType?: string },
  ) {
    try {
      const userId = (client as any).userId;
      const rideId = (client as any).rideId;
      
      if (!rideId) {
        client.emit('error', { message: 'Not joined to any ride room' });
        return;
      }
      
      const message = await this.chatService.sendMessage(userId, rideId, {
        content: data.content,
        receiverType: data.receiverType as any,
      });

      // Broadcast to ride room
      this.server.to(`ride:${rideId}`).emit('message:sent', message);

      this.logger.log(`Message sent from ${userId} in ride ${rideId}`);
    } catch (error) {
      this.logger.error(`Failed to send message:`, error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  private rejectUnauthorized(client: Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.service';
import { IntercityChatService, IntercityThreadType } from './intercity-chat.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  namespace: '/app',
  cors: {
    origin: '*',
  },
})
export class IntercityChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IntercityChatGateway.name);

  constructor(
    private readonly intercityChatService: IntercityChatService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    client.setMaxListeners(Math.max(client.getMaxListeners(), 30));
    const token = client.handshake.auth?.token;
    if (!token) {
      this.rejectUnauthorized(client);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }
      (client as any).userId = payload.sub;
      await this.redisService.setUserPresence(payload.sub, 'app', client.id);
      this.redisService.attachPresenceHeartbeat(client, payload.sub, 'app');
    } catch {
      this.logger.warn('Intercity chat socket rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: Socket) {
    this.redisService.clearPresenceHeartbeat(client);
    void this.redisService.removeSocketPresence(client.id).catch(() => null);
    this.logger.log(`Intercity chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:intercity-thread')
  async handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadType: IntercityThreadType; threadId: string },
  ) {
    const userId = (client as any).userId;
    await this.intercityChatService.assertParticipant(userId, data.threadType, data.threadId);
    const room = `${data.threadType}:${data.threadId}`;
    client.join(room);
    (client as any).threadRoom = room;
  }

  @SubscribeMessage('send:intercity-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadType: IntercityThreadType; threadId: string; content: string },
  ) {
    try {
      const userId = (client as any).userId;
      const message = await this.intercityChatService.sendMessage(
        userId,
        data.threadType,
        data.threadId,
        data.content,
      );
      this.server
        .to(`${data.threadType}:${data.threadId}`)
        .emit('intercity-message:sent', message);
    } catch {
      client.emit('error', { message: 'Failed to send intercity message' });
    }
  }

  private rejectUnauthorized(client: Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

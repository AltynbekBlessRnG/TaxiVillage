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
import { Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Socket;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('Chat socket connection rejected: no token');
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;
      (client as any).userId = userId;
      this.logger.log(`Chat client connected: ${client.id} (user: ${userId})`);
    } catch (error) {
      this.logger.warn('Chat socket connection rejected: invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:ride')
  async handleJoinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string },
  ) {
    const userId = (client as any).userId;
    client.join(`ride:${data.rideId}`);
    (client as any).rideId = data.rideId;
    this.logger.log(`User ${userId} joined chat for ride ${data.rideId}`);
  }

  @SubscribeMessage('send:message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string; receiverId: string; receiverType: string },
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
        receiverId: data.receiverId,
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
}

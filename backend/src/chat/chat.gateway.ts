import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard('jwt'))
  async handleConnection(client: ConnectedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @OnGatewayDisconnect()
  handleDisconnect(client: ConnectedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:ride')
  async handleJoinRide(
    client: ConnectedSocket,
    @MessageBody() data: { rideId: string },
  ) {
    client.join(`ride:${data.rideId}`);
    this.logger.log(`Client ${client.id} joined ride ${data.rideId}`);
  }

  @SubscribeMessage('send:message')
  async handleSendMessage(
    client: ConnectedSocket,
    @MessageBody() data: { content: string; receiverId: string; receiverType: string },
  ) {
    try {
      const userId = client.data.userId; // Set by AuthGuard
      const rideId = client.data.rideId; // Set when joining ride room
      
      await this.chatService.sendMessage(userId, rideId, {
        content: data.content,
        receiverId: data.receiverId,
        receiverType: data.receiverType as any,
      });

      // Broadcast to ride room
      client.to(`ride:${rideId}`).emit('message:sent', {
        id: Date.now().toString(),
        senderId: userId,
        senderType: data.receiverType === 'PASSENGER' ? 'DRIVER' : 'PASSENGER',
        receiverId: data.receiverId,
        receiverType: data.receiverType,
        content: data.content,
        createdAt: new Date().toISOString(),
      });

      this.logger.log(`Message sent from ${userId} in ride ${rideId}`);
    } catch (error) {
      this.logger.error(`Failed to send message:`, error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }
}

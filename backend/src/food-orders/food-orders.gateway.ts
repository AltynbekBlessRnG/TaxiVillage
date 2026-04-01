import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ForbiddenException, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';

interface FoodOrderPayload {
  id: string;
  passenger?: { userId: string };
  merchant?: { userId: string };
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: '/app',
  cors: { origin: '*' },
})
export class FoodOrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FoodOrdersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: import('socket.io').Socket) {
    client.setMaxListeners(Math.max(client.getMaxListeners(), 30));
    const token = client.handshake.auth?.token;
    if (!token) {
      this.rejectUnauthorized(client);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.tokenType !== 'access') {
        throw new ForbiddenException('Invalid token type');
      }
      const userId = payload.sub;
      await client.join(`user:${userId}`);
      (client as any).userId = userId;
      await this.redisService.setUserPresence(userId, 'app', client.id);
    } catch {
      this.logger.warn('Food socket connection rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: import('socket.io').Socket) {
    void this.redisService.removeSocketPresence(client.id).catch(() => null);
    this.logger.log(`Food socket client ${client.id} disconnected`);
  }

  @SubscribeMessage('join:food-order')
  async handleJoinOrder(client: import('socket.io').Socket, orderId: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: { passenger: true, merchant: true },
    });

    const userId = (client as any).userId;
    const isParticipant =
      !!order && (order.passenger?.userId === userId || order.merchant?.userId === userId);

    if (!isParticipant) {
      client.emit('error', { message: 'Access denied to food order room' });
      return;
    }

    await client.join(`food-order:${orderId}`);
  }

  emitOrderCreated(order: FoodOrderPayload) {
    if (order.passenger?.userId) {
      this.server.to(`user:${order.passenger.userId}`).emit('food-order:created', order);
    }
    if (order.merchant?.userId) {
      this.server.to(`user:${order.merchant.userId}`).emit('food-order:created', order);
    }
  }

  emitOrderUpdated(order: FoodOrderPayload) {
    if (order.passenger?.userId) {
      this.server.to(`user:${order.passenger.userId}`).emit('food-order:updated', order);
    }
    if (order.merchant?.userId) {
      this.server.to(`user:${order.merchant.userId}`).emit('food-order:updated', order);
    }
    this.server.to(`food-order:${order.id}`).emit('food-order:updated', order);
  }

  private rejectUnauthorized(client: import('socket.io').Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

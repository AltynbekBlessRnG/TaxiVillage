import {
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';

interface CourierOrderPayload {
  id: string;
  status: string;
  passenger?: { userId: string };
  courier?: { userId: string };
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: '/app',
  cors: { origin: '*' },
})
export class CourierOrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CourierOrdersGateway.name);

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
      this.redisService.attachPresenceHeartbeat(client, userId, 'app');
    } catch {
      this.logger.warn('Courier socket connection rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: import('socket.io').Socket) {
    this.redisService.clearPresenceHeartbeat(client);
    void this.redisService.removeSocketPresence(client.id).catch(() => null);
    this.logger.log(`Courier socket client ${client.id} disconnected`);
  }

  @SubscribeMessage('join:courier-order')
  async handleJoinOrder(client: import('socket.io').Socket, orderId: string) {
    const order = await this.prisma.courierOrder.findUnique({
      where: { id: orderId },
      include: { passenger: true, courier: true },
    });
    const userId = (client as any).userId;
    const isParticipant =
      !!order &&
      (order.passenger?.userId === userId || order.courier?.userId === userId);

    if (!isParticipant) {
      client.emit('error', { message: 'Access denied to courier order room' });
      return;
    }

    await client.join(`courier-order:${orderId}`);
  }

  emitOrderCreated(order: CourierOrderPayload) {
    if (order.passenger?.userId) {
      this.server.to(`user:${order.passenger.userId}`).emit('courier-order:created', order);
    }
    if (order.courier?.userId) {
      this.server.to(`user:${order.courier.userId}`).emit('courier-order:created', order);
    }
  }

  emitOrderUpdated(order: CourierOrderPayload) {
    if (order.passenger?.userId) {
      this.server.to(`user:${order.passenger.userId}`).emit('courier-order:updated', order);
    }
    if (order.courier?.userId) {
      this.server.to(`user:${order.courier.userId}`).emit('courier-order:updated', order);
    }
    this.server.to(`courier-order:${order.id}`).emit('courier-order:updated', order);
  }

  emitOrderUpdatedToUser(userId: string, order: CourierOrderPayload) {
    this.server.to(`user:${userId}`).emit('courier-order:updated', order);
  }

  emitCourierOffer(courierUserId: string, order: CourierOrderPayload) {
    this.server.to(`user:${courierUserId}`).emit('courier-order:offer', order);
  }

  emitCourierMoved(orderId: string, lat: number, lng: number) {
    this.server.to(`courier-order:${orderId}`).emit('courier:moved', { orderId, lat, lng });
  }

  private rejectUnauthorized(client: import('socket.io').Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

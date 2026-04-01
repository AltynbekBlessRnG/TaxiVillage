import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface RidePayload {
  id: string;
  status: string;
  passengerId: string;
  driverId?: string;
  passenger?: { userId: string };
  driver?: { userId: string };
  estimatedPrice?: unknown;
  finalPrice?: unknown;
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: '/app',
  cors: { origin: '*' },
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RidesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: import('socket.io').Socket) {
    client.setMaxListeners(Math.max(client.getMaxListeners(), 30));
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('Socket connection rejected: no token');
      this.rejectUnauthorized(client);
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.tokenType !== 'access') {
        throw new ForbiddenException('Invalid token type');
      }
      const userId = payload.sub;
      const room = `user:${userId}`;
      await client.join(room);
      (client as any).userId = userId;
      await this.redisService.setUserPresence(userId, 'app', client.id);
      this.logger.log(`Client ${client.id} joined room ${room}`);
    } catch {
      this.logger.warn('Socket connection rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: import('socket.io').Socket) {
    void this.redisService.removeSocketPresence(client.id).catch(() => null);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join:ride')
  async handleJoinRide(client: import('socket.io').Socket, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: true,
        driver: true,
      },
    });
    const userId = (client as any).userId;
    const isParticipant =
      !!ride &&
      (ride.passenger?.userId === userId || ride.driver?.userId === userId);
    if (!isParticipant) {
      client.emit('error', { message: 'Access denied to ride room' });
      return;
    }
    const room = `ride:${rideId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  emitRideCreated(ride: RidePayload) {
    const rooms: string[] = [];
    if (ride.passenger?.userId) {
      rooms.push(`user:${ride.passenger.userId}`);
    }
    if (ride.driver?.userId) {
      rooms.push(`user:${ride.driver.userId}`);
    }
    for (const room of rooms) {
      this.server.to(room).emit('ride:created', ride);
    }
  }

  emitRideUpdated(ride: RidePayload) {
    const rooms: string[] = [];
    if (ride.passenger?.userId) {
      rooms.push(`user:${ride.passenger.userId}`);
    }
    if (ride.driver?.userId) {
      rooms.push(`user:${ride.driver.userId}`);
    }
    for (const room of rooms) {
      this.server.to(room).emit('ride:updated', ride);
    }
  }

  emitRideUpdatedToUser(userId: string, ride: RidePayload) {
    const room = `user:${userId}`;
    this.server.to(room).emit('ride:updated', ride);
  }

  emitDriverMoved(rideId: string, lat: number, lng: number) {
    const room = `ride:${rideId}`;
    this.server.to(room).emit('driver:moved', { rideId, lat, lng });
  }

  emitRideOffer(driverUserId: string, ride: RidePayload) {
    const room = `user:${driverUserId}`;
    this.server.to(room).emit('ride:offer', ride);
  }

  private rejectUnauthorized(client: import('socket.io').Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

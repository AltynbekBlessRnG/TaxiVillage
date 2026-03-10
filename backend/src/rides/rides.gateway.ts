import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/auth.service';

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
  namespace: '/rides',
  cors: { origin: '*' },
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RidesGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: import('socket.io').Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('Socket connection rejected: no token');
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;
      const room = `user:${userId}`;
      await client.join(room);
      (client as any).userId = userId;
      this.logger.log(`Client ${client.id} joined room ${room}`);
    } catch {
      this.logger.warn('Socket connection rejected: invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: import('socket.io').Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
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
}

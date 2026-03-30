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
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  namespace: '/app',
  cors: { origin: '*' },
})
export class IntercityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IntercityGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
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
      await client.join(`user:${payload.sub}`);
      await this.redisService.setUserPresence(payload.sub, 'app', client.id);
    } catch {
      this.logger.warn('Intercity socket rejected: invalid token');
      this.rejectUnauthorized(client);
    }
  }

  handleDisconnect(client: Socket) {
    void this.redisService.removeSocketPresence(client.id);
    this.logger.log(`Intercity client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:intercity-order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    await client.join(`intercity-order:${data.orderId}`);
  }

  @SubscribeMessage('join:intercity-booking')
  async handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    await client.join(`intercity-booking:${data.bookingId}`);
  }

  @SubscribeMessage('join:intercity-trip')
  async handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    await client.join(`intercity-trip:${data.tripId}`);
  }

  emitOrderUpdated(order: any) {
    this.server.to(`intercity-order:${order.id}`).emit('intercity-order:updated', order);
    if (order?.passenger?.userId) {
      this.server.to(`user:${order.passenger.userId}`).emit('intercity-order:updated', order);
    }
    if (order?.driver?.userId) {
      this.server.to(`user:${order.driver.userId}`).emit('intercity-order:updated', order);
    }
  }

  emitBookingUpdated(booking: any) {
    this.server.to(`intercity-booking:${booking.id}`).emit('intercity-booking:updated', booking);
    if (booking?.passenger?.user?.id) {
      this.server.to(`user:${booking.passenger.user.id}`).emit('intercity-booking:updated', booking);
    }
    if (booking?.trip?.driver?.user?.id) {
      this.server.to(`user:${booking.trip.driver.user.id}`).emit('intercity-booking:updated', booking);
    }
  }

  emitTripUpdated(trip: any) {
    this.server.to(`intercity-trip:${trip.id}`).emit('intercity-trip:updated', trip);
    if (trip?.driver?.user?.id) {
      this.server.to(`user:${trip.driver.user.id}`).emit('intercity-trip:updated', trip);
    }
  }

  private rejectUnauthorized(client: Socket) {
    client.emit('error', { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
    client.disconnect();
  }
}

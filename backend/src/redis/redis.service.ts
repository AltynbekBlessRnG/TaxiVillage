import {
  INestApplicationContext,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Socket } from 'socket.io';
import { SocketIoRedisAdapter } from './socket-io-redis.adapter';

type PresencePayload = {
  userId: string;
  namespace: string;
};

export type ActiveAssignmentKind = 'ride' | 'courier-order' | 'intercity-trip';

export type ActiveAssignmentPayload = {
  entityId: string;
  status: string;
  updatedAt: string;
};

export type CachedLocationPayload = {
  lat: number;
  lng: number;
  updatedAt: string;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisUrl?: string;
  private readonly defaultTtlSeconds = 120;
  private readonly presenceHeartbeatMs = 45_000;

  private client: Redis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private warnedDisabled = false;
  private shuttingDown = false;
  private readonly offlineListeners = new Set<(userId: string) => void | Promise<void>>();

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL') || undefined;
  }

  isEnabled() {
    return Boolean(this.redisUrl);
  }

  async ping(): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      return false;
    }
    try {
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  getRedisUrl() {
    return this.redisUrl;
  }

  async createSocketAdapter(app: INestApplicationContext) {
    const clients = await this.getPubSubClients();
    if (!clients) {
      return null;
    }

    return new SocketIoRedisAdapter(app, clients.pubClient, clients.subClient);
  }

  async setUserPresence(userId: string, namespace: string, socketId: string) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const socketKey = this.socketPresenceKey(socketId);
    const userSocketsKey = this.userSocketsKey(userId);

    await Promise.all([
      client.sadd(userSocketsKey, socketId),
      client.setex(
        socketKey,
        this.defaultTtlSeconds,
        JSON.stringify({ userId, namespace } satisfies PresencePayload),
      ),
      client.setex(this.userOnlineKey(userId), this.defaultTtlSeconds, '1'),
      client.setex(this.userNamespaceKey(userId, namespace), this.defaultTtlSeconds, '1'),
    ]);
  }

  async removeSocketPresence(socketId: string) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const rawPresence = await client.get(this.socketPresenceKey(socketId));
    if (!rawPresence) {
      return;
    }

    try {
      const presence = JSON.parse(rawPresence) as PresencePayload;
      await client.srem(this.userSocketsKey(presence.userId), socketId);
      const remainingSockets = await client.scard(this.userSocketsKey(presence.userId));

      if (remainingSockets <= 0) {
        await Promise.all([
          client.del(this.userOnlineKey(presence.userId)),
          client.del(this.userNamespaceKey(presence.userId, presence.namespace)),
          client.del(this.userSocketsKey(presence.userId)),
        ]);
        this.emitUserOffline(presence.userId);
      }
    } catch {
      this.logger.warn(`Failed to parse Redis presence payload for socket ${socketId}`);
    } finally {
      await client.del(this.socketPresenceKey(socketId));
    }
  }

  async cacheLocation(kind: 'driver' | 'courier', userId: string, lat: number, lng: number) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const payload = JSON.stringify({ lat, lng, updatedAt: new Date().toISOString() });
    await Promise.all([
      client.setex(this.locationKey(kind, userId), this.defaultTtlSeconds, payload),
      client.call('GEOADD', this.locationGeoKey(kind), lng, lat, userId),
      client.expire(this.locationGeoKey(kind), this.defaultTtlSeconds * 10),
    ]);
  }

  async getCachedLocation(kind: 'driver' | 'courier', userId: string) {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    const raw = await client.get(this.locationKey(kind, userId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as CachedLocationPayload;
    } catch {
      await client.del(this.locationKey(kind, userId));
      return null;
    }
  }

  async getCachedLocations(kind: 'driver' | 'courier', userIds: string[]) {
    const client = await this.getClient();
    if (!client || userIds.length === 0) {
      return new Map<string, CachedLocationPayload>();
    }

    const rawValues = await client.mget(userIds.map((userId) => this.locationKey(kind, userId)));
    const result = new Map<string, CachedLocationPayload>();

    rawValues.forEach((raw, index) => {
      if (!raw) {
        return;
      }

      try {
        result.set(userIds[index], JSON.parse(raw) as CachedLocationPayload);
      } catch {
        void client.del(this.locationKey(kind, userIds[index]));
      }
    });

    return result;
  }

  async findNearbyUsers(
    kind: 'driver' | 'courier',
    lat: number,
    lng: number,
    radiusKm: number,
    count = 100,
  ) {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const results = await client.call(
      'GEORADIUS',
      this.locationGeoKey(kind),
      lng,
      lat,
      radiusKm,
      'km',
      'ASC',
      'COUNT',
      count,
    );

    if (!Array.isArray(results)) {
      return [];
    }

    return results.map((value) => String(value));
  }

  async clearCachedLocation(kind: 'driver' | 'courier', userId: string) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    await Promise.all([
      client.del(this.locationKey(kind, userId)),
      client.zrem(this.locationGeoKey(kind), userId),
    ]);
  }

  async setActiveAssignment(
    kind: ActiveAssignmentKind,
    userId: string,
    entityId: string,
    status: string,
  ) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    await client.setex(
      this.activeAssignmentKey(kind, userId),
      this.defaultTtlSeconds,
      JSON.stringify({ entityId, status, updatedAt: new Date().toISOString() }),
    );
  }

  async getActiveAssignment(kind: ActiveAssignmentKind, userId: string) {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    const raw = await client.get(this.activeAssignmentKey(kind, userId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ActiveAssignmentPayload;
    } catch {
      await client.del(this.activeAssignmentKey(kind, userId));
      return null;
    }
  }

  async clearActiveAssignment(kind: ActiveAssignmentKind, userId: string) {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    await client.del(this.activeAssignmentKey(kind, userId));
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    const client = this.client;
    const pubClient = this.pubClient;
    const subClient = this.subClient;
    this.client = null;
    this.pubClient = null;
    this.subClient = null;

    await Promise.all([
      client?.quit().catch(() => null),
      pubClient?.quit().catch(() => null),
      subClient?.quit().catch(() => null),
    ]);
  }

  onUserOffline(listener: (userId: string) => void | Promise<void>) {
    this.offlineListeners.add(listener);
    return () => {
      this.offlineListeners.delete(listener);
    };
  }

  attachPresenceHeartbeat(client: Socket, userId: string, namespace: string) {
    this.clearPresenceHeartbeat(client);

    const timer = setInterval(() => {
      void this.setUserPresence(userId, namespace, client.id).catch(() => null);
    }, this.presenceHeartbeatMs);

    client.data.presenceHeartbeat = timer;
  }

  clearPresenceHeartbeat(client: Socket) {
    const timer = client.data.presenceHeartbeat as NodeJS.Timeout | undefined;
    if (timer) {
      clearInterval(timer);
      delete client.data.presenceHeartbeat;
    }
  }

  private async getClient() {
    if (!this.redisUrl || this.shuttingDown) {
      this.warnIfDisabled();
      return null;
    }

    if (!this.client) {
      this.client = new Redis(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.client.on('error', (error) => this.handleRedisError('client', error));
    }

    if (this.client.status === 'end' || this.client.status === 'close') {
      return null;
    }

    if (this.client.status === 'wait') {
      await this.client.connect();
      this.logger.log('Redis client connected');
    }

    return this.client;
  }

  private async getPubSubClients() {
    if (!this.redisUrl || this.shuttingDown) {
      this.warnIfDisabled();
      return null;
    }

    if (!this.pubClient || !this.subClient) {
      this.pubClient = new Redis(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.pubClient.on('error', (error) => this.handleRedisError('pubClient', error));
      this.subClient = new Redis(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.subClient.on('error', (error) => this.handleRedisError('subClient', error));
    }

    if (
      this.pubClient.status === 'end' ||
      this.pubClient.status === 'close' ||
      this.subClient.status === 'end' ||
      this.subClient.status === 'close'
    ) {
      return null;
    }

    if (this.pubClient.status === 'wait') {
      await this.pubClient.connect();
    }
    if (this.subClient.status === 'wait') {
      await this.subClient.connect();
    }

    this.logger.log('Redis pub/sub clients connected');

    return {
      pubClient: this.pubClient,
      subClient: this.subClient,
    };
  }

  private warnIfDisabled() {
    if (this.warnedDisabled) {
      return;
    }
    this.warnedDisabled = true;
    this.logger.warn('REDIS_URL is not set. Redis features are disabled.');
  }

  private emitUserOffline(userId: string) {
    for (const listener of this.offlineListeners) {
      Promise.resolve(listener(userId)).catch((error) => {
        this.logger.warn(`Failed to handle Redis offline listener for user ${userId}: ${String(error)}`);
      });
    }
  }

  private handleRedisError(clientName: string, error: unknown) {
    const message = String((error as Error | undefined)?.message ?? error ?? '');
    if (message.toLowerCase().includes('connection is closed')) {
      return;
    }
    this.logger.warn(`Redis ${clientName} error: ${message}`);
  }

  private socketPresenceKey(socketId: string) {
    return `presence:socket:${socketId}`;
  }

  private userSocketsKey(userId: string) {
    return `presence:user:${userId}:sockets`;
  }

  private userOnlineKey(userId: string) {
    return `presence:user:${userId}:online`;
  }

  private userNamespaceKey(userId: string, namespace: string) {
    return `presence:user:${userId}:namespace:${namespace}`;
  }

  private locationKey(kind: 'driver' | 'courier', userId: string) {
    return `location:${kind}:${userId}`;
  }

  private locationGeoKey(kind: 'driver' | 'courier') {
    return `location:${kind}:geo`;
  }

  private activeAssignmentKey(kind: ActiveAssignmentKind, userId: string) {
    return `active:${kind}:${userId}`;
  }
}

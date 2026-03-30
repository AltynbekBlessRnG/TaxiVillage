import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';

export class SocketIoRedisAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly pubClient: Redis,
    private readonly subClient: Redis,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }
}

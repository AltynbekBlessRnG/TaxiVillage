import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: process is up (no external checks). */
  @Get()
  live() {
    return {
      status: 'ok',
      service: 'taxivillage-backend',
      time: new Date().toISOString(),
    };
  }

  /** Readiness: database (+ Redis when configured). */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database_unavailable');
    }

    if (this.redis.isEnabled()) {
      const redisOk = await this.redis.ping();
      if (!redisOk) {
        throw new ServiceUnavailableException('redis_unavailable');
      }
    }

    return {
      status: 'ready',
      database: 'ok',
      redis: this.redis.isEnabled() ? 'ok' : 'skipped',
      time: new Date().toISOString(),
    };
  }
}

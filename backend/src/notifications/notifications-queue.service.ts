import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

type PushJobPayload = {
  pushToken: string;
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  };
};

const NOTIFICATIONS_QUEUE_NAME = 'notifications:push';

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  private queue: Queue<PushJobPayload> | null = null;
  private worker: Worker<PushJobPayload> | null = null;
  private queueConnection: Redis | null = null;
  private workerConnection: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    const redisUrl = this.redisService.getRedisUrl();
    if (!redisUrl) {
      this.logger.warn('BullMQ disabled: REDIS_URL is not set.');
      return;
    }

    try {
      this.queueConnection = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.workerConnection = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });

      await this.queueConnection.connect();
      await this.workerConnection.connect();

      this.queue = new Queue<PushJobPayload>(NOTIFICATIONS_QUEUE_NAME, {
        connection: this.queueConnection,
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: 200,
          removeOnFail: 500,
          backoff: {
            type: 'exponential',
            delay: 1500,
          },
        },
      });

      this.worker = new Worker<PushJobPayload>(
        NOTIFICATIONS_QUEUE_NAME,
        async (job) => this.processPushJob(job),
        {
          connection: this.workerConnection,
          concurrency: 5,
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.warn(
          `Push job failed${job?.id ? ` (${job.id})` : ''}: ${error.message}`,
        );
      });

      this.logger.log('BullMQ notifications queue enabled');
    } catch (error) {
      this.logger.error('Failed to initialize BullMQ notifications queue', error as any);
      await this.onModuleDestroy();
    }
  }

  isEnabled() {
    return Boolean(this.queue);
  }

  async enqueuePush(
    pushToken: string | null | undefined,
    payload: PushJobPayload['payload'],
  ) {
    if (!pushToken) {
      return;
    }

    if (!this.queue) {
      await this.deliverNow(pushToken, payload);
      return;
    }

    await this.queue.add('send-push', {
      pushToken,
      payload,
    });
  }

  async deliverNow(
    pushToken: string | null | undefined,
    payload: PushJobPayload['payload'],
  ) {
    if (!pushToken) {
      return;
    }

    try {
      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Expo push failed: ${response.status} ${text}`);
      }
    } catch (error) {
      this.logger.error('Expo push request failed', error as any);
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.worker?.close(),
      this.queue?.close(),
      this.queueConnection?.quit(),
      this.workerConnection?.quit(),
    ]);
  }

  private async processPushJob(job: Job<PushJobPayload>) {
    await this.deliverNow(job.data.pushToken, job.data.payload);
  }
}

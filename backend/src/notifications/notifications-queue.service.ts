import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type PushJobPayload = {
  pushToken: string;
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  };
};

type ReceiptJobPayload = {
  receiptId: string;
  pushToken: string;
};

type NotificationsJobPayload = PushJobPayload | ReceiptJobPayload;

const NOTIFICATIONS_QUEUE_NAME = 'notifications-push';
const SEND_PUSH_JOB = 'send-push';
const CHECK_RECEIPT_JOB = 'check-receipt';

/**
 * Expo only decides whether a push really went out after it has handed it to
 * Apple or Google, so the receipt is not ready the moment the send returns.
 * Ten minutes is comfortably past that without leaving the job pending long
 * enough to be lost to a redeploy.
 */
const RECEIPT_CHECK_DELAY_MS = 10 * 60 * 1000;

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  private readonly expoReceiptUrl = 'https://exp.host/--/api/v2/push/getReceipts';

  private queue: Queue<NotificationsJobPayload> | null = null;
  private worker: Worker<NotificationsJobPayload> | null = null;
  private queueConnection: Redis | null = null;
  private workerConnection: Redis | null = null;
  private shuttingDown = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

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
      this.queueConnection.on('error', (error) => this.handleRedisError('queueConnection', error));
      this.workerConnection = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.workerConnection.on('error', (error) => this.handleRedisError('workerConnection', error));

      await this.queueConnection.connect();
      await this.workerConnection.connect();

      this.queue = new Queue<NotificationsJobPayload>(NOTIFICATIONS_QUEUE_NAME, {
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

      this.worker = new Worker<NotificationsJobPayload>(
        NOTIFICATIONS_QUEUE_NAME,
        async (job) =>
          job.name === CHECK_RECEIPT_JOB
            ? this.processReceiptJob(job as Job<ReceiptJobPayload>)
            : this.processPushJob(job as Job<PushJobPayload>),
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

    if (this.shuttingDown) {
      return;
    }

    if (!this.queue) {
      await this.deliverNow(pushToken, payload);
      return;
    }

    await this.queue.add(SEND_PUSH_JOB, {
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
        return;
      }

      // Expo answers 200 even when it refuses the message, and puts the reason
      // in the ticket - a missing APNs key reads as InvalidCredentials here and
      // nowhere else. Left unread, every push to iOS failed in silence.
      const result = (await response.json().catch(() => null)) as {
        data?: {
          status?: string;
          id?: string;
          message?: string;
          details?: { error?: string };
        };
      } | null;
      const ticket = result?.data;
      if (ticket?.status === 'error') {
        const reason = ticket.details?.error;
        this.logger.warn(
          `Expo push rejected (${reason ?? 'unknown'}): ${ticket.message ?? ''}`,
        );
        // DeviceNotRegistered is Expo saying this token is dead - the app was
        // uninstalled, or the token was reissued. Left in the database it
        // stays the account's only address, so every later push is thrown
        // away here and the person simply stops getting notifications.
        if (reason === 'DeviceNotRegistered') {
          await this.forgetPushToken(pushToken);
        }
        return;
      }

      // An accepted ticket only means Expo queued the message. Whether Apple or
      // Google actually took it is in the receipt, and that is where a dead
      // token usually shows up - so an unread receipt is the difference between
      // knowing a push landed and only hoping it did.
      if (ticket?.id) {
        await this.scheduleReceiptCheck(ticket.id, pushToken);
      }
    } catch (error) {
      this.logger.error('Expo push request failed', error as any);
    }
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    const worker = this.worker;
    const queue = this.queue;
    const queueConnection = this.queueConnection;
    const workerConnection = this.workerConnection;
    this.worker = null;
    this.queue = null;
    this.queueConnection = null;
    this.workerConnection = null;

    await Promise.allSettled([
      worker?.close(),
      queue?.close(),
      queueConnection?.quit(),
      workerConnection?.quit(),
    ]);
  }

  private async processPushJob(job: Job<PushJobPayload>) {
    await this.deliverNow(job.data.pushToken, job.data.payload);
  }

  /**
   * Queues the receipt lookup for a push Expo accepted. Without Redis there is
   * no delayed queue to put it on, and chasing it inline would mean holding the
   * request open for ten minutes, so the check is simply skipped.
   */
  private async scheduleReceiptCheck(receiptId: string, pushToken: string) {
    if (!this.queue || this.shuttingDown) {
      return;
    }

    try {
      await this.queue.add(
        CHECK_RECEIPT_JOB,
        { receiptId, pushToken },
        { delay: RECEIPT_CHECK_DELAY_MS, attempts: 2 },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to schedule push receipt check: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async processReceiptJob(job: Job<ReceiptJobPayload>) {
    const { receiptId, pushToken } = job.data;

    const response = await fetch(this.expoReceiptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: [receiptId] }),
    });

    if (!response.ok) {
      // Let BullMQ retry: a receipt that is not readable yet is not a receipt
      // that says the push failed.
      throw new Error(`Expo receipt lookup failed: ${response.status}`);
    }

    const result = (await response.json().catch(() => null)) as {
      data?: Record<
        string,
        { status?: string; message?: string; details?: { error?: string } }
      >;
    } | null;

    const receipt = result?.data?.[receiptId];
    if (!receipt || receipt.status !== 'error') {
      return;
    }

    const reason = receipt.details?.error;
    this.logger.warn(
      `Expo push receipt error (${reason ?? 'unknown'}): ${receipt.message ?? ''}`,
    );
    if (reason === 'DeviceNotRegistered') {
      await this.forgetPushToken(pushToken);
    }
  }

  /** Drops a token Expo has told us no longer addresses a device. */
  private async forgetPushToken(pushToken: string) {
    try {
      const { count } = await (this.prisma.user as any).updateMany({
        where: { pushToken },
        data: { pushToken: null },
      });
      if (count > 0) {
        this.logger.log(`Cleared ${count} push token(s) Expo no longer knows`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to clear dead push token: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private handleRedisError(clientName: string, error: unknown) {
    const message = String((error as Error | undefined)?.message ?? error ?? '');
    if (message.toLowerCase().includes('connection is closed')) {
      return;
    }
    this.logger.warn(`BullMQ ${clientName} error: ${message}`);
  }
}

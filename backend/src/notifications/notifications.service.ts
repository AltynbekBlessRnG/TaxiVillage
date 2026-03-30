import { Injectable, Logger } from '@nestjs/common';
import { NotificationsQueueService } from './notifications-queue.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationsQueueService: NotificationsQueueService) {}

  async sendPush(
    pushToken: string | null | undefined,
    payload: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
  ) {
    if (!pushToken) {
      return;
    }

    await this.notificationsQueueService.enqueuePush(pushToken, payload);
  }
}

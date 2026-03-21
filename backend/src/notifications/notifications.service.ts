import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

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
}

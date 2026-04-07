import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramOtpService {
  private readonly logger = new Logger(TelegramOtpService.name);

  constructor(private readonly configService: ConfigService) {}

  get botToken() {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim() || '';
  }

  get botUsername() {
    return this.configService.get<string>('TELEGRAM_BOT_USERNAME')?.trim().replace(/^@/, '') || '';
  }

  get isConfigured() {
    return Boolean(this.botToken && this.botUsername);
  }

  buildStartUrl(sessionId: string) {
    if (!this.botUsername) {
      return null;
    }
    return `https://t.me/${this.botUsername}?start=otp_${sessionId}`;
  }

  async sendCode(chatId: string, code: string, phone: string) {
    if (!this.isConfigured) {
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `TaxiVillage\nКод подтверждения для ${phone}: ${code}\nКод действует 10 минут.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
      return false;
    }

    return true;
  }

  async sendText(chatId: string, text: string) {
    if (!this.isConfigured) {
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    return response.ok;
  }
}

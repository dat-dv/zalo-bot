import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZALO_API_URLS } from './zalo.constants';

@Injectable()
export class ZaloService implements OnModuleInit {
  private readonly logger = new Logger(ZaloService.name);
  private token: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('zalo.botToken') || null;

    if (!this.token) {
      this.logger.warn('ZALO_BOT_TOKEN is not configured.');
    }
  }

  public onModuleInit(): void {
    const webhookUrl = this.configService.get<string>('zalo.webhookUrl');
    if (webhookUrl) {
      this.logger.log(`Zalo webhook configured for endpoint: ${webhookUrl}`);
    }
  }

  public async sendMessage(chatId: string, text: string): Promise<boolean> {
    const targetChatId = String(chatId);

    if (!this.token) {
      this.logger.warn(`Zalo token not configured. Outgoing message to ${targetChatId}: "${text}"`);
      return false;
    }

    const entrypoint = ZALO_API_URLS.BOT_SEND_MESSAGE(this.token);

    this.logger.log({
      entrypoint,
      targetChatId,
      text,
    });
    try {
      const response = await fetch(entrypoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
        }),
      });

      const data = (await response.json().catch((): null => null)) as {
        ok?: boolean;
        error?: number;
        message?: string;
        description?: string;
      } | null;

      if (!response.ok || data?.ok === false || (data?.error !== 0 && data?.error !== undefined)) {
        this.logger.error(
          `Failed to send Zalo message to ${targetChatId}: ${JSON.stringify(data || response.statusText)}`,
        );
        return false;
      }

      this.logger.log(`Successfully sent message to Zalo chat ${targetChatId}`);
      return true;
    } catch (err) {
      this.logger.error(`Error sending Zalo message to ${targetChatId}: ${(err as Error).message}`);
      return false;
    }
  }
}

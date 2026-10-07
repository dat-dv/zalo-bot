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

  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const targetUserId = String(chatId);
    if (!this.token) {
      this.logger.warn(`Zalo token not configured. Outgoing message to ${targetUserId}: "${text}"`);
      return false;
    }

    try {
      const response = await fetch(ZALO_API_URLS.SEND_MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.token,
        },
        body: JSON.stringify({
          recipient: {
            user_id: targetUserId,
          },
          message: {
            text,
          },
        }),
      });

      const data = (await response.json().catch((): null => null)) as {
        error?: number;
        message?: string;
      } | null;

      if (!response.ok || (data && data.error !== 0 && data.error !== undefined)) {
        this.logger.error(
          `Failed to send Zalo message to ${targetUserId}: ${JSON.stringify(data || response.statusText)}`,
        );
        return false;
      }

      this.logger.log(`Successfully sent message to Zalo user ${targetUserId}`);
      return true;
    } catch (err) {
      this.logger.error(`Error sending Zalo message to ${targetUserId}: ${(err as Error).message}`);
      return false;
    }
  }
}

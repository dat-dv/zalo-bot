import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { getClientIp } from '../../../common/utils/client-ip.util';
import { isWebhookKeyValid } from '../webhook-api-key';
import { WEBHOOK_IP_LOCK_SECONDS, WebhookIpLimiter } from '../webhook-ip-limiter';

/**
 * Lets a webhook call through only with the `WEBHOOK_API_KEY`. Without a configured key the
 * webhook is off and answers 404, so a forgotten env never leaves the bot's account open.
 */
@Injectable()
export class WebhookApiKeyGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(WebhookApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ipLimiter: WebhookIpLimiter,
  ) {}

  public onModuleInit(): void {
    if (!this.configuredKey()) {
      this.logger.log('WEBHOOK_API_KEY chưa được thiết lập: webhook gửi tin đang tắt.');
    }
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const configuredKey = this.configuredKey();
    if (!configuredKey) {
      throw new NotFoundException();
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!isWebhookKeyValid(configuredKey, req.headers)) {
      // Wrong keys count toward a lock on the caller's IP (`WebhookIpLimitGuard` refuses it).
      const ip = getClientIp(req);
      if (await this.ipLimiter.recordFailedKey(ip)) {
        this.logger.warn(
          `Webhook: IP ${ip} locked for ${WEBHOOK_IP_LOCK_SECONDS / 60} min after repeated wrong keys.`,
        );
      }
      throw new UnauthorizedException('Mã API key webhook không hợp lệ hoặc bị thiếu.');
    }
    return true;
  }

  private configuredKey(): string {
    return this.configService.get<string>('webhook.apiKey') ?? '';
  }
}

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
import { isWebhookKeyValid } from '../webhook-api-key';

/**
 * Lets a webhook call through only with the `WEBHOOK_API_KEY`. Without a configured key the
 * webhook is off and answers 404, so a forgotten env never leaves the bot's account open.
 */
@Injectable()
export class WebhookApiKeyGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(WebhookApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  public onModuleInit(): void {
    if (!this.configuredKey()) {
      this.logger.log('WEBHOOK_API_KEY chưa được thiết lập: webhook gửi tin đang tắt.');
    }
  }

  public canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.configuredKey();
    if (!configuredKey) {
      throw new NotFoundException();
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!isWebhookKeyValid(configuredKey, req.headers)) {
      throw new UnauthorizedException('Mã API key webhook không hợp lệ hoặc bị thiếu.');
    }
    return true;
  }

  private configuredKey(): string {
    return this.configService.get<string>('webhook.apiKey') ?? '';
  }
}

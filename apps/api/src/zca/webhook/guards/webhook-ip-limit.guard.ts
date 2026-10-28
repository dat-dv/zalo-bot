import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { getClientIp } from '../../../common/utils/client-ip.util';
import {
  WEBHOOK_IP_LOCK_SECONDS,
  WEBHOOK_IP_MAX_REQUESTS,
  WebhookIpLimiter,
} from '../webhook-ip-limiter';

/**
 * Runs before `WebhookApiKeyGuard`: refuses IPs locked for sending wrong keys and caps requests
 * per IP, so a caller without the key cannot flood the API or keep guessing.
 */
@Injectable()
export class WebhookIpLimitGuard implements CanActivate {
  private readonly logger = new Logger(WebhookIpLimitGuard.name);

  constructor(private readonly ipLimiter: WebhookIpLimiter) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const ip = getClientIp(context.switchToHttp().getRequest<Request>());

    if (await this.ipLimiter.isLocked(ip)) {
      throw new HttpException(
        `Địa chỉ IP này gửi sai API key quá nhiều lần nên bị tạm khoá ${WEBHOOK_IP_LOCK_SECONDS / 60} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const count = await this.ipLimiter.countRequest(ip);
    if (count > WEBHOOK_IP_MAX_REQUESTS) {
      // Logged on the first refused request of the minute only, not on every one after it.
      if (count === WEBHOOK_IP_MAX_REQUESTS + 1) {
        this.logger.warn(`Webhook: IP ${ip} hit ${WEBHOOK_IP_MAX_REQUESTS} requests/min.`);
      }
      throw new HttpException(
        `Mỗi địa chỉ IP chỉ được gọi webhook tối đa ${WEBHOOK_IP_MAX_REQUESTS} lần mỗi phút. Vui lòng thử lại sau.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

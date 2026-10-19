import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

export const DEPLOY_TOKEN_HEADER = 'x-deploy-token';

/**
 * Protects the deploy-notify webhooks, which message every admin on Zalo. Fail-closed: without
 * `DEPLOY_NOTIFY_TOKEN` the routes are disabled. The token may come from a header or `?token=`
 * because CI/Coolify hooks often only let you configure a URL.
 */
@Injectable()
export class DeployNotifyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('deploy.notifyToken');
    if (!expected) throw new ForbiddenException('Deploy notify is disabled.');

    const given = readDeployToken(context.switchToHttp().getRequest<Request>());
    if (!given || !tokensMatch(given, expected)) throw new UnauthorizedException();
    return true;
  }
}

function readDeployToken(req: Request): string | undefined {
  const header = req.headers[DEPLOY_TOKEN_HEADER];
  if (typeof header === 'string' && header) return header;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (bearer) return bearer;
  const query: unknown = req.query?.token;
  return typeof query === 'string' && query ? query : undefined;
}

/** Hash first so both sides have equal length for timingSafeEqual. */
function tokensMatch(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

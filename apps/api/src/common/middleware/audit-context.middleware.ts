import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditContext } from '../../audit/audit-context';

/**
 * Opens a dashboard audit context per HTTP request. The actor is not read here: the dashboard
 * auth helpers set it once the access token is verified, so only verified ids are recorded.
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    AuditContext.run({ source: 'dashboard' }, next);
  }
}

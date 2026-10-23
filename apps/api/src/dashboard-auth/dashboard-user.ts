import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuditContext } from '../audit/audit-context';
import { ReportsTokenService } from '../reports/reports-token.service';

/** Cookie set by `GET /api/access` and rotated by `POST /api/refresh`. */
export const DASHBOARD_REFRESH_COOKIE = 'reports_refresh';

/** Narrow view of `UsersService` so this file does not import the users module (it imports us). */
export interface DashboardAdminChecker {
  isAdmin(userId: string | number): boolean;
}

export function getDashboardUserId(req: Request, tokens: ReportsTokenService): string | number {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new UnauthorizedException();
  return withAuditActor(tokens.verifyAccessToken(token));
}

/** Every dashboard route resolves its user here, so this is where audit rows learn the actor. */
function withAuditActor(userId: string | number): string | number {
  AuditContext.setActor(String(userId));
  return userId;
}

/**
 * For GET routes the browser opens directly (`<img src>`, `<a href>`), which cannot carry the
 * Bearer header: accept the Bearer token when present, otherwise the dashboard refresh cookie.
 */
export function getDashboardUserIdFromBrowser(
  req: Request,
  tokens: ReportsTokenService,
): string | number {
  if (req.headers.authorization) return getDashboardUserId(req, tokens);
  const cookies: unknown = req.cookies;
  const refresh =
    cookies && typeof cookies === 'object'
      ? (cookies as Record<string, unknown>)[DASHBOARD_REFRESH_COOKIE]
      : undefined;
  if (typeof refresh !== 'string' || !refresh) throw new UnauthorizedException();
  return withAuditActor(tokens.verifyRefreshToken(refresh));
}

export function assertDashboardAdmin(
  userId: string | number,
  admins: DashboardAdminChecker | undefined,
): string | number {
  if (!admins?.isAdmin(userId)) throw new ForbiddenException();
  return userId;
}

export function requireDashboardAdmin(
  req: Request,
  tokens: ReportsTokenService,
  admins: DashboardAdminChecker | undefined,
): string | number {
  return assertDashboardAdmin(getDashboardUserId(req, tokens), admins);
}

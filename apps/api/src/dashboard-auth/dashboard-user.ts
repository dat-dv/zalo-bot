import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ReportsTokenService } from '../reports/reports-token.service';

export function getDashboardUserId(req: Request, tokens: ReportsTokenService): string | number {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new UnauthorizedException();
  return tokens.verifyAccessToken(token);
}

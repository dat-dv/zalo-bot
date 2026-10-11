import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '../constants/common.constants';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawIncomingId = req.headers[REQUEST_ID_HEADER] || req.headers['x-correlation-id'];
    const incomingId = Array.isArray(rawIncomingId) ? rawIncomingId[0] : rawIncomingId;

    const requestId =
      typeof incomingId === 'string' && incomingId.trim().length > 0
        ? incomingId.trim()
        : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    (req as unknown as { id: string }).id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}

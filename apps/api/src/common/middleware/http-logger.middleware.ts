import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { REQUEST_ID_HEADER } from '../constants/common.constants';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '-';

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;
      const rawRequestId = req.headers[REQUEST_ID_HEADER] || (req as unknown as { id?: string }).id;
      const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId || '-';

      const logMessage = `[${method}] ${originalUrl} -> ${statusCode} (${duration}ms) - Length: ${contentLength} - IP: ${ip || '-'} - UA: ${userAgent} - [reqId: ${requestId}]`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}

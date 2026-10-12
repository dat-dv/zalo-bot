import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware ghi log RAW body của webhook Zalo TRƯỚC KHI bất kỳ ValidationPipe nào xử lý.
 * Giúp debug khi nghi ngờ pipe/DTO strip mất fields (ví dụ: ảnh, attachments).
 *
 * Để enable: thêm vào ZaloModule hoặc AppModule configure() với đường dẫn webhook.
 * Để disable: xóa middleware khỏi module config.
 */
@Injectable()
export class WebhookRawBodyDebugMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ZaloWebhookRawBody');

  use(req: Request, _res: Response, next: NextFunction): void {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf-8');

      if (rawBody) {
        try {
          const parsed: unknown = JSON.parse(rawBody);
          this.logger.debug(
            `[RAW BODY] ${req.method} ${req.path}\n${JSON.stringify(parsed, null, 2)}`,
          );
        } catch {
          // Không phải JSON thì log raw string
          this.logger.debug(`[RAW BODY] ${req.method} ${req.path}\n${rawBody.slice(0, 2000)}`);
        }
      }

      next();
    });

    req.on('error', () => {
      next();
    });
  }
}

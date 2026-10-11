import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { RESPONSE_TIME_HEADER } from '../constants/common.constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const hostType = context.getType();
    if (hostType !== 'http') {
      return next.handle();
    }

    const start = Date.now();
    const handlerName = `${context.getClass().name}.${context.getHandler().name}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const httpContext = context.switchToHttp();
          const response = httpContext.getResponse<Response>();

          if (response && !response.headersSent) {
            response.setHeader(RESPONSE_TIME_HEADER, `${duration}ms`);
          }

          if (duration > 1500) {
            this.logger.warn(`Slow execution detected in ${handlerName}: ${duration}ms`);
          } else {
            this.logger.debug(`${handlerName} executed in ${duration}ms`);
          }
        },
      }),
    );
  }
}

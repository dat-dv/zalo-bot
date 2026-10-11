import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DEFAULT_REQUEST_TIMEOUT, REQUEST_TIMEOUT_KEY } from '../constants/common.constants';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const customTimeout = this.reflector.getAllAndOverride<number>(REQUEST_TIMEOUT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const timeoutLimit = customTimeout && customTimeout > 0 ? customTimeout : DEFAULT_REQUEST_TIMEOUT;

    return next.handle().pipe(
      timeout(timeoutLimit),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timed out after ${timeoutLimit}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

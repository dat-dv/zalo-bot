import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IApiResponse } from '@zalobot/contracts';
import { BYPASS_TRANSFORM_KEY } from '../constants/common.constants';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<IApiResponse<T> | T> {
    const isBypassed = this.reflector.getAllAndOverride<boolean>(BYPASS_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isBypassed) {
      return next.handle();
    }

    return next.handle().pipe(
      map((response) => {
        // Streamable files, buffers, or non-object binary streams should not be wrapped
        if (response instanceof StreamableFile || Buffer.isBuffer(response)) {
          return response;
        }

        // Avoid double-wrapping if the handler already returned an object with a `data` property
        if (
          response !== null &&
          typeof response === 'object' &&
          'data' in (response as Record<string, unknown>)
        ) {
          return response;
        }

        return {
          data: response,
        } as IApiResponse<T>;
      }),
    );
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionsFilter } from './filters/global-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { AppValidationPipe } from './pipes/app-validation.pipe';
import { ParseIsoDatePipe } from './pipes/parse-iso-date.pipe';
import { ParsePositiveNumberPipe } from './pipes/parse-positive-number.pipe';
import { TrimStringsPipe } from './pipes/trim-strings.pipe';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { HttpLoggerMiddleware } from './middleware/http-logger.middleware';
import { AuditContextMiddleware } from './middleware/audit-context.middleware';

@Module({
  providers: [
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionsFilter,
    },
    // Global Validation Pipe
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
    // Global Interceptors (executed in order)
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Standalone Pipes & Middlewares for DI
    ParseIsoDatePipe,
    ParsePositiveNumberPipe,
    TrimStringsPipe,
    RequestIdMiddleware,
    HttpLoggerMiddleware,
    AuditContextMiddleware,
  ],
  exports: [
    ParseIsoDatePipe,
    ParsePositiveNumberPipe,
    TrimStringsPipe,
    RequestIdMiddleware,
    HttpLoggerMiddleware,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, HttpLoggerMiddleware, AuditContextMiddleware)
      .forRoutes('*');
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NestMiddleware,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import { Response, Request, NextFunction } from "express";
import { IApiResponse } from "@shared/contracts";
import * as crypto from "crypto";

// 1. TRACE ID MIDDLEWARE (Extracts or generates x-trace-id)
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, res: Response, next: NextFunction) {
    const traceId = (req.headers["x-trace-id"] ||
      req.headers["x-request-id"] ||
      crypto.randomUUID()) as string;
    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    next();
  }
}

// 2. GLOBAL RESPONSE INTERCEPTOR (Real Codebase Pattern: src/common/intercepters/response.interceptor.ts)
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  IApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<IApiResponse<T>> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { traceId?: string }>();
    const traceId =
      req.traceId || (req.headers["x-trace-id"] as string) || null;

    return next.handle().pipe(
      map((data: T) => {
        return {
          status: "success",
          data,
          message: null,
          timestamp: new Date().toISOString(),
          traceId,
        };
      }),
    );
  }
}

// 3. GLOBAL EXCEPTION FILTER (Real Codebase Pattern: src/common/filters/global-exception.filter.ts)
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: Error | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const traceId =
      request.traceId ||
      (request.headers["x-trace-id"] as string) ||
      crypto.randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object") {
        message =
          (res as { message?: string | string[] })?.message?.toString() ||
          "Something went wrong";
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(
        `🚨 [GlobalExceptionFilter][TraceId: ${traceId}] ${request.method} ${request.url}`,
        exception,
      );
    } else {
      console.warn(
        `⚠️ [ClientException][TraceId: ${traceId}] ${request.method} ${request.url} (${statusCode}) - ${message}`,
      );
    }

    response.setHeader("x-trace-id", traceId);
    response.status(statusCode).json({
      status: "failed",
      data: null,
      message,
      traceId,
      timestamp: new Date().toISOString(),
    });
  }
}

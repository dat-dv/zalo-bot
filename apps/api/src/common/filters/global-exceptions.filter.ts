import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { IApiErrorResponse } from '@zalobot/contracts';

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const hostType = host.getType();
    if (hostType !== 'http') {
      const errorMsg =
        exception instanceof Error
          ? exception.stack || exception.message
          : typeof exception === 'string'
            ? exception
            : JSON.stringify(exception);
      this.logger.error(`Exception in non-HTTP context (${hostType}): ${errorMsg}`);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace(/Exception$/, '');
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.message === 'string' || Array.isArray(resObj.message)) {
          message = resObj.message as string | string[];
        } else {
          message = exception.message;
        }

        if (typeof resObj.error === 'string') {
          error = resObj.error;
        } else {
          error = exception.name.replace(/Exception$/, '');
        }
      }
    } else if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      error = 'Not Found';
    } else if (exception instanceof QueryFailedError) {
      const isConstraintError =
        exception.message.includes('duplicate key value') ||
        exception.message.includes('UNIQUE constraint') ||
        exception.message.includes('23505');

      if (isConstraintError) {
        status = HttpStatus.CONFLICT;
        message = 'Database constraint violation';
        error = 'Conflict';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database query failed';
        error = 'Internal Server Error';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const isProd = process.env.NODE_ENV === 'production';
      message = isProd ? 'Internal server error' : exception.message;
      error = 'Internal Server Error';
    }

    const path = request?.url || request?.originalUrl || 'unknown';
    const method = request?.method || 'UNKNOWN';

    const rawRequestId =
      request?.headers?.['x-request-id'] || (request as unknown as { id?: string })?.id;
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

    const responseBody: IApiErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path,
      ...(requestId ? { requestId } : {}),
    };

    if (requestId && !response.headersSent && typeof response.setHeader === 'function') {
      response.setHeader('x-request-id', requestId);
    }

    const logReqId = requestId ? ` [reqId: ${requestId}]` : '';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      const detail =
        exception instanceof QueryFailedError ? ` - Details: ${exception.message}` : '';
      this.logger.error(
        `[${method}] ${path} -> ${status} - ${typeof message === 'string' ? message : JSON.stringify(message)}${detail}${logReqId}`,
        stack,
      );
    } else {
      this.logger.warn(
        `[${method}] ${path} -> ${status} - ${typeof message === 'string' ? message : JSON.stringify(message)}${logReqId}`,
      );
    }

    response.status(status).json(responseBody);
  }
}

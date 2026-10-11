import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { REQUEST_ID_HEADER } from '../constants/common.constants';

/**
 * Route parameter decorator to inject the current request ID.
 *
 * Example:
 *   @Get()
 *   myEndpoint(@RequestId() reqId: string) { ... }
 */
export const RequestId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const id = (request as unknown as { id?: string }).id;
  const headerId = request?.headers?.[REQUEST_ID_HEADER];
  const value = id || headerId;
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : '';
});

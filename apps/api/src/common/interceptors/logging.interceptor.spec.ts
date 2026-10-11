import assert from 'node:assert/strict';
import test from 'node:test';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Response } from 'express';
import { LoggingInterceptor } from './logging.interceptor';
import { RESPONSE_TIME_HEADER } from '../constants/common.constants';

void test('LoggingInterceptor sets X-Response-Time header on completion', async () => {
  const interceptor = new LoggingInterceptor();
  const headers: Record<string, string> = {};
  const mockResponse = {
    headersSent: false,
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    },
  } as unknown as Response;

  const mockContext = {
    getType: () => 'http',
    getClass: () => ({ name: 'TestController' }),
    getHandler: () => ({ name: 'testHandler' }),
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as unknown as ExecutionContext;

  const mockHandler: CallHandler = {
    handle: () => of({ success: true }),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.deepEqual(result, { success: true });
  assert.ok(headers[RESPONSE_TIME_HEADER]);
  assert.match(headers[RESPONSE_TIME_HEADER], /^\d+ms$/);
});

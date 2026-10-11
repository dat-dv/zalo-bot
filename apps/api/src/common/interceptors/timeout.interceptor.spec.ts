import assert from 'node:assert/strict';
import test from 'node:test';
import { of, delay } from 'rxjs';
import { ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TimeoutInterceptor } from './timeout.interceptor';
import { REQUEST_TIMEOUT_KEY } from '../constants/common.constants';

void test('TimeoutInterceptor allows fast requests to succeed', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => 500;
  const interceptor = new TimeoutInterceptor(reflector);

  const mockContext = {
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;

  const mockHandler: CallHandler = {
    handle: () => of({ ok: true }).pipe(delay(20)),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.deepEqual(result, { ok: true });
});

void test('TimeoutInterceptor throws RequestTimeoutException on slow requests', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = (key: string) => (key === REQUEST_TIMEOUT_KEY ? 30 : null);
  const interceptor = new TimeoutInterceptor(reflector);

  const mockContext = {
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;

  const mockHandler: CallHandler = {
    handle: () => of({ ok: true }).pipe(delay(100)),
  };

  await assert.rejects(
    async () => {
      await new Promise((resolve, reject) => {
        interceptor.intercept(mockContext, mockHandler).subscribe({
          next: resolve,
          error: reject,
        });
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof RequestTimeoutException);
      assert.match((err as Error).message, /timed out after 30ms/);
      return true;
    },
  );
});

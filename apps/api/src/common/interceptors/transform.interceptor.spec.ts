import assert from 'node:assert/strict';
import test from 'node:test';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './transform.interceptor';
import { BYPASS_TRANSFORM_KEY } from '../constants/common.constants';

function createMockContext(bypassed = false): ExecutionContext {
  const reflector = new Reflector();
  if (bypassed) {
    reflector.getAllAndOverride = () => true;
  } else {
    reflector.getAllAndOverride = () => false;
  }

  return {
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

void test('TransformInterceptor wraps plain object into { data: ... }', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => false;
  const interceptor = new TransformInterceptor(reflector);

  const mockContext = createMockContext(false);
  const mockHandler: CallHandler = {
    handle: () => of({ id: 'tx-1', amount: 50000 }),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.deepEqual(result, { data: { id: 'tx-1', amount: 50000 } });
});

void test('TransformInterceptor avoids double wrapping if response already has data field', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => false;
  const interceptor = new TransformInterceptor(reflector);

  const mockContext = createMockContext(false);
  const mockHandler: CallHandler = {
    handle: () => of({ data: ['item1', 'item2'] }),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.deepEqual(result, { data: ['item1', 'item2'] });
});

void test('TransformInterceptor bypasses StreamableFile', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => false;
  const interceptor = new TransformInterceptor(reflector);

  const streamable = new StreamableFile(Buffer.from('binary-test'));
  const mockContext = createMockContext(false);
  const mockHandler: CallHandler = {
    handle: () => of(streamable),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.equal(result, streamable);
});

void test('TransformInterceptor bypasses when decorator metadata is set', async () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = (key: string) => key === BYPASS_TRANSFORM_KEY;
  const interceptor = new TransformInterceptor(reflector);

  const mockContext = createMockContext(true);
  const mockHandler: CallHandler = {
    handle: () => of('raw-webhook-challenge-response'),
  };

  const result = await new Promise((resolve, reject) => {
    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: resolve,
      error: reject,
    });
  });

  assert.equal(result, 'raw-webhook-challenge-response');
});

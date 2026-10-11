import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { Request, Response, NextFunction } from 'express';
import { HttpLoggerMiddleware } from './http-logger.middleware';
import { REQUEST_ID_HEADER } from '../constants/common.constants';

void test('HttpLoggerMiddleware attaches finish listener and invokes next()', () => {
  const middleware = new HttpLoggerMiddleware();
  const req = {
    method: 'GET',
    originalUrl: '/api/transactions',
    ip: '127.0.0.1',
    get: (key: string) => (key === 'user-agent' ? 'Mozilla/5.0' : undefined),
    headers: { [REQUEST_ID_HEADER]: 'test-req-id' },
  } as unknown as Request;

  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    statusCode: 200,
    get: () => '128',
  }) as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware.use(req, res, next);
  assert.equal(nextCalled, true);

  // Trigger finish event
  assert.doesNotThrow(() => {
    emitter.emit('finish');
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { Request, Response, NextFunction } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { REQUEST_ID_HEADER } from '../constants/common.constants';

void test('RequestIdMiddleware generates UUID when no incoming header provided', () => {
  const middleware = new RequestIdMiddleware();
  const req = { headers: {} } as Request;
  const setHeaders: Record<string, string> = {};
  const res = {
    setHeader: (key: string, value: string) => {
      setHeaders[key.toLowerCase()] = value;
    },
  } as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware.use(req, res, next);

  assert.equal(nextCalled, true);
  const generatedId = (req as unknown as { id: string }).id;
  assert.ok(generatedId);
  assert.equal(req.headers[REQUEST_ID_HEADER], generatedId);
  assert.equal(setHeaders[REQUEST_ID_HEADER], generatedId);
});

void test('RequestIdMiddleware preserves incoming valid request ID', () => {
  const middleware = new RequestIdMiddleware();
  const existingId = 'req-custom-client-12345';
  const req = { headers: { [REQUEST_ID_HEADER]: existingId } } as unknown as Request;
  const setHeaders: Record<string, string> = {};
  const res = {
    setHeader: (key: string, value: string) => {
      setHeaders[key.toLowerCase()] = value;
    },
  } as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware.use(req, res, next);

  assert.equal(nextCalled, true);
  assert.equal((req as unknown as { id: string }).id, existingId);
  assert.equal(setHeaders[REQUEST_ID_HEADER], existingId);
});

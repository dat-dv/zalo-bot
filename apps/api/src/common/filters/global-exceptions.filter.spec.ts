import assert from 'node:assert/strict';
import test from 'node:test';
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { GlobalExceptionsFilter } from './global-exceptions.filter';
import { IApiErrorResponse } from '@zalobot/contracts';

interface MockResponseState {
  statusCode: number;
  body: IApiErrorResponse | null;
}

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (body: IApiErrorResponse) => MockResponse;
}

function createMockHost(
  req: { method: string; url: string },
  state: MockResponseState,
  type = 'http',
): ArgumentsHost {
  const mockResponse: MockResponse = {
    status(code: number) {
      state.statusCode = code;
      return mockResponse;
    },
    json(body: IApiErrorResponse) {
      state.body = body;
      return mockResponse;
    },
  };

  return {
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => mockResponse,
      getNext: (): undefined => undefined,
    }),
  } as unknown as ArgumentsHost;
}

void test('GlobalExceptionsFilter handles standard NotFoundException', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'GET', url: '/api/transactions/999' }, state);

  filter.catch(new NotFoundException('Transaction not found'), host);

  assert.equal(state.statusCode, 404);
  assert.equal(state.body?.statusCode, 404);
  assert.equal(state.body?.message, 'Transaction not found');
  assert.equal(state.body?.path, '/api/transactions/999');
});

void test('GlobalExceptionsFilter handles BadRequestException with array validation messages', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'POST', url: '/api/transactions' }, state);

  filter.catch(
    new BadRequestException({
      statusCode: 400,
      message: ['amount must be a positive number', 'note should not be empty'],
      error: 'Bad Request',
    }),
    host,
  );

  assert.equal(state.statusCode, 400);
  assert.equal(state.body?.statusCode, 400);
  assert.deepEqual(state.body?.message, [
    'amount must be a positive number',
    'note should not be empty',
  ]);
  assert.equal(state.body?.error, 'Bad Request');
  assert.equal(state.body?.path, '/api/transactions');
});

void test('GlobalExceptionsFilter handles TypeORM EntityNotFoundError as 404', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'GET', url: '/api/contacts/123' }, state);

  filter.catch(new EntityNotFoundError('Contact', { id: '123' }), host);

  assert.equal(state.statusCode, 404);
  assert.equal(state.body?.statusCode, 404);
  assert.equal(state.body?.message, 'Resource not found');
  assert.equal(state.body?.error, 'Not Found');
});

void test('GlobalExceptionsFilter handles TypeORM QueryFailedError constraint as 409 Conflict', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'POST', url: '/api/users' }, state);

  const queryError = new QueryFailedError(
    'INSERT INTO user...',
    [],
    new Error('duplicate key value violates unique constraint "users_pkey" (23505)'),
  );

  filter.catch(queryError, host);

  assert.equal(state.statusCode, 409);
  assert.equal(state.body?.statusCode, 409);
  assert.equal(state.body?.message, 'Database constraint violation');
  assert.equal(state.body?.error, 'Conflict');
});

void test('GlobalExceptionsFilter handles unhandled Error as 500', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'GET', url: '/api/crash' }, state);

  filter.catch(new Error('Unexpected disk read failure'), host);

  assert.equal(state.statusCode, 500);
  assert.equal(state.body?.statusCode, 500);
  assert.equal(state.body?.error, 'Internal Server Error');
});

void test('GlobalExceptionsFilter ignores non-http context safely', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const host = createMockHost({ method: 'BOT', url: '/bot' }, state, 'zalograf');

  filter.catch(new Error('Bot message handler failed'), host);

  // In non-http context, response should not be modified
  assert.equal(state.statusCode, 0);
  assert.equal(state.body, null);
});

void test('GlobalExceptionsFilter includes requestId in response body and header', () => {
  const filter = new GlobalExceptionsFilter();
  const state: MockResponseState = { statusCode: 0, body: null };
  const setHeaders: Record<string, string> = {};
  const mockResponse = {
    status(code: number) {
      state.statusCode = code;
      return mockResponse;
    },
    json(body: IApiErrorResponse) {
      state.body = body;
      return mockResponse;
    },
    setHeader(key: string, value: string) {
      setHeaders[key.toLowerCase()] = value;
    },
  };

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/api/transactions/404',
        headers: { 'x-request-id': 'custom-req-trace-id' },
      }),
      getResponse: () => mockResponse,
      getNext: () => {},
    }),
  } as unknown as ArgumentsHost;

  filter.catch(new NotFoundException('Not found with trace'), host);

  assert.equal(state.statusCode, 404);
  assert.equal(state.body?.requestId, 'custom-req-trace-id');
  assert.equal(setHeaders['x-request-id'], 'custom-req-trace-id');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { ZaloService } from './zalo.service';

void test('ZaloService initializes and logs webhook configuration onModuleInit', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token_123';
      if (key === 'zalo.webhookUrl') return 'https://example.com/webhook';
      return undefined;
    },
  };

  const service = new ZaloService(mockConfigService as unknown as ConfigService);
  service.onModuleInit();
  assert.ok(service);
});

void test('ZaloService sendMessage returns false when botToken is missing', async () => {
  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  };

  const service = new ZaloService(mockConfigService as unknown as ConfigService);
  const result = await service.sendMessage('12345', 'Hello');
  assert.equal(result, false);
});

void test('ZaloService sendMessage sends POST request to Zalo Bot Platform API successfully', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'valid_token_xyz';
      return undefined;
    },
  };

  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestHeaders: Record<string, string> = {};
  let requestBody = '';

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestHeaders = (init?.headers as Record<string, string>) || {};
    requestBody = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 'm1' } }),
    } as Response);
  };

  try {
    const service = new ZaloService(mockConfigService as unknown as ConfigService);
    const result = await service.sendMessage('user_999', 'Xin chào');

    assert.equal(result, true);
    assert.match(requestUrl, /bot-api\.zaloplatforms\.com\/botvalid_token_xyz\/sendMessage/);
    assert.equal(requestHeaders['Content-Type'], 'application/json');
    assert.match(requestBody, /"chat_id":"user_999"/);
    assert.match(requestBody, /"text":"Xin chào"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('ZaloService sendMessage returns false when Zalo API returns error', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'valid_token_xyz';
      return undefined;
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.resolve({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ ok: false, description: 'Invalid token' }),
    } as Response);
  };

  try {
    const service = new ZaloService(mockConfigService as unknown as ConfigService);
    const result = await service.sendMessage('user_999', 'Xin chào');
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('ZaloService sendChatAction sends POST request to sendChatAction endpoint', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'valid_token_xyz';
      return undefined;
    },
  };

  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody = '';

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestBody = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
  };

  try {
    const service = new ZaloService(mockConfigService as unknown as ConfigService);
    const result = await service.sendChatAction('user_999', 'typing');

    assert.equal(result, true);
    assert.match(requestUrl, /bot-api\.zaloplatforms\.com\/botvalid_token_xyz\/sendChatAction/);
    assert.match(requestBody, /"chat_id":"user_999"/);
    assert.match(requestBody, /"action":"typing"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('ZaloService withChatAction automatically cleans up interval timer on completion and error', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'valid_token_xyz';
      return undefined;
    },
  };

  const originalFetch = globalThis.fetch;
  let chatActionCallCount = 0;

  globalThis.fetch = () => {
    chatActionCallCount++;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
  };

  try {
    const service = new ZaloService(mockConfigService as unknown as ConfigService);

    // Case 1: successful execution
    const result = await service.withChatAction('user_999', () => {
      return Promise.resolve('done');
    });
    assert.equal(result, 'done');
    assert.ok(chatActionCallCount >= 1);

    // Case 2: exception inside execution -> finally must clean up
    await assert.rejects(
      async () => {
        await service.withChatAction('user_999', () => {
          return Promise.reject(new Error('Simulation error'));
        });
      },
      { message: 'Simulation error' },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

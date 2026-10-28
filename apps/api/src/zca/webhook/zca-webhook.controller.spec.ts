import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadGatewayException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ThreadType } from 'zca-js';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { ZcaWebhookController } from './zca-webhook.controller';
import { WebhookApiKeyGuard } from './guards/webhook-api-key.guard';
import { isWebhookKeyValid } from './webhook-api-key';
import { WEBHOOK_MAX_CALLS, WebhookRateLimiter } from './webhook-rate-limiter';
import { toWebhookTargets } from './webhook-targets';
import { WebhookTargetsQueryDto } from './dto/webhook-targets-query.dto';
import type { AvailableThread } from '../zca.service';
import { WEBHOOK_MESSAGE_MAX_LENGTH, WebhookSendMessageDto } from './dto/webhook-send-message.dto';

const KEY = 'k'.repeat(32);

function guardWithKey(apiKey: string, headers: Record<string, string> = {}) {
  const failedIps: string[] = [];
  const ipLimiter = {
    recordFailedKey: (ip: string) => {
      failedIps.push(ip);
      return Promise.resolve(false);
    },
  };
  const guard = new WebhookApiKeyGuard({ get: () => apiKey } as never, ipLimiter as never);
  const request = { headers, ip: '10.0.0.9', get: (name: string) => headers[name.toLowerCase()] };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  return { check: () => guard.canActivate(context as never), failedIps };
}

interface SentMessage {
  targetId: string;
  message: string;
  type?: ThreadType;
  memoryKind?: string;
}

const DIRECTORY: AvailableThread[] = [
  {
    id: 'u-2',
    name: 'Trần Thị Bình',
    type: 'user',
    avatar: 'https://ava/u2',
    alias: 'Bình kế toán',
    phoneNumber: '0900000000',
    isListened: false,
  },
  {
    id: 'g-1',
    name: 'Nhóm Kế toán',
    type: 'group',
    avatar: '',
    totalMembers: 12,
    isListened: true,
  },
  { id: 'u-1', name: 'An Nguyễn', type: 'user', isListened: true },
  { id: 'g-old', name: 'Nhóm đã rời', type: 'group', isListened: true, missingFromZalo: true },
];

function createController(options: {
  loggedIn?: boolean;
  allowCall?: boolean;
  result?: { success: boolean; msgId?: string; cliMsgId?: string };
}) {
  const sent: SentMessage[] = [];
  const limiterScopes: string[] = [];
  const directoryCalls: boolean[] = [];
  const zcaService = {
    isLoggedIn: () => options.loggedIn ?? true,
    getAvailableThreads: (forceRefresh: boolean) => {
      directoryCalls.push(forceRefresh);
      return Promise.resolve(DIRECTORY);
    },
    getDirectoryFetchedAt: () => '2026-10-28T08:00:00.000Z',
  };
  const zcaMessenger = {
    sendMessageWithResult: (targetId: string, message: string, type?: ThreadType) => {
      sent.push({ targetId, message, type, memoryKind: OutgoingMemoryKind.current() });
      return Promise.resolve(
        options.result ?? { success: true, msgId: 'msg-1', cliMsgId: 'cli-1' },
      );
    },
  };
  const rateLimiter = {
    tryCall: (scope: string) => {
      limiterScopes.push(scope);
      return Promise.resolve(options.allowCall ?? true);
    },
    remaining: (scope: 'send' | 'targets' | 'status') =>
      Promise.resolve(WEBHOOK_MAX_CALLS[scope] - 1),
  };
  const controller = new ZcaWebhookController(
    zcaService as never,
    zcaMessenger as never,
    rateLimiter as never,
  );
  return { controller, sent, limiterScopes, directoryCalls };
}

async function validationErrors(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(WebhookSendMessageDto, body));
  return errors.map((error) => error.property);
}

void test('isWebhookKeyValid accepts the key from x-api-key or a Bearer header', () => {
  assert.equal(isWebhookKeyValid(KEY, { 'x-api-key': KEY }), true);
  assert.equal(isWebhookKeyValid(KEY, { 'x-api-key': ` ${KEY} ` }), true);
  assert.equal(isWebhookKeyValid(KEY, { authorization: `Bearer ${KEY}` }), true);
});

void test('isWebhookKeyValid rejects a missing, wrong or differently sized key', () => {
  assert.equal(isWebhookKeyValid(KEY, {}), false);
  assert.equal(isWebhookKeyValid(KEY, { 'x-api-key': 'wrong' }), false);
  assert.equal(isWebhookKeyValid(KEY, { 'x-api-key': `${KEY}x` }), false);
  assert.equal(isWebhookKeyValid(KEY, { authorization: KEY }), false);
  assert.equal(isWebhookKeyValid('', { 'x-api-key': '' }), false);
});

void test('WebhookApiKeyGuard answers 404 when WEBHOOK_API_KEY is not configured', async () => {
  const off = guardWithKey('', { 'x-api-key': KEY });
  await assert.rejects(off.check(), NotFoundException);
  // A webhook that is off is no wrong-key attempt.
  assert.deepEqual(off.failedIps, []);
});

void test('WebhookApiKeyGuard answers 401 on a wrong key and counts it for the caller IP', async () => {
  const wrong = guardWithKey(KEY, { 'x-api-key': 'wrong', 'cf-connecting-ip': '203.0.113.7' });
  await assert.rejects(wrong.check(), UnauthorizedException);
  assert.deepEqual(wrong.failedIps, ['203.0.113.7']);

  const right = guardWithKey(KEY, { 'x-api-key': KEY });
  assert.equal(await right.check(), true);
  assert.deepEqual(right.failedIps, []);
});

void test('WebhookSendMessageDto accepts a valid body', async () => {
  assert.deepEqual(
    await validationErrors({ targetId: '123', message: 'Xin chào', threadType: 'group' }),
    [],
  );
});

void test('WebhookSendMessageDto rejects blank, too long or unknown values', async () => {
  assert.deepEqual(await validationErrors({ targetId: '123', message: '   \n ' }), ['message']);
  assert.deepEqual(
    await validationErrors({
      targetId: '123',
      message: 'a'.repeat(WEBHOOK_MESSAGE_MAX_LENGTH + 1),
    }),
    ['message'],
  );
  assert.deepEqual(await validationErrors({ targetId: '  ', message: 'hi' }), ['targetId']);
  assert.deepEqual(
    await validationErrors({ targetId: '123', message: 'hi', threadType: 'channel' }),
    ['threadType'],
  );
});

void test('ZcaWebhookController sends with the thread type and returns msgId and cliMsgId', async () => {
  const { controller, sent } = createController({});

  const response = await controller.sendMessage({
    targetId: 'group-1',
    message: 'Hello',
    threadType: 'group',
  });

  assert.deepEqual(response, {
    success: true,
    data: { targetId: 'group-1', msgId: 'msg-1', cliMsgId: 'cli-1' },
  });
  assert.deepEqual(sent, [
    { targetId: 'group-1', message: 'Hello', type: ThreadType.Group, memoryKind: 'system' },
  ]);
});

void test('ZcaWebhookController leaves the thread type to auto-resolution when omitted', async () => {
  const { controller, sent } = createController({});

  await controller.sendMessage({ targetId: 'user-1', message: 'Hi', threadType: 'user' });
  await controller.sendMessage({ targetId: 'auto-1', message: 'Hi' });

  assert.deepEqual(
    sent.map((message) => message.type),
    [ThreadType.User, undefined],
  );
});

void test('ZcaWebhookController answers 429 over the rate limit without sending', async () => {
  const { controller, sent } = createController({ allowCall: false });

  await assert.rejects(
    () => controller.sendMessage({ targetId: 'user-1', message: 'Hi' }),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
  assert.equal(sent.length, 0);
});

void test('ZcaWebhookController answers 503 when ZCA is not logged in', async () => {
  const { controller, sent } = createController({ loggedIn: false });

  await assert.rejects(
    () => controller.sendMessage({ targetId: 'user-1', message: 'Hi' }),
    ServiceUnavailableException,
  );
  assert.equal(sent.length, 0);
});

void test('ZcaWebhookController answers 502 when the send fails or nothing went out', async () => {
  for (const result of [{ success: false }, { success: true }]) {
    const { controller } = createController({ result });
    await assert.rejects(
      () => controller.sendMessage({ targetId: 'user-1', message: 'Hi' }),
      BadGatewayException,
    );
  }
});

void test('WebhookRateLimiter blocks the call after the cap within one window', async () => {
  const counts = new Map<string, number>();
  const limiter = new WebhookRateLimiter({
    incrWithTtl: (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve(next);
    },
    get: (key: string) => Promise.resolve(String(counts.get(key) ?? '') || null),
  });

  for (let i = 0; i < WEBHOOK_MAX_CALLS.send; i++) {
    assert.equal(await limiter.tryCall('send'), true);
  }
  assert.equal(await limiter.tryCall('send'), false);
  // Listing targets has its own counter, so a full send window does not block it.
  assert.equal(await limiter.tryCall('targets'), true);
});

void test('WebhookRateLimiter counts in process when Redis is unavailable', async () => {
  const limiter = new WebhookRateLimiter({
    incrWithTtl: () => Promise.resolve(null),
    get: () => Promise.resolve(null),
  });
  const start = 1_000_000;

  for (let i = 0; i < WEBHOOK_MAX_CALLS.targets; i++) {
    assert.equal(await limiter.tryCall('targets', start), true);
  }
  assert.equal(await limiter.tryCall('targets', start), false);
  assert.equal(await limiter.tryCall('send', start), true);
  // A new window starts once the old one has expired.
  assert.equal(await limiter.tryCall('targets', start + 61_000), true);
});

void test('toWebhookTargets lists groups first, then people by name, without private fields', () => {
  assert.deepEqual(toWebhookTargets(DIRECTORY.slice(0, 3), {}), [
    { id: 'g-1', name: 'Nhóm Kế toán', type: 'group', avatar: null, totalMembers: 12 },
    { id: 'u-1', name: 'An Nguyễn', type: 'user', avatar: null },
    { id: 'u-2', name: 'Trần Thị Bình', type: 'user', avatar: 'https://ava/u2' },
  ]);
});

void test('toWebhookTargets filters by type and by name without diacritics', () => {
  const ids = (query: { type?: 'user' | 'group'; q?: string }) =>
    toWebhookTargets(DIRECTORY.slice(0, 3), query).map((target) => target.id);

  assert.deepEqual(ids({ type: 'user' }), ['u-1', 'u-2']);
  assert.deepEqual(ids({ q: 'ke toan' }), ['g-1']);
  assert.deepEqual(ids({ q: 'BÌNH' }), ['u-2']);
  assert.deepEqual(ids({ type: 'group', q: 'binh' }), []);
});

void test('WebhookTargetsQueryDto rejects an unknown type or a too long q', async () => {
  const errors = async (query: Record<string, unknown>) =>
    (await validate(plainToInstance(WebhookTargetsQueryDto, query))).map((e) => e.property);

  assert.deepEqual(await errors({ type: 'group', q: 'ke toan' }), []);
  assert.deepEqual(await errors({ type: 'channel' }), ['type']);
  assert.deepEqual(await errors({ q: 'a'.repeat(101) }), ['q']);
});

void test('ZcaWebhookController lists targets from the cached directory, skipping left groups', async () => {
  const { controller, limiterScopes, directoryCalls } = createController({});

  const response = await controller.listTargets({ type: 'group' });

  assert.deepEqual(response, {
    success: true,
    data: {
      items: [{ id: 'g-1', name: 'Nhóm Kế toán', type: 'group', avatar: null, totalMembers: 12 }],
      fetchedAt: '2026-10-28T08:00:00.000Z',
    },
  });
  assert.deepEqual(limiterScopes, ['targets']);
  assert.deepEqual(directoryCalls, [false]);
});

void test('ZcaWebhookController answers 429 or 503 for targets without reading the directory', async () => {
  const limited = createController({ allowCall: false });
  await assert.rejects(
    () => limited.controller.listTargets({}),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
  assert.equal(limited.directoryCalls.length, 0);

  const loggedOut = createController({ loggedIn: false });
  await assert.rejects(() => loggedOut.controller.listTargets({}), ServiceUnavailableException);
  assert.equal(loggedOut.directoryCalls.length, 0);
});

void test('WebhookRateLimiter.remaining reads the window without recording a call', async () => {
  const counts = new Map<string, number>();
  const limiter = new WebhookRateLimiter({
    incrWithTtl: (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve(next);
    },
    get: (key: string) => Promise.resolve(counts.has(key) ? String(counts.get(key)) : null),
  });

  assert.equal(await limiter.remaining('send'), WEBHOOK_MAX_CALLS.send);
  await limiter.tryCall('send');
  await limiter.tryCall('send');
  assert.equal(await limiter.remaining('send'), WEBHOOK_MAX_CALLS.send - 2);
  assert.equal(await limiter.remaining('send'), WEBHOOK_MAX_CALLS.send - 2);
  assert.equal(await limiter.remaining('targets'), WEBHOOK_MAX_CALLS.targets);

  for (let i = 0; i < WEBHOOK_MAX_CALLS.send + 5; i++) await limiter.tryCall('send');
  assert.equal(await limiter.remaining('send'), 0);
});

void test('WebhookRateLimiter.remaining uses the in-process counter while Redis is down', async () => {
  const limiter = new WebhookRateLimiter({
    incrWithTtl: () => Promise.resolve(null),
    get: () => Promise.resolve(null),
  });
  const start = 1_000_000;

  await limiter.tryCall('targets', start);
  await limiter.tryCall('targets', start);
  assert.equal(await limiter.remaining('targets', start), WEBHOOK_MAX_CALLS.targets - 2);
  // The window is over: the full quota is back.
  assert.equal(await limiter.remaining('targets', start + 61_000), WEBHOOK_MAX_CALLS.targets);
});

void test('ZcaWebhookController status reports a logged-out bot with 200 and ready false', async () => {
  const { controller, limiterScopes, directoryCalls } = createController({ loggedIn: false });

  const response = await controller.getStatus();

  assert.equal(response.success, true);
  assert.equal(response.data.ready, false);
  assert.equal(response.data.zaloLoggedIn, false);
  assert.equal(response.data.directoryFetchedAt, '2026-10-28T08:00:00.000Z');
  assert.deepEqual(response.data.limits, {
    send: {
      limit: WEBHOOK_MAX_CALLS.send,
      remaining: WEBHOOK_MAX_CALLS.send - 1,
      windowSeconds: 60,
    },
    targets: {
      limit: WEBHOOK_MAX_CALLS.targets,
      remaining: WEBHOOK_MAX_CALLS.targets - 1,
      windowSeconds: 60,
    },
  });
  assert.deepEqual(Object.keys(response.data).sort(), [
    'checkedAt',
    'directoryFetchedAt',
    'limits',
    'ready',
    'zaloLoggedIn',
  ]);
  assert.deepEqual(limiterScopes, ['status']);
  assert.deepEqual(directoryCalls, []);
});

void test('ZcaWebhookController status is ready when logged in and answers 429 over its cap', async () => {
  const ready = await createController({}).controller.getStatus();
  assert.equal(ready.data.ready, true);

  await assert.rejects(
    () => createController({ allowCall: false }).controller.getStatus(),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
});

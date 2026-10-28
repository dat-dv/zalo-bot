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
import { WEBHOOK_MESSAGE_MAX_LENGTH, WebhookSendMessageDto } from './dto/webhook-send-message.dto';

const KEY = 'k'.repeat(32);

function guardWithKey(apiKey: string, headers: Record<string, string> = {}) {
  const guard = new WebhookApiKeyGuard({ get: () => apiKey } as never);
  const context = { switchToHttp: () => ({ getRequest: () => ({ headers }) }) };
  return () => guard.canActivate(context as never);
}

interface SentMessage {
  targetId: string;
  message: string;
  type?: ThreadType;
  memoryKind?: string;
}

function createController(options: {
  loggedIn?: boolean;
  allowCall?: boolean;
  result?: { success: boolean; msgId?: string; cliMsgId?: string };
}) {
  const sent: SentMessage[] = [];
  const zcaService = { isLoggedIn: () => options.loggedIn ?? true };
  const zcaMessenger = {
    sendMessageWithResult: (targetId: string, message: string, type?: ThreadType) => {
      sent.push({ targetId, message, type, memoryKind: OutgoingMemoryKind.current() });
      return Promise.resolve(
        options.result ?? { success: true, msgId: 'msg-1', cliMsgId: 'cli-1' },
      );
    },
  };
  const rateLimiter = { tryCall: () => Promise.resolve(options.allowCall ?? true) };
  const controller = new ZcaWebhookController(
    zcaService as never,
    zcaMessenger as never,
    rateLimiter as never,
  );
  return { controller, sent };
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

void test('WebhookApiKeyGuard answers 404 when WEBHOOK_API_KEY is not configured', () => {
  assert.throws(guardWithKey('', { 'x-api-key': KEY }), NotFoundException);
});

void test('WebhookApiKeyGuard answers 401 on a wrong key and lets the right key through', () => {
  assert.throws(guardWithKey(KEY, { 'x-api-key': 'wrong' }), UnauthorizedException);
  assert.equal(guardWithKey(KEY, { 'x-api-key': KEY })(), true);
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
  });

  for (let i = 0; i < WEBHOOK_MAX_CALLS; i++) {
    assert.equal(await limiter.tryCall(), true);
  }
  assert.equal(await limiter.tryCall(), false);
});

void test('WebhookRateLimiter counts in process when Redis is unavailable', async () => {
  const limiter = new WebhookRateLimiter({ incrWithTtl: () => Promise.resolve(null) });
  const start = 1_000_000;

  for (let i = 0; i < WEBHOOK_MAX_CALLS; i++) {
    assert.equal(await limiter.tryCall(start), true);
  }
  assert.equal(await limiter.tryCall(start), false);
  // A new window starts once the old one has expired.
  assert.equal(await limiter.tryCall(start + 61_000), true);
});

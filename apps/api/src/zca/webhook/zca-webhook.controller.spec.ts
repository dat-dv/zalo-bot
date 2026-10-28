import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ThreadType } from 'zca-js';
import type { IWebhookRecipient } from '@zalobot/contracts';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { ZcaWebhookController, recipientEntries } from './zca-webhook.controller';
import { WebhookApiKeyGuard } from './guards/webhook-api-key.guard';
import { isWebhookKeyValid } from './webhook-api-key';
import { WEBHOOK_MAX_CALLS, WebhookRateLimiter } from './webhook-rate-limiter';
import { toWebhookTargets } from './webhook-targets';
import { WebhookTargetsQueryDto } from './dto/webhook-targets-query.dto';
import type { AvailableThread } from '../zca.service';
import { WEBHOOK_MESSAGE_MAX_LENGTH, WebhookSendMessageDto } from './dto/webhook-send-message.dto';
import {
  UpdateWebhookRecipientsDto,
  WEBHOOK_RECIPIENTS_MAX,
} from './dto/update-webhook-recipients.dto';
import { compareRecipients } from './webhook-recipient.service';

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

const GROUP: IWebhookRecipient = { threadId: 'g-1', threadName: 'Kế toán', threadType: 'group' };
const USER: IWebhookRecipient = { threadId: 'u-1', threadName: 'An', threadType: 'user' };

function createController(options: {
  loggedIn?: boolean;
  allowCall?: boolean;
  recipients?: IWebhookRecipient[];
  /** Result per target id; targets left out get `result` (or a success). */
  results?: Record<string, { success: boolean; msgId?: string; cliMsgId?: string }>;
  result?: { success: boolean; msgId?: string; cliMsgId?: string };
}) {
  const saved = options.recipients ?? [GROUP, USER];
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
        options.results?.[targetId] ??
          options.result ?? { success: true, msgId: `msg-${targetId}`, cliMsgId: 'cli-1' },
      );
    },
  };
  const rateLimiter = {
    tryCall: (scope: string) => {
      limiterScopes.push(scope);
      return Promise.resolve(options.allowCall ?? true);
    },
  };
  const recipients = {
    list: () => Promise.resolve(saved),
    find: (threadId: string) =>
      Promise.resolve(saved.find((recipient) => recipient.threadId === threadId) ?? null),
  };
  const controller = new ZcaWebhookController(
    zcaService as never,
    zcaMessenger as never,
    rateLimiter as never,
    recipients as never,
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

void test('WebhookApiKeyGuard answers 404 when WEBHOOK_API_KEY is not configured', () => {
  assert.throws(guardWithKey('', { 'x-api-key': KEY }), NotFoundException);
});

void test('WebhookApiKeyGuard answers 401 on a wrong key and lets the right key through', () => {
  assert.throws(guardWithKey(KEY, { 'x-api-key': 'wrong' }), UnauthorizedException);
  assert.equal(guardWithKey(KEY, { 'x-api-key': KEY })(), true);
});

void test('WebhookSendMessageDto accepts a body with or without targetId', async () => {
  assert.deepEqual(await validationErrors({ targetId: '123', message: 'Xin chào' }), []);
  assert.deepEqual(await validationErrors({ message: 'Xin chào' }), []);
});

void test('WebhookSendMessageDto rejects blank or too long values', async () => {
  assert.deepEqual(await validationErrors({ targetId: '123', message: '   \n ' }), ['message']);
  assert.deepEqual(
    await validationErrors({
      targetId: '123',
      message: 'a'.repeat(WEBHOOK_MESSAGE_MAX_LENGTH + 1),
    }),
    ['message'],
  );
  assert.deepEqual(await validationErrors({ targetId: '  ', message: 'hi' }), ['targetId']);
  assert.deepEqual(await validationErrors({ targetId: '', message: 'hi' }), ['targetId']);
});

void test('UpdateWebhookRecipientsDto rejects a bad thread type and too many recipients', async () => {
  const errors = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(UpdateWebhookRecipientsDto, body))).map((e) => e.property);

  assert.deepEqual(await errors({ recipients: [GROUP, USER] }), []);
  assert.deepEqual(await errors({ recipients: [{ ...USER, threadType: 'channel' }] }), [
    'recipients',
  ]);
  const many = Array.from({ length: WEBHOOK_RECIPIENTS_MAX + 1 }, (_, i) => ({
    ...USER,
    threadId: `u${i}`,
  }));
  assert.deepEqual(await errors({ recipients: many }), ['recipients']);
});

void test('ZcaWebhookController sends to every saved recipient without targetId', async () => {
  const { controller, sent } = createController({});

  const response = await controller.sendMessage({ message: 'Hello' });

  assert.deepEqual(response, {
    success: true,
    data: {
      sent: 2,
      failed: 0,
      results: [
        {
          targetId: 'g-1',
          threadType: 'group',
          success: true,
          msgId: 'msg-g-1',
          cliMsgId: 'cli-1',
        },
        { targetId: 'u-1', threadType: 'user', success: true, msgId: 'msg-u-1', cliMsgId: 'cli-1' },
      ],
    },
  });
  assert.deepEqual(sent, [
    { targetId: 'g-1', message: 'Hello', type: ThreadType.Group, memoryKind: 'system' },
    { targetId: 'u-1', message: 'Hello', type: ThreadType.User, memoryKind: 'system' },
  ]);
});

void test('ZcaWebhookController sends only to targetId, with its saved thread type', async () => {
  const { controller, sent } = createController({});

  const response = await controller.sendMessage({ targetId: ' g-1 ', message: 'Hi' });

  assert.equal(response.data.sent, 1);
  assert.deepEqual(
    sent.map((message) => [message.targetId, message.type]),
    [['g-1', ThreadType.Group]],
  );
});

void test('ZcaWebhookController answers 403 for a targetId that is not a recipient', async () => {
  const { controller, sent } = createController({});

  await assert.rejects(
    () => controller.sendMessage({ targetId: 'u-2', message: 'Hi' }),
    ForbiddenException,
  );
  assert.equal(sent.length, 0);
});

void test('ZcaWebhookController answers 409 when no recipient is saved', async () => {
  const { controller } = createController({ recipients: [] });

  await assert.rejects(() => controller.sendMessage({ message: 'Hi' }), ConflictException);
});

void test('ZcaWebhookController reports a partial failure and still answers 200', async () => {
  const { controller } = createController({ results: { 'u-1': { success: false } } });

  const response = await controller.sendMessage({ message: 'Hi' });

  assert.equal(response.data.sent, 1);
  assert.equal(response.data.failed, 1);
  assert.deepEqual(response.data.results[1], {
    targetId: 'u-1',
    threadType: 'user',
    success: false,
  });
});

void test('compareRecipients puts groups first, then sorts by name', () => {
  const sorted = [
    USER,
    { threadId: 'g2', threadName: 'Ánh', threadType: 'group' as const },
    GROUP,
  ].sort(compareRecipients);
  assert.deepEqual(
    sorted.map((recipient) => recipient.threadId),
    ['g2', 'g-1', 'u-1'],
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

void test('ZcaWebhookController answers 502 when no recipient got the message', async () => {
  for (const result of [{ success: false }, { success: true }]) {
    const { controller } = createController({ result });
    await assert.rejects(
      () => controller.sendMessage({ targetId: 'u-1', message: 'Hi' }),
      BadGatewayException,
    );
    await assert.rejects(() => controller.sendMessage({ message: 'Hi' }), BadGatewayException);
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

  for (let i = 0; i < WEBHOOK_MAX_CALLS.send; i++) {
    assert.equal(await limiter.tryCall('send'), true);
  }
  assert.equal(await limiter.tryCall('send'), false);
  // Listing targets has its own counter, so a full send window does not block it.
  assert.equal(await limiter.tryCall('targets'), true);
});

void test('WebhookRateLimiter counts in process when Redis is unavailable', async () => {
  const limiter = new WebhookRateLimiter({ incrWithTtl: () => Promise.resolve(null) });
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

void test('ZcaWebhookController lists recipients from the cached directory', async () => {
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

void test('ZcaWebhookController lists only saved recipients, not the whole directory', async () => {
  const { controller } = createController({});

  const response = await controller.listTargets({});

  assert.deepEqual(
    response.data.items.map((target) => target.id),
    ['g-1', 'u-1'],
  );
});

void test('recipientEntries keeps the saved name for a recipient Zalo no longer returns', () => {
  const entries = recipientEntries(
    [
      GROUP,
      { threadId: 'g-old', threadName: 'Nhóm cũ', threadType: 'group' },
      { threadId: 'gone', threadName: null, threadType: 'user' },
    ],
    DIRECTORY,
  );

  assert.deepEqual(entries, [
    { id: 'g-1', name: 'Nhóm Kế toán', type: 'group', avatar: '', totalMembers: 12 },
    { id: 'g-old', name: 'Nhóm cũ', type: 'group', avatar: undefined, totalMembers: undefined },
    { id: 'gone', name: 'gone', type: 'user', avatar: undefined, totalMembers: undefined },
  ]);
});

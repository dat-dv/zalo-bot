import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ILlmProviderStatus } from '@zalobot/contracts';
import type { ReportsTokenService } from '../reports/reports-token.service';
import type { UsersService } from '../users/users.service';
import { LlmAdminController } from './llm-admin.controller';
import type { LlmProviderConfigService } from './llm-provider-config.service';
import type { LlmService } from './llm.service';

const ADMIN_ID = 'admin-1';
const GEMINI_ID = '11111111-1111-4111-8111-111111111111';
const tokens = {
  verifyAccessToken: (token: string) => {
    if (token === 'admin-token') return ADMIN_ID;
    if (token === 'user-token') return 'user-2';
    throw new UnauthorizedException();
  },
} as unknown as ReportsTokenService;
const users = {
  isAdmin: (id: string | number) => String(id) === ADMIN_ID,
} as unknown as UsersService;

const GEMINI: ILlmProviderStatus = {
  id: GEMINI_ID,
  name: 'gemini',
  kind: 'gemini',
  baseUrl: null,
  model: 'g',
  enabled: true,
  role: 'primary',
  configured: true,
  hasApiKey: true,
};

function bearer(token?: string): Request {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request;
}

function createController() {
  const calls: string[] = [];
  const llm = {
    pingProvider: (id: string) => {
      calls.push(`ping:${id}`);
      return Promise.resolve(
        id === GEMINI_ID ? { name: 'gemini', status: 'ok', latencyMs: 12 } : null,
      );
    },
  } as unknown as LlmService;
  const providers = {
    listStatuses: () => {
      calls.push('list');
      return Promise.resolve([GEMINI]);
    },
    create: (input: unknown) => {
      calls.push(`create:${JSON.stringify(input)}`);
      return Promise.resolve(GEMINI);
    },
    update: (id: string, patch: unknown) => {
      calls.push(`update:${id}:${JSON.stringify(patch)}`);
      return Promise.resolve(GEMINI);
    },
    remove: (id: string) => {
      calls.push(`remove:${id}`);
      return Promise.resolve();
    },
    reorder: (ids: string[]) => {
      calls.push(`reorder:${ids.join(',')}`);
      return Promise.resolve([GEMINI]);
    },
  } as unknown as LlmProviderConfigService;
  return { controller: new LlmAdminController(llm, providers, tokens, users), calls };
}

void test('LlmAdminController lists and pings for an admin, never returning an API key', async () => {
  const { controller } = createController();

  const list = await controller.list(bearer('admin-token'));
  assert.equal(list.data[0]?.name, 'gemini');
  assert.doesNotMatch(JSON.stringify(list), /apiKey"/);
  const result = await controller.ping(bearer('admin-token'), GEMINI_ID);
  assert.deepEqual(result.data, { name: 'gemini', status: 'ok', latencyMs: 12 });
});

void test('LlmAdminController refuses a non-admin before any read, write or paid call', async () => {
  const { controller, calls } = createController();
  const body = { name: 'x', kind: 'gemini', model: 'm' };

  await assert.rejects(controller.list(bearer('user-token')), ForbiddenException);
  await assert.rejects(controller.create(bearer('user-token'), body), ForbiddenException);
  await assert.rejects(
    controller.update(bearer('user-token'), GEMINI_ID, body),
    ForbiddenException,
  );
  await assert.rejects(controller.remove(bearer('user-token'), GEMINI_ID), ForbiddenException);
  await assert.rejects(controller.reorder(bearer('user-token'), { ids: [] }), ForbiddenException);
  await assert.rejects(controller.ping(bearer('user-token'), GEMINI_ID), ForbiddenException);
  await assert.rejects(controller.ping(bearer(), GEMINI_ID), UnauthorizedException);
  assert.deepEqual(calls, []);
});

void test('LlmAdminController parses bodies and answers 400 on invalid input', async () => {
  const { controller, calls } = createController();

  await controller.create(bearer('admin-token'), {
    name: ' Router ',
    kind: 'openai',
    baseUrl: 'https://r.example/v1/',
    model: 'chat',
    apiKey: 'k',
  });
  await controller.update(bearer('admin-token'), GEMINI_ID, { apiKey: '', enabled: false });
  await controller.reorder(bearer('admin-token'), { ids: [GEMINI_ID] });

  assert.deepEqual(calls, [
    'create:{"name":"router","kind":"openai","baseUrl":"https://r.example/v1","model":"chat","apiKey":"k","enabled":true}',
    `update:${GEMINI_ID}:{"enabled":false}`,
    `reorder:${GEMINI_ID}`,
  ]);
  await assert.rejects(
    controller.create(bearer('admin-token'), { name: 'x', kind: 'claude', model: 'm' }),
    BadRequestException,
  );
  await assert.rejects(
    controller.reorder(bearer('admin-token'), { ids: [GEMINI_ID, GEMINI_ID] }),
    BadRequestException,
  );
});

void test('LlmAdminController answers 404 for an unknown provider', async () => {
  const { controller } = createController();

  await assert.rejects(
    controller.ping(bearer('admin-token'), '22222222-2222-4222-8222-222222222222'),
    NotFoundException,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { ReportsTokenService } from '../reports/reports-token.service';
import type { UsersService } from '../users/users.service';
import { LlmAdminController } from './llm-admin.controller';
import type { LlmService } from './llm.service';

const ADMIN_ID = 'admin-1';
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

function bearer(token?: string): Request {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request;
}

function createController() {
  const calls: string[] = [];
  const llm = {
    getProviderStatuses: () => {
      calls.push('list');
      return [{ name: 'gemini', role: 'primary', model: 'g', configured: true }];
    },
    pingProvider: (name: string) => {
      calls.push(`ping:${name}`);
      return Promise.resolve(name === 'gemini' ? { name, status: 'ok', latencyMs: 12 } : null);
    },
  } as unknown as LlmService;
  return { controller: new LlmAdminController(llm, tokens, users), calls };
}

void test('LlmAdminController lists and pings for an admin', async () => {
  const { controller } = createController();

  assert.equal(controller.list(bearer('admin-token')).data[0]?.name, 'gemini');
  const result = await controller.ping(bearer('admin-token'), 'gemini');
  assert.deepEqual(result.data, { name: 'gemini', status: 'ok', latencyMs: 12 });
});

void test('LlmAdminController refuses a non-admin before any paid call', async () => {
  const { controller, calls } = createController();

  assert.throws(() => controller.list(bearer('user-token')), ForbiddenException);
  await assert.rejects(controller.ping(bearer('user-token'), 'gemini'), ForbiddenException);
  await assert.rejects(controller.ping(bearer(), 'gemini'), UnauthorizedException);
  assert.deepEqual(calls, []);
});

void test('LlmAdminController answers 404 for a provider outside the chain', async () => {
  const { controller } = createController();

  await assert.rejects(controller.ping(bearer('admin-token'), 'openai'), NotFoundException);
});

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ZcaController } from './zca.controller';
import type { ZcaService } from './zca.service';
import type { ThreadConfigService } from './thread-config.service';
import type { Request, Response } from 'express';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ReportsTokenService } from '../reports/reports-token.service';
import type { UsersService } from '../users/users.service';

const ADMIN_ID = 'admin-1';
const tokens = {
  verifyAccessToken: (token: string) => {
    if (token === 'admin-token') return ADMIN_ID;
    if (token === 'user-token') return 'user-2';
    throw new UnauthorizedException();
  },
  verifyRefreshToken: (token: string) => {
    if (token !== 'admin-refresh') throw new UnauthorizedException();
    return ADMIN_ID;
  },
} as unknown as ReportsTokenService;
const users = {
  isAdmin: (id: string | number) => String(id) === ADMIN_ID,
} as unknown as UsersService;

function bearer(token?: string): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
  } as unknown as Request;
}

void test('ZcaController.logout calls zcaService.logout and wraps in data envelope', async () => {
  let logoutCalled = false;
  const mockZcaService = {
    logout: async () => {
      await Promise.resolve();
      logoutCalled = true;
      return {
        success: true,
        message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
      };
    },
  } as unknown as ZcaService;

  const mockThreadConfigService = {} as unknown as ThreadConfigService;

  const controller = new ZcaController(mockZcaService, mockThreadConfigService, tokens, users);
  const result = await controller.logout(bearer('admin-token'));

  assert.strictEqual(logoutCalled, true);
  assert.deepStrictEqual(result, {
    data: {
      success: true,
      message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
    },
  });
});

void test('ZcaController.syncThreadMedia delegates to botFeatureService and wraps response', async () => {
  let capturedThreadId = '';
  let capturedBody: unknown;

  const mockBotFeatureService = {
    syncThreadMediaHistory: (threadId: string, body?: unknown) => {
      capturedThreadId = threadId;
      capturedBody = body;
      return Promise.resolve({
        threadId,
        scannedCount: 20,
        foundCount: 5,
        syncedCount: 5,
        skippedCount: 0,
        failedCount: 0,
        message: 'Thành công',
      });
    },
  } as unknown as import('./zca-bot-feature.service').ZcaBotFeatureService;

  const controller = new ZcaController(
    {} as unknown as ZcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
    mockBotFeatureService,
  );

  const res = await controller.syncThreadMedia(bearer('admin-token'), 'group-123', { limit: 100 });
  assert.strictEqual(capturedThreadId, 'group-123');
  assert.deepStrictEqual(capturedBody, { limit: 100 });
  assert.strictEqual(res.data.scannedCount, 20);
  assert.strictEqual(res.data.syncedCount, 5);
});

void test('ZcaController rejects missing tokens with 401 and non-admin users with 403', async () => {
  let logoutCalled = false;
  const zcaService = {
    logout: () => {
      logoutCalled = true;
      return Promise.resolve({ success: true, message: 'ok' });
    },
    isLoggedIn: () => true,
  } as unknown as ZcaService;
  const controller = new ZcaController(
    zcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
  );

  await assert.rejects(() => controller.logout(bearer()), UnauthorizedException);
  await assert.rejects(() => controller.logout(bearer('user-token')), ForbiddenException);
  assert.throws(() => controller.getStatus(bearer('user-token')), ForbiddenException);
  assert.strictEqual(logoutCalled, false);
});

void test('ZcaController.getQrImage serves the QR for a valid access key or admin refresh cookie only', () => {
  const zcaService = {
    isQrAccessKeyValid: (key?: string) => key === 'flow-key',
    getLatestQrBuffer: () => Buffer.from('png'),
  } as unknown as ZcaService;
  const controller = new ZcaController(
    zcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
  );
  let ended = 0;
  const res = {
    setHeader: (): void => undefined,
    end: () => {
      ended += 1;
    },
  } as unknown as Response;

  controller.getQrImage(bearer(), res, 'flow-key');
  const cookieReq = {
    headers: {},
    cookies: { reports_refresh: 'admin-refresh' },
  } as unknown as Request;
  controller.getQrImage(cookieReq, res);
  assert.strictEqual(ended, 2);

  assert.throws(() => controller.getQrImage(bearer(), res, 'wrong-key'), UnauthorizedException);
  assert.throws(() => controller.getQrImage(bearer('user-token'), res), ForbiddenException);
  assert.strictEqual(ended, 2);
});

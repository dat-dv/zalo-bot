import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ZcaController } from './zca.controller';
import type { ZcaService } from './zca.service';
import type { ThreadConfigService } from './thread-config.service';

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

  const controller = new ZcaController(mockZcaService, mockThreadConfigService);
  const result = await controller.logout();

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
    syncThreadMediaHistory: async (threadId: string, body?: unknown) => {
      capturedThreadId = threadId;
      capturedBody = body;
      return {
        threadId,
        scannedCount: 20,
        foundCount: 5,
        syncedCount: 5,
        skippedCount: 0,
        failedCount: 0,
        message: 'Thành công',
      };
    },
  } as unknown as import('./zca-bot-feature.service').ZcaBotFeatureService;

  const controller = new ZcaController(
    {} as unknown as ZcaService,
    {} as unknown as ThreadConfigService,
    mockBotFeatureService,
  );

  const res = await controller.syncThreadMedia('group-123', { limit: 100 });
  assert.strictEqual(capturedThreadId, 'group-123');
  assert.deepStrictEqual(capturedBody, { limit: 100 });
  assert.strictEqual(res.data.scannedCount, 20);
  assert.strictEqual(res.data.syncedCount, 5);
});

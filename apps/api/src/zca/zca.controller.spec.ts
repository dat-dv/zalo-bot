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

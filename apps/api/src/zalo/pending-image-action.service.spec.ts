import { test } from 'node:test';
import assert from 'node:assert';
import { PendingImageActionService } from './pending-image-action.service';

test('PendingImageActionService sets, gets and clears pending image actions in memory', async () => {
  const service = new PendingImageActionService();
  service.timeoutMs = 1000;

  const action = await service.setPending('user_123', {
    userId: 'user_123',
    chatId: 'chat_123',
    receiptUrl: '/api/receipts/test-uuid-1',
  });

  assert.strictEqual(action.userId, 'user_123');
  assert.strictEqual(action.receiptUrl, '/api/receipts/test-uuid-1');

  const retrieved = await service.getPending('user_123');
  assert.ok(retrieved);
  assert.strictEqual(retrieved?.receiptUrl, '/api/receipts/test-uuid-1');

  await service.clearPending('user_123');
  const afterClear = await service.getPending('user_123');
  assert.strictEqual(afterClear, undefined);

  service.clearAll();
});

test('PendingImageActionService expires actions after timeout', async () => {
  const service = new PendingImageActionService();
  service.timeoutMs = 50; // 50ms

  await service.setPending('user_expire', {
    userId: 'user_expire',
    chatId: 'chat_expire',
    receiptUrl: '/api/receipts/test-expire',
  });

  await new Promise((resolve) => setTimeout(resolve, 60));

  const expired = await service.getPending('user_expire');
  assert.strictEqual(expired, undefined);

  service.clearAll();
});

import { test } from 'node:test';
import assert from 'node:assert';
import { PendingImageActionService } from './pending-image-action.service';

void test('PendingImageActionService sets, gets and clears pending image actions in memory', async () => {
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

void test('PendingImageActionService expires actions after timeout', async () => {
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

void test('PendingImageActionService batches multiple images using addPendingImage', async () => {
  const service = new PendingImageActionService();
  service.timeoutMs = 1000;

  // 1. First image
  const res1 = await service.addPendingImage('user_batch', {
    userId: 'user_batch',
    chatId: 'chat_batch',
    receiptUrl: 'https://example.com/img1.jpg',
  });
  assert.strictEqual(res1.isNew, true);
  assert.strictEqual(res1.totalCount, 1);
  assert.deepStrictEqual(res1.action.receiptUrls, ['https://example.com/img1.jpg']);

  // 2. Second image arriving right after
  const res2 = await service.addPendingImage('user_batch', {
    userId: 'user_batch',
    chatId: 'chat_batch',
    receiptUrl: 'https://example.com/img2.jpg',
  });
  assert.strictEqual(res2.isNew, false);
  assert.strictEqual(res2.totalCount, 2);
  assert.deepStrictEqual(res2.action.receiptUrls, [
    'https://example.com/img1.jpg',
    'https://example.com/img2.jpg',
  ]);

  const retrieved = await service.getPending('user_batch');
  assert.strictEqual(retrieved?.receiptUrls.length, 2);

  service.clearAll();
});

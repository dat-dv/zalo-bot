import assert from 'node:assert/strict';
import test from 'node:test';
import { syncThreadMedia } from './zca-api';
import { httpClient } from '@/shared/api/http-client';

void test('syncThreadMedia calls API_ROUTES.zcaSyncThreadMedia with proper payload', async () => {
  let capturedUrl = '';
  let capturedBody: unknown;

  const originalPost = httpClient.post;
  httpClient.post = (async (url: string, body: unknown) => {
    capturedUrl = url;
    capturedBody = body;
    return {
      data: {
        data: {
          threadId: 'g-999',
          scannedCount: 50,
          foundCount: 5,
          syncedCount: 3,
          skippedCount: 2,
          failedCount: 0,
          message: 'Thành công',
        },
      },
    };
  }) as typeof httpClient.post;

  try {
    const res = await syncThreadMedia('g-999', { limit: 100, mediaTypes: ['image', 'video'] });
    assert.equal(capturedUrl, '/api/zca/threads/g-999/sync-media');
    assert.deepEqual(capturedBody, { limit: 100, mediaTypes: ['image', 'video'] });
    assert.equal(res.scannedCount, 50);
    assert.equal(res.syncedCount, 3);
    assert.equal(res.skippedCount, 2);
  } finally {
    httpClient.post = originalPost;
  }
});

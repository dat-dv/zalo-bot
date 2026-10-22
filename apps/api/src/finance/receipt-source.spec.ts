import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadDriveReceipt } from './receipt-source';

const image = { content: Buffer.from('img'), mimeType: 'image/jpeg' };

void test('downloadDriveReceipt reads with the shared token first', async () => {
  const calls: string[] = [];
  const drive = {
    downloadFile: (_id: string, userId?: string | number) => {
      calls.push(`token:${userId ?? 'shared'}`);
      return Promise.resolve(image);
    },
    downloadPublicFile: () => Promise.reject(new Error('unused')),
  };

  const result = await downloadDriveReceipt(drive, 'f1', { creatorUserId: 'u1', timeoutMs: 10 });

  assert.equal(result, image);
  assert.deepEqual(calls, ['token:shared']);
});

void test('downloadDriveReceipt falls back to the creator token, then the public link', async () => {
  const calls: string[] = [];
  const drive = {
    downloadFile: (_id: string, userId?: string | number) => {
      calls.push(`token:${userId ?? 'shared'}`);
      return Promise.reject(new Error('File not found'));
    },
    downloadPublicFile: (id: string) => {
      calls.push(`public:${id}`);
      return Promise.resolve(image);
    },
  };

  const result = await downloadDriveReceipt(drive, 'f1', { creatorUserId: 'u1', timeoutMs: 10 });

  assert.equal(result, image);
  assert.deepEqual(calls, ['token:shared', 'token:u1', 'public:f1']);
});

void test('downloadDriveReceipt reports the last error when every source fails', async () => {
  const drive = {
    downloadFile: () => Promise.reject(new Error('File not found')),
    downloadPublicFile: () => Promise.reject(new Error('public 403')),
  };

  await assert.rejects(() => downloadDriveReceipt(drive, 'f1', { timeoutMs: 10 }), /public 403/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { API_ROUTES } from '@zalobot/contracts';
import { consolidateLedger, getLedgerInfo, setLedgerOwner } from './users-api';
import { httpClient } from '@/shared/api/http-client';

void test('getLedgerInfo reads the admin ledger route', async () => {
  let capturedUrl = '';
  const originalGet = httpClient.get;
  httpClient.get = ((url: string) => {
    capturedUrl = url;
    return Promise.resolve({
      data: { data: { ownerUserId: 'owner-1', ownerName: 'Đạt', sources: [] } },
    });
  }) as typeof httpClient.get;

  try {
    const res = await getLedgerInfo();
    assert.equal(capturedUrl, API_ROUTES.ledger);
    assert.equal(res.ownerUserId, 'owner-1');
  } finally {
    httpClient.get = originalGet;
  }
});

void test('setLedgerOwner patches the owner route, including clearing with null', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const originalPatch = httpClient.patch;
  httpClient.patch = ((url: string, body: unknown) => {
    calls.push({ url, body });
    return Promise.resolve({ data: { data: { ownerUserId: null } } });
  }) as typeof httpClient.patch;

  try {
    await setLedgerOwner('owner-1');
    await setLedgerOwner(null);
    assert.deepEqual(calls, [
      { url: API_ROUTES.ledgerOwner, body: { userId: 'owner-1' } },
      { url: API_ROUTES.ledgerOwner, body: { userId: null } },
    ]);
  } finally {
    httpClient.patch = originalPatch;
  }
});

void test('consolidateLedger posts to the consolidate route', async () => {
  let capturedUrl = '';
  const originalPost = httpClient.post;
  httpClient.post = ((url: string) => {
    capturedUrl = url;
    return Promise.resolve({
      data: {
        data: {
          ownerUserId: 'owner-1',
          mergedUserIds: ['a', 'b'],
          counts: { transactions: 3, places: 1, contacts: 0, debts: 0, categories: 2 },
        },
      },
    });
  }) as typeof httpClient.post;

  try {
    const res = await consolidateLedger();
    assert.equal(capturedUrl, API_ROUTES.ledgerConsolidate);
    assert.deepEqual(res.mergedUserIds, ['a', 'b']);
  } finally {
    httpClient.post = originalPost;
  }
});

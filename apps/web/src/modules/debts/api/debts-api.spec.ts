import assert from 'node:assert/strict';
import test from 'node:test';
import { createDebtPayment, deleteDebtPayment } from './debts-api';
import { httpClient } from '@/shared/api/http-client';

void test('createDebtPayment posts to the per-debt payments route without debtId in the body', async () => {
  let capturedUrl = '';
  let capturedBody: unknown;

  const originalPost = httpClient.post;
  httpClient.post = (async (url: string, body: unknown) => {
    capturedUrl = url;
    capturedBody = body;
    return {
      data: {
        data: {
          debt: { id: 'debt-1' },
          payment: {
            id: 'pay-1',
            debtId: 'debt-1',
            userId: 'u1',
            amount: 50000,
            paymentDate: '2026-10-19T00:00:00.000Z',
            createdAt: '2026-10-19T00:00:00.000Z',
          },
        },
      },
    };
  }) as typeof httpClient.post;

  try {
    const res = await createDebtPayment({ debtId: 'debt-1', amount: 50000, note: 'trả nhanh' });
    assert.equal(capturedUrl, '/api/debts/debt-1/payments');
    assert.deepEqual(capturedBody, { amount: 50000, note: 'trả nhanh' });
    assert.equal(res.id, 'pay-1');
  } finally {
    httpClient.post = originalPost;
  }
});

void test('deleteDebtPayment calls the payment detail route', async () => {
  let capturedUrl = '';
  const originalDelete = httpClient.delete;
  httpClient.delete = (async (url: string) => {
    capturedUrl = url;
    return { data: { data: { deleted: true } } };
  }) as typeof httpClient.delete;

  try {
    const res = await deleteDebtPayment('debt-1', 'pay-1');
    assert.equal(capturedUrl, '/api/debts/debt-1/payments/pay-1');
    assert.equal(res.deleted, true);
  } finally {
    httpClient.delete = originalDelete;
  }
});

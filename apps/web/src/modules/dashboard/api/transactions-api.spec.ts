import assert from 'node:assert/strict';
import test from 'node:test';
import { API_ROUTES, type ITransactionListResponse } from '@zalobot/contracts';
import { listTransactions } from './transactions-api';
import { httpClient } from '@/shared/api/http-client';

void test('listTransactions sends period, type, search and paging as query params', async () => {
  let capturedUrl = '';
  let capturedParams: unknown;
  const payload: ITransactionListResponse = {
    items: [],
    total: 0,
    limit: 100,
    offset: 100,
    summary: { income: 0, expense: 0, count: 0 },
    ledgerBalance: 1_500_000,
    facets: { creators: [], categories: [] },
  };

  const originalGet = httpClient.get;
  httpClient.get = ((url: string, config?: { params?: unknown }) => {
    capturedUrl = url;
    capturedParams = config?.params;
    return Promise.resolve({ data: { data: payload } });
  }) as typeof httpClient.get;

  try {
    const query = {
      type: 'expense' as const,
      startAt: '2026-09-01T00:00:00.000Z',
      endAt: '2026-09-30T23:59:59.999Z',
      search: 'phở',
      limit: 100,
      offset: 100,
    };
    const res = await listTransactions(query);
    assert.equal(capturedUrl, API_ROUTES.transactions);
    assert.deepEqual(capturedParams, query);
    assert.equal(res.ledgerBalance, 1_500_000);
  } finally {
    httpClient.get = originalGet;
  }
});

void test('listTransactions sends list filters as repeated query keys', async () => {
  let capturedConfig: Parameters<typeof httpClient.getUri>[0];
  const originalGet = httpClient.get;
  httpClient.get = ((url: string, config?: Parameters<typeof httpClient.getUri>[0]) => {
    capturedConfig = { ...config, url };
    return Promise.resolve({ data: { data: {} } });
  }) as typeof httpClient.get;

  try {
    await listTransactions({ categories: ['Ăn, uống', 'Đi lại'], placeIds: ['none'] });
    const uri = new URL(httpClient.getUri(capturedConfig), 'http://localhost');
    assert.deepEqual(uri.searchParams.getAll('categories'), ['Ăn, uống', 'Đi lại']);
    assert.deepEqual(uri.searchParams.getAll('placeIds'), ['none']);
  } finally {
    httpClient.get = originalGet;
  }
});

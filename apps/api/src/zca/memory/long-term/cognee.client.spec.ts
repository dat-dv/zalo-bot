import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { CogneeClient, cogneeDatasetName } from './cognee.client';

interface SeenRequest {
  url: string;
  method: string;
  auth: string | null;
  body: string | null;
}

/** Replaces `fetch` with canned answers per path, recording every request. */
function stubFetch(answers: Record<string, () => Response>): {
  seen: SeenRequest[];
  restore: () => void;
} {
  const original = globalThis.fetch;
  const seen: SeenRequest[] = [];
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const headers = new Headers(init?.headers);
    seen.push({
      url,
      method: init?.method ?? 'GET',
      auth: headers.get('Authorization'),
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const path = Object.keys(answers).find((key) => url.endsWith(key));
    return Promise.resolve(path ? answers[path]() : new Response('not found', { status: 404 }));
  };
  return { seen, restore: () => (globalThis.fetch = original) };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function client(settings: Partial<Record<'url' | 'userPassword', string>> = {}): CogneeClient {
  const config = {
    get: () => ({
      url: settings.url ?? 'http://cognee:8000',
      userEmail: 'zalobot@example.com',
      userPassword: settings.userPassword ?? 'secret',
      timeoutMs: 1000,
    }),
  } as unknown as ConfigService;
  return new CogneeClient(config);
}

void test('CogneeClient is off without a URL or password and then never calls out', async () => {
  const { seen, restore } = stubFetch({});
  try {
    const off = client({ userPassword: '' });
    assert.equal(off.isEnabled(), false);
    assert.equal(await off.remember('zca-1', 'a.txt', 'x'), null);
    assert.deepEqual(await off.recallContext('zca-1', 'q'), []);
    assert.equal(seen.length, 0);
  } finally {
    restore();
  }
});

void test('CogneeClient signs in once, remembers a day and returns its dataset and item ids', async () => {
  const { seen, restore } = stubFetch({
    '/auth/login': () => json({ access_token: 'tok' }),
    '/remember': () => json({ status: 'completed', dataset_id: 'ds-1', items: [{ id: 'item-1' }] }),
  });
  try {
    const cognee = client();
    assert.deepEqual(await cognee.remember(cogneeDatasetName('123'), '123_2026-10-25.txt', 'x'), {
      datasetId: 'ds-1',
      dataId: 'item-1',
    });
    await cognee.remember('zca-123', 'b.txt', 'y');
    assert.equal(seen.filter((request) => request.url.endsWith('/auth/login')).length, 1);
    assert.equal(seen[1].auth, 'Bearer tok');
    assert.equal(seen[1].url, 'http://cognee:8000/api/v1/remember');
  } finally {
    restore();
  }
});

void test('CogneeClient recalls only context of the chat dataset; an unknown dataset is empty', async () => {
  const { seen, restore } = stubFetch({
    '/auth/login': () => json({ access_token: 'tok' }),
    '/recall': () => json([{ kind: 'graph_completion', text: ' Đạt -- is -- chồng Hằng ' }]),
  });
  try {
    const cognee = client();
    assert.deepEqual(await cognee.recallContext('zca-1', 'chồng Hằng là ai', { temporal: true }), [
      'Đạt -- is -- chồng Hằng',
    ]);
    assert.deepEqual(JSON.parse(seen[1].body ?? ''), {
      query: 'chồng Hằng là ai',
      datasets: ['zca-1'],
      search_type: 'TEMPORAL',
      only_context: true,
      top_k: 10,
    });
  } finally {
    restore();
  }

  const missing = stubFetch({ '/auth/login': () => json({ access_token: 'tok' }) });
  try {
    assert.deepEqual(await client().recallContext('zca-new', 'q'), []);
  } finally {
    missing.restore();
  }
});

void test('CogneeClient signs in again once when its token is refused', async () => {
  let rememberCalls = 0;
  const { seen, restore } = stubFetch({
    '/auth/login': () => json({ access_token: `tok-${seen.length}` }),
    '/forget': () => {
      rememberCalls += 1;
      return rememberCalls === 1 ? json({}, 401) : json({ status: 'success' });
    },
  });
  try {
    assert.equal(await client().forget('ds-1', 'item-1'), true);
    assert.equal(seen.filter((request) => request.url.endsWith('/auth/login')).length, 2);
  } finally {
    restore();
  }
});

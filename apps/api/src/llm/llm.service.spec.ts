import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import type { LlmProviderKind } from '@zalobot/contracts';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import { LlmService } from './llm.service';
import {
  resolveLlmProvider,
  type LlmChainSource,
  type ResolvedLlmProvider,
} from './llm-provider-config.service';
import type { LlmCallConfig, LlmResponse } from './types/llm.types';

const config = new ConfigService({});

function urlOf(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}

void test('GeminiProvider flags a missing API key as failed', async () => {
  const provider = new GeminiProvider(config);
  const res = await provider.generate({ baseUrl: '', model: 'g', apiKey: '' }, 'hello');
  assert.equal(res.failed, true);
  assert.match(res.text || '', /Chưa cấu hình API Key/);
});

void test('GeminiProvider calls the model of its row and parses functionCall', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = '';
  let calledUrl = '';
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    calledUrl = urlOf(input);
    requestBody = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'MANAGE_DEBT',
                      args: { direction: 'payable', counterparty: 'a', amount: 100000 },
                    },
                  },
                ],
              },
            },
          ],
        }),
    } as Response);
  };

  try {
    const res = await new GeminiProvider(config).generate(
      { baseUrl: '', model: 'gemini-2.5-flash', apiKey: 'mock_gemini_key' },
      'nợ a 100k',
      [{ name: 'MANAGE_DEBT', description: 'Ghi nợ' }],
      'system prompt',
    );

    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'MANAGE_DEBT');
    assert.equal(res.toolCall.args.amount, 100000);
    assert.match(requestBody, /"functionDeclarations"/);
    assert.match(calledUrl, /models\/gemini-2\.5-flash:generateContent/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('OpenAiProvider calls the base URL of its row and parses tool_calls', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  let auth = '';
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    calledUrl = urlOf(input);
    auth = new Headers(init?.headers).get('authorization') ?? '';
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: 'RECORD_TRANSACTION',
                      arguments: JSON.stringify({ type: 'expense', amount: 35000 }),
                    },
                  },
                ],
              },
            },
          ],
        }),
    } as Response);
  };

  try {
    const res = await new OpenAiProvider(config).generate(
      { baseUrl: 'https://router.example/v1/', model: 'chat-daily', apiKey: 'k' },
      'ăn phở 35k',
      [{ name: 'RECORD_TRANSACTION', description: 'Thu chi' }],
    );

    assert.equal(calledUrl, 'https://router.example/v1/chat/completions');
    assert.equal(auth, 'Bearer k');
    assert.equal(res.toolCall?.name, 'RECORD_TRANSACTION');
    assert.equal(res.toolCall?.args.amount, 35000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('OpenAiProvider fails without a model, key or URL instead of guessing one', async () => {
  const provider = new OpenAiProvider(config);
  const base: LlmCallConfig = { baseUrl: 'https://r/v1', model: 'm', apiKey: 'k' };
  assert.equal((await provider.generate({ ...base, model: '' }, 'hi')).failed, true);
  assert.equal((await provider.generate({ ...base, apiKey: '' }, 'hi')).failed, true);
  assert.equal((await provider.generate({ ...base, baseUrl: '' }, 'hi')).failed, true);
});

void test('QwenProvider calls Ollama native /api/chat and parses tool_calls', async () => {
  let requestedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    requestedUrl = urlOf(input);
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            content: '',
            tool_calls: [
              {
                function: {
                  name: 'MANAGE_DEBT',
                  arguments: { direction: 'payable', counterparty: 'a', amount: 100000 },
                },
              },
            ],
          },
        }),
    } as Response);
  };

  try {
    const res = await new QwenProvider(config).generate(
      { baseUrl: 'http://localhost:11434', model: 'qwen2.5:14b', apiKey: '' },
      'nợ a 100k',
      [{ name: 'MANAGE_DEBT', description: 'Quản lý nợ' }],
    );

    assert.equal(requestedUrl, 'http://localhost:11434/api/chat');
    assert.equal(res.toolCall?.name, 'MANAGE_DEBT');
    assert.equal(res.toolCall?.args.counterparty, 'a');
    assert.equal(res.toolCall?.args.amount, 100000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('QwenProvider handles connection errors gracefully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

  try {
    const res = await new QwenProvider(config).generate(
      { baseUrl: 'http://localhost:11434', model: 'q', apiKey: '' },
      'test',
    );
    assert.match(res.text || '', /Không thể kết nối tới mô hình Qwen 14B/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

interface StubClient {
  calls: LlmCallConfig[];
  generate: (callConfig: LlmCallConfig) => Promise<LlmResponse>;
}

/** Answers per model name, so one client can serve several rows of the same kind. */
function stubClient(answers: Record<string, LlmResponse>): StubClient {
  const stub: StubClient = {
    calls: [],
    generate: (callConfig) => {
      stub.calls.push(callConfig);
      return Promise.resolve(answers[callConfig.model] ?? { text: '', failed: true });
    },
  };
  return stub;
}

function row(
  name: string,
  kind: LlmProviderKind,
  options: { enabled?: boolean; apiKey?: string; model?: string } = {},
): ResolvedLlmProvider {
  const apiKey = options.apiKey ?? 'key';
  return resolveLlmProvider(
    {
      id: `id-${name}`,
      name,
      kind,
      enabled: options.enabled ?? true,
      baseUrl: null,
      model: options.model ?? name,
    },
    apiKey,
    Boolean(apiKey),
  );
}

function createService(
  rows: ResolvedLlmProvider[],
  clients: { gemini?: StubClient; openai?: StubClient; ollama?: StubClient },
): LlmService {
  const source: LlmChainSource = {
    getChain: () => Promise.resolve(rows.filter((provider) => provider.enabled)),
    findResolved: (id) => Promise.resolve(rows.find((provider) => provider.id === id) ?? null),
  };
  return new LlmService(
    source,
    (clients.gemini ?? stubClient({})) as unknown as GeminiProvider,
    (clients.openai ?? stubClient({})) as unknown as OpenAiProvider,
    (clients.ollama ?? stubClient({})) as unknown as QwenProvider,
  );
}

void test('LlmService dispatches each row to the client of its kind with the row config', async () => {
  const openai = stubClient({ 'chat-daily': { text: 'router reply' } });
  const service = createService([row('router', 'openai', { model: 'chat-daily' })], { openai });

  const res = await service.generate('hi');

  assert.equal(res.text, 'router reply');
  assert.deepEqual(openai.calls, [
    { baseUrl: 'https://api.openai.com/v1', model: 'chat-daily', apiKey: 'key' },
  ]);
});

void test('LlmService chain: primary success never calls the fallback', async () => {
  const openai = stubClient({ router: { text: 'router reply' } });
  const gemini = stubClient({ gemini: { text: 'gemini reply' } });
  const service = createService([row('router', 'openai'), row('gemini', 'gemini')], {
    openai,
    gemini,
  });

  assert.equal((await service.generate('hi')).text, 'router reply');
  assert.equal(gemini.calls.length, 0);
});

void test('LlmService chain: failed primary falls back and keeps cleaned tool calls', async () => {
  const openai = stubClient({
    router: { text: 'Có lỗi khi kết nối tới mô hình AI.', failed: true },
  });
  const gemini = stubClient({
    gemini: {
      toolCall: { name: 'RECORD_TRANSACTION', args: { amount: { amount: 45000 } } },
      toolCalls: [
        { name: 'RECORD_TRANSACTION', args: { amount: { amount: 45000 } } },
        {
          name: 'RECORD_TRANSACTION',
          args: { amount: { value: 20000 }, placeName: { name: 'ct' } },
        },
      ],
    },
  });
  const service = createService([row('router', 'openai'), row('gemini', 'gemini')], {
    openai,
    gemini,
  });

  const res = await service.generate('ăn trưa 45k');

  assert.equal(openai.calls.length, 1);
  assert.equal(gemini.calls.length, 1);
  assert.equal(res.toolCall?.args.amount, 45000);
  assert.equal(res.toolCalls?.[1]?.args.amount, 20000);
  assert.equal(res.toolCalls?.[1]?.args.placeName, 'ct');
  assert.equal(res.failed, undefined);
});

void test('LlmService chain: empty answer counts as failure', async () => {
  const service = createService([row('router', 'openai'), row('gemini', 'gemini')], {
    openai: stubClient({ router: { text: '   ' } }),
    gemini: stubClient({ gemini: { text: 'gemini reply' } }),
  });

  assert.equal((await service.generate('hi')).text, 'gemini reply');
});

void test('LlmService chain: all failing returns the last error message', async () => {
  const service = createService([row('router', 'openai'), row('gemini', 'gemini')], {
    openai: stubClient({ router: { text: 'router down', failed: true } }),
    gemini: stubClient({ gemini: { text: 'Có lỗi khi kết nối tới mô hình AI.', failed: true } }),
  });

  const res = await service.generate('hi');

  assert.equal(res.text, 'Có lỗi khi kết nối tới mô hình AI.');
  assert.equal(res.failed, true);
});

void test('LlmService chain: two rows of one kind are separate links', async () => {
  const openai = stubClient({ cheap: { text: '', failed: true }, smart: { text: 'smart reply' } });
  const service = createService(
    [
      row('router-cheap', 'openai', { model: 'cheap' }),
      row('router-smart', 'openai', { model: 'smart' }),
    ],
    { openai },
  );

  assert.equal((await service.generate('hi')).text, 'smart reply');
  assert.deepEqual(
    openai.calls.map((call) => call.model),
    ['cheap', 'smart'],
  );
});

void test('LlmService chain: turned-off rows are skipped, no row at all fails clearly', async () => {
  const gemini = stubClient({ gemini: { text: 'gemini reply' } });
  const offOnly = createService([row('gemini', 'gemini', { enabled: false })], { gemini });

  const res = await offOnly.generate('hi');

  assert.equal(res.failed, true);
  assert.match(res.text || '', /chưa được cấu hình AI/);
  assert.equal(gemini.calls.length, 0);
});

void test('LlmService.pingProvider tests one provider alone: a failure never reaches the fallback', async () => {
  const secretError = 'boom https://example.test/?key=secret';
  const openai = stubClient({ router: { text: secretError, failed: true } });
  const gemini = stubClient({ gemini: { text: 'pong' } });
  const service = createService([row('router', 'openai'), row('gemini', 'gemini')], {
    openai,
    gemini,
  });

  const result = await service.pingProvider('id-router');

  assert.equal(result?.name, 'router');
  assert.equal(result?.status, 'failed');
  assert.equal(typeof result?.latencyMs, 'number');
  assert.equal(gemini.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

void test('LlmService.pingProvider reports ok, empty, and works on a turned-off row', async () => {
  const service = createService(
    [row('router', 'openai'), row('gemini', 'gemini', { enabled: false })],
    {
      openai: stubClient({ router: { text: '  ' } }),
      gemini: stubClient({ gemini: { text: 'pong' } }),
    },
  );

  assert.equal((await service.pingProvider('id-gemini'))?.status, 'ok');
  assert.equal((await service.pingProvider('id-router'))?.status, 'empty');
});

void test('LlmService.pingProvider makes no call for an unconfigured row and refuses unknown ids', async () => {
  const gemini = stubClient({ gemini: { text: 'pong' } });
  const service = createService([row('gemini', 'gemini', { apiKey: '' })], { gemini });

  assert.deepEqual(await service.pingProvider('id-gemini'), {
    name: 'gemini',
    status: 'not_configured',
    latencyMs: null,
  });
  assert.equal(await service.pingProvider('id-nope'), null);
  assert.equal(gemini.calls.length, 0);
});

void test('resolveLlmProvider applies kind defaults and the configured rules', () => {
  const resolve = (
    kind: LlmProviderKind,
    model: string,
    apiKey: string,
    baseUrl: string | null = null,
  ) =>
    resolveLlmProvider(
      { id: 'x', name: 'x', kind, enabled: true, baseUrl, model },
      apiKey,
      Boolean(apiKey),
    );

  assert.equal(resolve('openai', 'm', 'k').call.baseUrl, 'https://api.openai.com/v1');
  assert.equal(resolve('openai', 'm', 'k', 'https://r/v1').call.baseUrl, 'https://r/v1');
  assert.equal(resolve('openai', 'm', 'k', 'https://r/v1').storedBaseUrl, 'https://r/v1');
  assert.equal(resolve('ollama', 'q', '').call.baseUrl, 'http://localhost:11434');
  assert.equal(resolve('ollama', 'q', '').configured, true, 'Ollama needs no key');
  assert.equal(resolve('gemini', 'g', '').configured, false);
  assert.equal(resolve('openai', '', 'k').configured, false);
  assert.equal(resolve('gemini', 'g', 'k').call.baseUrl, '');
});

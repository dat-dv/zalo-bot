import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import { LlmService } from './llm.service';
import { RouterProvider } from './providers/router.provider';
import type { LlmResponse } from './types/llm.types';

void test('GeminiProvider returns fallback message when API key is missing', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.gemini.apiKey') return '';
      return undefined;
    },
  } as unknown as ConfigService;

  const provider = new GeminiProvider(mockConfigService);
  const res = await provider.generate('hello');
  assert.match(res.text || '', /Chưa cấu hình API Key/);
});

void test('GeminiProvider calls API and parses functionCall correctly', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.gemini.apiKey') return 'mock_gemini_key';
      if (key === 'llm.gemini.model') return 'gemini-2.5-flash';
      return undefined;
    },
  } as unknown as ConfigService;

  const originalFetch = globalThis.fetch;
  let requestBody = '';

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
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
    const provider = new GeminiProvider(mockConfigService);
    const res = await provider.generate(
      'nợ a 100k',
      [
        {
          name: 'MANAGE_DEBT',
          description: 'Ghi nợ',
        },
      ],
      'system prompt',
    );

    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'MANAGE_DEBT');
    assert.equal(res.toolCall.args.amount, 100000);
    assert.match(requestBody, /"functionDeclarations"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('OpenAiProvider calls API and parses tool_calls correctly', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.openai.apiKey') return 'mock_openai_key';
      if (key === 'llm.openai.model') return 'gpt-4o-mini';
      return undefined;
    },
  } as unknown as ConfigService;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
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
                      arguments: JSON.stringify({
                        type: 'expense',
                        amount: 35000,
                      }),
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
    const provider = new OpenAiProvider(mockConfigService);
    const res = await provider.generate('ăn phở 35k', [
      {
        name: 'RECORD_TRANSACTION',
        description: 'Thu chi',
      },
    ]);

    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'RECORD_TRANSACTION');
    assert.equal(res.toolCall.args.amount, 35000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('LlmService routes to active provider dynamically', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.provider') return 'openai';
      return undefined;
    },
  } as unknown as ConfigService;

  const geminiProvider = {
    name: 'gemini',
    generate: () => Promise.resolve({ text: 'gemini reply' }),
  } as unknown as GeminiProvider;

  const openAiProvider = {
    name: 'openai',
    generate: () => Promise.resolve({ text: 'openai reply' }),
  } as unknown as OpenAiProvider;

  const qwenProvider = {
    name: 'qwen',
    generate: () => Promise.resolve({ text: 'qwen reply' }),
  } as unknown as QwenProvider;

  const llmService = new LlmService(
    mockConfigService,
    geminiProvider,
    openAiProvider,
    qwenProvider,
  );

  const res = await llmService.generate('test');
  assert.equal(res.text, 'openai reply');

  // Test routing to qwen / ollama
  const mockConfigQwen = {
    get: (key: string) => {
      if (key === 'llm.provider') return 'ollama';
      return undefined;
    },
  } as unknown as ConfigService;
  const llmServiceQwen = new LlmService(
    mockConfigQwen,
    geminiProvider,
    openAiProvider,
    qwenProvider,
  );
  const resQwen = await llmServiceQwen.generate('test');
  assert.equal(resQwen.text, 'qwen reply');
});

void test('QwenProvider calls Ollama native /api/chat and parses tool_calls', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.qwen.baseUrl') return 'http://localhost:11434';
      if (key === 'llm.qwen.model') return 'qwen2.5:14b';
      return undefined;
    },
  } as unknown as ConfigService;

  let requestedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    requestedUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
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
                  arguments: {
                    direction: 'payable',
                    counterparty: 'a',
                    amount: 100000,
                  },
                },
              },
            ],
          },
        }),
    } as Response);
  };

  try {
    const provider = new QwenProvider(mockConfigService);
    const res = await provider.generate('nợ a 100k', [
      {
        name: 'MANAGE_DEBT',
        description: 'Quản lý nợ',
      },
    ]);

    assert.equal(requestedUrl, 'http://localhost:11434/api/chat');
    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'MANAGE_DEBT');
    assert.equal(res.toolCall.args.counterparty, 'a');
    assert.equal(res.toolCall.args.amount, 100000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('QwenProvider handles connection errors gracefully', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.qwen.baseUrl') return 'http://localhost:11434';
      return undefined;
    },
  } as unknown as ConfigService;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
  };

  try {
    const provider = new QwenProvider(mockConfigService);
    const res = await provider.generate('test');
    assert.match(res.text || '', /Không thể kết nối tới mô hình Qwen 14B/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('LlmService cleans arguments on both toolCall and response.toolCalls', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.provider') return 'gemini';
      return undefined;
    },
  } as unknown as ConfigService;

  const mockProvider = {
    name: 'gemini',
    generate: () =>
      Promise.resolve({
        toolCall: {
          name: 'RECORD_TRANSACTION',
          args: { amount: { amount: 15000 }, category: 'Ăn uống' },
        },
        toolCalls: [
          {
            name: 'RECORD_TRANSACTION',
            args: { amount: { amount: 15000 }, category: 'Ăn uống' },
          },
          {
            name: 'RECORD_TRANSACTION',
            args: { amount: { value: 20000 }, placeName: { name: 'ctgroup' } },
          },
        ],
      }),
  } as unknown as GeminiProvider;

  const llmService = new LlmService(mockConfigService, mockProvider, {} as never, {} as never);

  const res = await llmService.generate('test');
  assert.equal(res.toolCall?.args.amount, 15000);
  assert.equal(res.toolCalls?.[0].args.amount, 15000);
  assert.equal(res.toolCalls?.[1].args.amount, 20000);
  assert.equal(res.toolCalls?.[1].args.placeName, 'ctgroup');
});

interface StubProvider {
  name: string;
  calls: number;
  generate: () => Promise<LlmResponse>;
}

function stubProvider(name: string, response: LlmResponse): StubProvider {
  const stub: StubProvider = {
    name,
    calls: 0,
    generate: () => {
      stub.calls += 1;
      return Promise.resolve(response);
    },
  };
  return stub;
}

function createChainService(
  config: Record<string, unknown>,
  providers: {
    gemini: StubProvider;
    openai: StubProvider;
    qwen: StubProvider;
    router?: StubProvider;
  },
): LlmService {
  return new LlmService(
    new ConfigService(config),
    providers.gemini as unknown as GeminiProvider,
    providers.openai as unknown as OpenAiProvider,
    providers.qwen as unknown as QwenProvider,
    providers.router as unknown as RouterProvider | undefined,
  );
}

void test('LlmService chain: primary success never calls the fallback', async () => {
  const router = stubProvider('router', { text: 'router reply' });
  const gemini = stubProvider('gemini', { text: 'gemini reply' });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini'] } },
    { gemini, router, openai: stubProvider('openai', {}), qwen: stubProvider('qwen', {}) },
  );

  const res = await service.generate('hi');

  assert.equal(res.text, 'router reply');
  assert.equal(gemini.calls, 0);
});

void test('LlmService chain: failed primary falls back to gemini and keeps tool calls', async () => {
  const router = stubProvider('router', {
    text: 'Có lỗi khi kết nối tới mô hình AI.',
    failed: true,
  });
  const gemini = stubProvider('gemini', {
    toolCall: { name: 'RECORD_TRANSACTION', args: { amount: { amount: 45000 } } },
    toolCalls: [{ name: 'RECORD_TRANSACTION', args: { amount: { amount: 45000 } } }],
  });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini'] } },
    { gemini, router, openai: stubProvider('openai', {}), qwen: stubProvider('qwen', {}) },
  );

  const res = await service.generate('ăn trưa 45k');

  assert.equal(router.calls, 1);
  assert.equal(gemini.calls, 1);
  assert.equal(res.toolCall?.name, 'RECORD_TRANSACTION');
  assert.equal(res.toolCall?.args.amount, 45000);
  assert.equal(res.failed, undefined);
});

void test('LlmService chain: empty answer counts as failure', async () => {
  const router = stubProvider('router', { text: '   ' });
  const gemini = stubProvider('gemini', { text: 'gemini reply' });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini'] } },
    { gemini, router, openai: stubProvider('openai', {}), qwen: stubProvider('qwen', {}) },
  );

  assert.equal((await service.generate('hi')).text, 'gemini reply');
});

void test('LlmService chain: all failing returns the last error message', async () => {
  const router = stubProvider('router', { text: 'router down', failed: true });
  const gemini = stubProvider('gemini', {
    text: 'Có lỗi khi kết nối tới mô hình AI.',
    failed: true,
  });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini', 'unknown-llm', 'router'] } },
    { gemini, router, openai: stubProvider('openai', {}), qwen: stubProvider('qwen', {}) },
  );

  const res = await service.generate('hi');

  assert.equal(res.text, 'Có lỗi khi kết nối tới mô hình AI.');
  assert.equal(res.failed, true);
  assert.equal(router.calls, 1, 'duplicates in the chain are tried once');
  assert.equal(gemini.calls, 1);
});

void test('LlmService chain: without fallbacks a failure is returned as before', async () => {
  const gemini = stubProvider('gemini', {
    text: 'Chưa cấu hình API Key cho Gemini.',
    failed: true,
  });
  const openai = stubProvider('openai', { text: 'openai reply' });
  const service = createChainService(
    { llm: { provider: 'gemini' } },
    { gemini, openai, qwen: stubProvider('qwen', {}) },
  );

  const res = await service.generate('hi');

  assert.equal(res.text, 'Chưa cấu hình API Key cho Gemini.');
  assert.equal(openai.calls, 0);
});

void test('GeminiProvider flags a missing API key as failed', async () => {
  const provider = new GeminiProvider(new ConfigService({ llm: { gemini: { apiKey: '' } } }));
  assert.equal((await provider.generate('hello')).failed, true);
});

void test('RouterProvider fails without base URL or key and calls the router otherwise', async () => {
  const unconfigured = new RouterProvider(
    new ConfigService({ llm: { router: { baseUrl: '' } } }),
    new OpenAiProvider(new ConfigService({})),
  );
  assert.equal((await unconfigured.generate('hi')).failed, true);

  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.fetch = (input: string | URL | Request) => {
    calledUrl = input instanceof Request ? input.url : input.toString();
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: 'xin chào' } }] }), {
        status: 200,
      }),
    );
  };
  try {
    const config = new ConfigService({
      llm: { router: { baseUrl: 'https://router.example/v1/', model: 'chat-daily', apiKey: 'k' } },
    });
    const provider = new RouterProvider(config, new OpenAiProvider(config));
    const res = await provider.generate('hi');
    assert.equal(res.text, 'xin chào');
    assert.equal(calledUrl, 'https://router.example/v1/chat/completions');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('RouterProvider fails without a model instead of sending the OpenAI default', async () => {
  const config = new ConfigService({
    llm: { router: { baseUrl: 'https://router.example/v1', apiKey: 'k', model: '' } },
  });
  const provider = new RouterProvider(config, new OpenAiProvider(config));
  assert.equal((await provider.generate('hi')).failed, true);
});

interface DescribedStub extends StubProvider {
  describe: () => { model: string | null; configured: boolean };
}

function describedStub(
  name: string,
  response: LlmResponse,
  description: { model: string | null; configured: boolean } = {
    model: `${name}-model`,
    configured: true,
  },
): DescribedStub {
  return Object.assign(stubProvider(name, response), { describe: () => description });
}

void test('LlmService.getProviderStatuses lists the chain in call order, by real provider name', () => {
  const service = createChainService(
    { llm: { provider: 'ollama', fallbackProviders: ['qwen', 'gemini', 'nope'] } },
    {
      gemini: describedStub('gemini', {}),
      openai: describedStub('openai', {}),
      qwen: describedStub('qwen', {}),
    },
  );

  assert.deepEqual(service.getProviderStatuses(), [
    { name: 'qwen', role: 'primary', model: 'qwen-model', configured: true },
    { name: 'gemini', role: 'fallback', model: 'gemini-model', configured: true },
  ]);
});

void test('LlmService.pingProvider tests one provider alone: a failure never reaches the fallback', async () => {
  const secretError = 'boom https://example.test/?key=secret';
  const router = describedStub('router', { text: secretError, failed: true });
  const gemini = describedStub('gemini', { text: 'pong' });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini'] } },
    { gemini, router, openai: describedStub('openai', {}), qwen: describedStub('qwen', {}) },
  );

  const result = await service.pingProvider('router');

  assert.equal(result?.status, 'failed');
  assert.equal(typeof result?.latencyMs, 'number');
  assert.equal(router.calls, 1);
  assert.equal(gemini.calls, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

void test('LlmService.pingProvider reports ok and empty answers', async () => {
  const gemini = describedStub('gemini', { text: 'pong' });
  const router = describedStub('router', { text: '  ' });
  const service = createChainService(
    { llm: { provider: 'router', fallbackProviders: ['gemini'] } },
    { gemini, router, openai: describedStub('openai', {}), qwen: describedStub('qwen', {}) },
  );

  assert.equal((await service.pingProvider('gemini'))?.status, 'ok');
  assert.equal((await service.pingProvider('router'))?.status, 'empty');
});

void test('LlmService.pingProvider makes no call for an unconfigured provider', async () => {
  const router = describedStub('router', { text: 'pong' }, { model: null, configured: false });
  const service = createChainService(
    { llm: { provider: 'router' } },
    {
      gemini: describedStub('gemini', {}),
      router,
      openai: describedStub('openai', {}),
      qwen: describedStub('qwen', {}),
    },
  );

  assert.deepEqual(await service.pingProvider('router'), {
    name: 'router',
    status: 'not_configured',
    latencyMs: null,
  });
  assert.equal(router.calls, 0);
});

void test('LlmService.pingProvider refuses a provider outside the chain', async () => {
  const openai = describedStub('openai', { text: 'pong' });
  const service = createChainService(
    { llm: { provider: 'gemini' } },
    { gemini: describedStub('gemini', {}), openai, qwen: describedStub('qwen', {}) },
  );

  assert.equal(await service.pingProvider('openai'), null);
  assert.equal(openai.calls, 0);
});

void test('RouterProvider.describe needs the URL, the key and the model', () => {
  const describeWith = (router: Record<string, string>) =>
    new RouterProvider(new ConfigService({ llm: { router } }), {} as never).describe();

  assert.deepEqual(describeWith({ baseUrl: 'http://r', apiKey: 'k', model: 'm' }), {
    model: 'm',
    configured: true,
  });
  assert.deepEqual(describeWith({ baseUrl: 'http://r', apiKey: 'k' }), {
    model: null,
    configured: false,
  });
  assert.equal(describeWith({ baseUrl: 'http://r', model: 'm' }).configured, false);
  assert.equal(describeWith({ apiKey: 'k', model: 'm' }).configured, false);
});

void test('Gemini, OpenAI and Qwen describe() report their model without any secret', () => {
  const config = new ConfigService({
    llm: {
      gemini: { apiKey: 'gemini-secret', model: 'g' },
      openai: { apiKey: '', model: 'o' },
      qwen: { model: 'q', apiKey: 'qwen-secret' },
    },
  });

  assert.deepEqual(new GeminiProvider(config).describe(), { model: 'g', configured: true });
  assert.deepEqual(new OpenAiProvider(config).describe(), { model: 'o', configured: false });
  assert.deepEqual(new QwenProvider(config).describe(), { model: 'q', configured: true });
});

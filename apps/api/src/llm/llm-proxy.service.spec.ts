import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { LlmProviderKind } from '@zalobot/contracts';
import { LlmProxyController, isAuthorizedBearer } from './llm-proxy.controller';
import {
  GEMINI_OPENAI_CHAT_URL,
  LlmProxyService,
  hasUsableChoice,
  proxyTargetFor,
} from './llm-proxy.service';
import { resolveLlmProvider, type ResolvedLlmProvider } from './llm-provider-config.service';

function row(
  name: string,
  kind: LlmProviderKind,
  options: { baseUrl?: string | null; apiKey?: string; model?: string; enabled?: boolean } = {},
): ResolvedLlmProvider {
  const apiKey = options.apiKey ?? 'key';
  return resolveLlmProvider(
    {
      id: `id-${name}`,
      name,
      kind,
      enabled: options.enabled ?? true,
      baseUrl: options.baseUrl ?? null,
      model: options.model ?? `${name}-model`,
    },
    apiKey,
    Boolean(apiKey),
  );
}

function serviceWith(rows: ResolvedLlmProvider[]): LlmProxyService {
  return new LlmProxyService({
    getChain: () => Promise.resolve(rows.filter((provider) => provider.enabled)),
    findResolved: () => Promise.resolve(null),
  });
}

interface SeenCall {
  url: string;
  auth: string | null;
  body: Record<string, unknown>;
}

/** Answers by URL: a status and JSON body, or a thrown network error. */
async function withFetch(
  answers: Record<string, { status: number; body: unknown } | 'network-error'>,
  run: (calls: SeenCall[]) => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  const calls: SeenCall[] = [];
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
    calls.push({
      url,
      auth: new Headers(init?.headers).get('authorization'),
      body: parsed as Record<string, unknown>,
    });
    const answer = answers[url];
    if (!answer || answer === 'network-error') {
      return Promise.reject(new Error('connect ECONNREFUSED'));
    }
    return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }));
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const OK_BODY = { choices: [{ message: { role: 'assistant', content: '{"nodes":[]}' } }] };
const COGNEE_BODY = {
  model: 'openai/zalobot',
  messages: [
    { role: 'system', content: 'Extract a knowledge graph.' },
    { role: 'user', content: 'Hằng tập yoga tối thứ hai.' },
  ],
  tools: [{ type: 'function', function: { name: 'KnowledgeGraph', parameters: {} } }],
  tool_choice: { type: 'function', function: { name: 'KnowledgeGraph' } },
  response_format: { type: 'json_schema', json_schema: { name: 'g', schema: {} } },
  temperature: 0,
};

void test('proxyTargetFor maps each kind to an OpenAI chat-completions URL', () => {
  assert.equal(
    proxyTargetFor(row('router', 'openai', { baseUrl: 'https://r.example/v1/' }))?.url,
    'https://r.example/v1/chat/completions',
  );
  assert.equal(
    proxyTargetFor(row('openai', 'openai'))?.url,
    'https://api.openai.com/v1/chat/completions',
  );
  assert.equal(proxyTargetFor(row('gemini', 'gemini'))?.url, GEMINI_OPENAI_CHAT_URL);
  assert.equal(
    proxyTargetFor(row('qwen', 'ollama', { baseUrl: 'http://ollama:11434/v1', apiKey: '' }))?.url,
    'http://ollama:11434/v1/chat/completions',
  );
  assert.equal(
    proxyTargetFor(row('qwen', 'ollama', { apiKey: '' })),
    null,
    'native /api/chat is another format',
  );
  assert.equal(proxyTargetFor(row('gemini', 'gemini', { apiKey: '' })), null, 'not configured');
});

void test('hasUsableChoice needs text or tool calls in the first choice', () => {
  assert.equal(hasUsableChoice(OK_BODY), true);
  assert.equal(
    hasUsableChoice({ choices: [{ message: { content: null, tool_calls: [{ id: 't' }] } }] }),
    true,
  );
  assert.equal(hasUsableChoice({ choices: [{ message: { content: '  ' } }] }), false);
  assert.equal(hasUsableChoice({ choices: [] }), false);
  assert.equal(hasUsableChoice({ error: { message: 'x' } }), false);
});

void test('the body goes through untouched except the model of each row', async () => {
  const service = serviceWith([
    row('router', 'openai', { baseUrl: 'https://r.example/v1', model: 'work2', apiKey: 'rk' }),
  ]);
  await withFetch(
    { 'https://r.example/v1/chat/completions': { status: 200, body: OK_BODY } },
    async (calls) => {
      const result = await service.chatCompletions(COGNEE_BODY);

      assert.equal(result.status, 200);
      assert.deepEqual(result.body, OK_BODY);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.auth, 'Bearer rk');
      assert.deepEqual(calls[0]?.body, { ...COGNEE_BODY, model: 'work2' });
    },
  );
});

void test('a failing, timing-out or empty row falls back to the next one', async () => {
  const service = serviceWith([
    row('a', 'openai', { baseUrl: 'https://a.example/v1' }),
    row('b', 'openai', { baseUrl: 'https://b.example/v1' }),
    row('c', 'openai', { baseUrl: 'https://c.example/v1' }),
    row('gemini', 'gemini', { model: 'gemini-3.5-flash-lite' }),
  ]);
  await withFetch(
    {
      'https://a.example/v1/chat/completions': { status: 429, body: { error: 'rate' } },
      'https://b.example/v1/chat/completions': 'network-error',
      'https://c.example/v1/chat/completions': {
        status: 200,
        body: { choices: [{ message: { content: '' } }] },
      },
      [GEMINI_OPENAI_CHAT_URL]: { status: 200, body: OK_BODY },
    },
    async (calls) => {
      const result = await service.chatCompletions(COGNEE_BODY);

      assert.equal(result.status, 200);
      assert.deepEqual(
        calls.map((call) => call.url),
        [
          'https://a.example/v1/chat/completions',
          'https://b.example/v1/chat/completions',
          'https://c.example/v1/chat/completions',
          GEMINI_OPENAI_CHAT_URL,
        ],
      );
      assert.equal(calls[3]?.body.model, 'gemini-3.5-flash-lite');
    },
  );
});

void test('the whole chain failing returns the last error; no usable row is a 503', async () => {
  const failing = serviceWith([
    row('a', 'openai', { baseUrl: 'https://a.example/v1' }),
    row('b', 'openai', { baseUrl: 'https://b.example/v1' }),
  ]);
  await withFetch(
    {
      'https://a.example/v1/chat/completions': { status: 500, body: { error: 'a' } },
      'https://b.example/v1/chat/completions': { status: 401, body: { error: 'b' } },
    },
    async () => {
      const result = await failing.chatCompletions(COGNEE_BODY);
      assert.equal(result.status, 401);
      assert.deepEqual(result.body, { error: 'b' });
    },
  );

  const offOnly = serviceWith([row('a', 'openai', { enabled: false })]);
  assert.equal((await offOnly.chatCompletions(COGNEE_BODY)).status, 503);
});

void test('streaming and malformed bodies are refused before any AI call', async () => {
  const service = serviceWith([row('a', 'openai')]);
  await withFetch({}, async (calls) => {
    assert.equal((await service.chatCompletions({ ...COGNEE_BODY, stream: true })).status, 400);
    assert.equal((await service.chatCompletions({ messages: [] })).status, 400);
    assert.equal((await service.chatCompletions('hi')).status, 400);
    assert.equal(calls.length, 0);
  });
});

void test('isAuthorizedBearer accepts only the exact key, never an empty one', () => {
  assert.equal(isAuthorizedBearer('Bearer secret-pass', 'secret-pass'), true);
  assert.equal(isAuthorizedBearer('bearer  secret-pass ', 'secret-pass'), true);
  assert.equal(isAuthorizedBearer('Bearer wrong', 'secret-pass'), false);
  assert.equal(isAuthorizedBearer(undefined, 'secret-pass'), false);
  assert.equal(isAuthorizedBearer('Bearer ', ''), false);
  assert.equal(isAuthorizedBearer('Bearer x', ''), false, 'Cognee off: endpoint closed');
});

void test('LlmProxyController answers 401 without calling the chain on a wrong key', async () => {
  let proxied = 0;
  const proxy = {
    chatCompletions: () => {
      proxied += 1;
      return Promise.resolve({ status: 200, body: OK_BODY });
    },
  } as unknown as LlmProxyService;
  const config = {
    get: (key: string) => (key === 'cognee.userPassword' ? 'secret-pass' : undefined),
  } as unknown as ConfigService;
  const controller = new LlmProxyController(proxy, config);
  const sent: Array<{ status: number; body: unknown }> = [];
  const res = {
    status(code: number) {
      return {
        json: (body: unknown) => {
          sent.push({ status: code, body });
        },
      };
    },
  } as unknown as ExpressResponse;
  const req = (auth?: string) =>
    ({ headers: auth ? { authorization: auth } : {} }) as unknown as ExpressRequest;

  await controller.chatCompletions(req('Bearer nope'), COGNEE_BODY, res);
  await controller.chatCompletions(req(), COGNEE_BODY, res);
  assert.equal(proxied, 0);
  assert.deepEqual(
    sent.map((entry) => entry.status),
    [401, 401],
  );

  await controller.chatCompletions(req('Bearer secret-pass'), COGNEE_BODY, res);
  assert.equal(proxied, 1);
  assert.equal(sent[2]?.status, 200);
});

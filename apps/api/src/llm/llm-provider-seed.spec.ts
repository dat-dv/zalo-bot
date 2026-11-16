import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLlmProviderSeed } from './llm-provider-seed';

void test('seed keeps the env chain order with each provider settings (router then gemini)', () => {
  const rows = buildLlmProviderSeed({
    LLM_PROVIDER: 'router',
    LLM_FALLBACK_PROVIDERS: 'gemini',
    ROUTER_BASE_URL: 'https://router.example/v1',
    ROUTER_MODEL: 'chat',
    ROUTER_API_KEY: '"router-key"',
    GEMINI_API_KEY: 'gemini-key',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
  });

  assert.deepEqual(rows, [
    {
      name: 'router',
      kind: 'openai',
      baseUrl: 'https://router.example/v1',
      model: 'chat',
      apiKey: 'router-key',
    },
    {
      name: 'gemini',
      kind: 'gemini',
      baseUrl: null,
      model: 'gemini-3.5-flash-lite',
      apiKey: 'gemini-key',
    },
  ]);
});

void test('seed resolves legacy aliases, drops duplicates and unknown names', () => {
  const rows = buildLlmProviderSeed({
    LLM_PROVIDER: 'Ollama',
    LLM_FALLBACK_PROVIDERS: 'qwen, 9router, nope, router ,openai',
  });

  assert.deepEqual(
    rows.map((row) => [row.name, row.kind]),
    [
      ['qwen', 'ollama'],
      ['router', 'openai'],
      ['openai', 'openai'],
    ],
  );
  assert.equal(rows[0]?.model, 'qwen2.5:14b');
  assert.equal(rows[2]?.model, 'gpt-4o-mini');
  assert.equal(rows[0]?.apiKey, null);
});

void test('seed falls back to Gemini alone like the old service did', () => {
  assert.deepEqual(
    buildLlmProviderSeed({ LLM_PROVIDER: 'nope' }).map((row) => row.name),
    ['gemini'],
  );
  assert.deepEqual(
    buildLlmProviderSeed({}).map((row) => row.name),
    ['gemini'],
  );
});

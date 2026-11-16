import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueryRunner } from 'typeorm';
import { decryptSecret, parseEncryptionKey } from '../../common/crypto/secret-cipher';
import { CreateLlmProviders1725030000000 } from './1725030000000-CreateLlmProviders';

const KEY_HEX = 'e'.repeat(64);
const ENV_KEYS = [
  'DATA_ENCRYPTION_KEY',
  'LLM_PROVIDER',
  'LLM_FALLBACK_PROVIDERS',
  'ROUTER_BASE_URL',
  'ROUTER_MODEL',
  'ROUTER_API_KEY',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
] as const;

/** Records the SQL; the row count answer decides whether the seed runs. */
function fakeRunner(existingRows: number) {
  const inserts: unknown[][] = [];
  const statements: string[] = [];
  const runner = {
    query: (sql: string, params?: unknown[]) => {
      statements.push(sql);
      if (sql.includes('COUNT(*)')) return Promise.resolve([{ count: existingRows }]);
      if (sql.includes('INSERT INTO "llm_providers"')) inserts.push(params ?? []);
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, inserts, statements };
}

async function withEnv(
  values: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
) {
  const saved = ENV_KEYS.map((key) => [key, process.env[key]] as const);
  for (const key of ENV_KEYS) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, values);
  try {
    await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
}

void test('migration seeds the env chain in order with encrypted keys', async () => {
  await withEnv(
    {
      DATA_ENCRYPTION_KEY: KEY_HEX,
      LLM_PROVIDER: 'router',
      LLM_FALLBACK_PROVIDERS: 'gemini',
      ROUTER_BASE_URL: 'https://router.example/v1',
      ROUTER_MODEL: 'chat',
      ROUTER_API_KEY: 'router-secret',
      GEMINI_API_KEY: 'gemini-secret',
    },
    async () => {
      const { runner, inserts, statements } = fakeRunner(0);
      await new CreateLlmProviders1725030000000().up(runner);

      assert.match(statements[0] ?? '', /CREATE TABLE IF NOT EXISTS "llm_providers"/);
      assert.deepEqual(
        inserts.map((params) => [params[0], params[1], params[2], params[3], params[5]]),
        [
          ['router', 'openai', 'https://router.example/v1', 'chat', 0],
          ['gemini', 'gemini', null, 'gemini-3.5-flash-lite', 1],
        ],
      );
      const key = parseEncryptionKey(KEY_HEX);
      assert.ok(key);
      const storedKeys = inserts.map((params) => (typeof params[4] === 'string' ? params[4] : ''));
      assert.ok(storedKeys.every((value) => value.startsWith('enc:v1:')));
      assert.doesNotMatch(storedKeys.join(), /secret/);
      assert.equal(decryptSecret(storedKeys[0], key), 'router-secret');
      assert.equal(decryptSecret(storedKeys[1], key), 'gemini-secret');
    },
  );
});

void test('migration never seeds a table that already has rows', async () => {
  await withEnv({ DATA_ENCRYPTION_KEY: KEY_HEX, GEMINI_API_KEY: 'k' }, async () => {
    const { runner, inserts } = fakeRunner(2);
    await new CreateLlmProviders1725030000000().up(runner);
    assert.equal(inserts.length, 0);
  });
});

void test('migration keeps the row but drops the key when DATA_ENCRYPTION_KEY is invalid', async () => {
  await withEnv({ DATA_ENCRYPTION_KEY: 'not-hex', GEMINI_API_KEY: 'k' }, async () => {
    const { runner, inserts } = fakeRunner(0);
    await new CreateLlmProviders1725030000000().up(runner);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.[0], 'gemini');
    assert.equal(inserts[0]?.[4], null);
  });
});

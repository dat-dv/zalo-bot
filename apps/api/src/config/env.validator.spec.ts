import { afterEach, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateEnvironment } from './env.validator';

const VALID_ENV: Record<string, string> = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  DASHBOARD_ACCESS_TOKEN_SECRET: 'access-secret',
  DASHBOARD_REFRESH_TOKEN_SECRET: 'refresh-secret',
  ZALO_BOT_TOKEN: 'bot-token',
  BE_PORT: '3005',
  APP_URL: 'https://bot.example.com',
  WEB_ORIGIN: 'https://bot.example.com',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CORS_ALLOW_ALL: 'false',
  DATA_ENCRYPTION_KEY: 'a'.repeat(64),
  DEFAULT_TIMEZONE: 'Asia/Ho_Chi_Minh',
};

const TOUCHED_KEYS = [...Object.keys(VALID_ENV), 'PORT', 'BOT_TOKEN', 'NGINX_PORT', 'GATEWAY_PORT'];
let snapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  snapshot = Object.fromEntries(TOUCHED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of TOUCHED_KEYS) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, VALID_ENV);
});

afterEach(() => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else process.env[key] = value;
  }
});

void test('validateEnvironment accepts a complete environment', () => {
  assert.deepEqual(validateEnvironment(), { isValid: true, errors: [] });
});

void test('validateEnvironment rejects the unsafe fallbacks (CORS, encryption key)', () => {
  delete process.env.CORS_ALLOW_ALL;
  process.env.DATA_ENCRYPTION_KEY = 'replace-with-64-hex-characters';
  const result = validateEnvironment();
  assert.equal(result.isValid, false);
  assert.deepEqual(result.errors.map((error) => error.key).sort(), [
    'CORS_ALLOW_ALL',
    'DATA_ENCRYPTION_KEY',
  ]);
});

void test('validateEnvironment reports a missing dashboard secret', () => {
  delete process.env.DASHBOARD_ACCESS_TOKEN_SECRET;
  const result = validateEnvironment();
  assert.deepEqual(
    result.errors.map((error) => error.key),
    ['DASHBOARD_ACCESS_TOKEN_SECRET'],
  );
});

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

const TOUCHED_KEYS = [...Object.keys(VALID_ENV), 'NGINX_PORT', 'ZALO_WEBHOOK_URL'];
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

void test('validateEnvironment accepts a minimal environment that relies on defaults', () => {
  for (const key of ['BE_PORT', 'WEB_ORIGIN', 'CORS_ALLOW_ALL', 'DEFAULT_TIMEZONE']) {
    Reflect.deleteProperty(process.env, key);
  }
  assert.deepEqual(validateEnvironment(), { isValid: true, errors: [] });
});

void test('validateEnvironment rejects invalid optional values and the placeholder encryption key', () => {
  process.env.CORS_ALLOW_ALL = 'yes';
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

void test('validateEnvironment validates optional ports, URLs and timezone only when set', () => {
  process.env.BE_PORT = 'abc';
  process.env.NGINX_PORT = '0';
  process.env.WEB_ORIGIN = 'not-a-url';
  process.env.ZALO_WEBHOOK_URL = 'ftp://bot.example.com/webhook';
  process.env.DEFAULT_TIMEZONE = 'Mars/Olympus';
  const result = validateEnvironment();
  assert.deepEqual(result.errors.map((error) => error.key).sort(), [
    'BE_PORT',
    'DEFAULT_TIMEZONE',
    'NGINX_PORT',
    'WEB_ORIGIN',
    'ZALO_WEBHOOK_URL',
  ]);
});

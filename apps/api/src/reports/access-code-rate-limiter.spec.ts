import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_CODE_MAX_ATTEMPTS,
  ACCESS_CODE_MAX_ATTEMPTS_ALL_CLIENTS,
  ACCESS_CODE_WINDOW_SECONDS,
  AccessCodeRateLimiter,
  type AttemptCounterStore,
} from './access-code-rate-limiter';

function memoryStore(): AttemptCounterStore {
  const counts = new Map<string, number>();
  return {
    incrWithTtl: (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve(next);
    },
  };
}

const redisDown: AttemptCounterStore = { incrWithTtl: () => Promise.resolve(null) };

void test('AccessCodeRateLimiter blocks a client after the per-client cap', async () => {
  const limiter = new AccessCodeRateLimiter(memoryStore());
  for (let i = 0; i < ACCESS_CODE_MAX_ATTEMPTS; i += 1) {
    assert.equal(await limiter.tryAttempt('1.1.1.1'), true);
  }
  assert.equal(await limiter.tryAttempt('1.1.1.1'), false);
  assert.equal(await limiter.tryAttempt('2.2.2.2'), true);
});

void test('AccessCodeRateLimiter blocks everyone after the overall cap', async () => {
  const limiter = new AccessCodeRateLimiter(memoryStore());
  for (let i = 0; i < ACCESS_CODE_MAX_ATTEMPTS_ALL_CLIENTS; i += 1) {
    assert.equal(await limiter.tryAttempt(`forged-${i}`), true);
  }
  assert.equal(await limiter.tryAttempt('fresh-client'), false);
});

void test('AccessCodeRateLimiter still counts in memory when Redis is down', async () => {
  const limiter = new AccessCodeRateLimiter(redisDown);
  const now = 1_000_000;
  for (let i = 0; i < ACCESS_CODE_MAX_ATTEMPTS; i += 1) {
    assert.equal(await limiter.tryAttempt('1.1.1.1', now), true);
  }
  assert.equal(await limiter.tryAttempt('1.1.1.1', now), false);
  // The in-memory window resets like the Redis TTL would.
  const afterWindow = now + ACCESS_CODE_WINDOW_SECONDS * 1000;
  assert.equal(await limiter.tryAttempt('1.1.1.1', afterWindow), true);
});

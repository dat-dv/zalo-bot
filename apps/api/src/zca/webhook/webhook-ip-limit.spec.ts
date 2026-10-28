import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import {
  WEBHOOK_IP_LOCK_SECONDS,
  WEBHOOK_IP_MAX_FAILED_KEYS,
  WEBHOOK_IP_MAX_REQUESTS,
  WebhookIpLimiter,
} from './webhook-ip-limiter';
import { WebhookIpLimitGuard } from './guards/webhook-ip-limit.guard';

/** Redis stand-in with TTLs on a clock the test moves; `down` makes every call fail like an outage. */
function memoryStore(clock: { now: number }, down = false) {
  const values = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = values.get(key);
    return entry && entry.expiresAt > clock.now ? entry : undefined;
  };
  return {
    incrWithTtl: (key: string, ttlSeconds: number) => {
      if (down) return Promise.resolve(null);
      const entry = live(key);
      const count = entry ? Number(entry.value) + 1 : 1;
      values.set(key, {
        value: String(count),
        expiresAt: entry ? entry.expiresAt : clock.now + ttlSeconds * 1000,
      });
      return Promise.resolve(count);
    },
    get: (key: string) => Promise.resolve(down ? null : (live(key)?.value ?? null)),
    set: (key: string, value: string, ttlSeconds?: number) => {
      if (down) return Promise.resolve(false);
      values.set(key, { value, expiresAt: clock.now + (ttlSeconds ?? 3600) * 1000 });
      return Promise.resolve(true);
    },
  };
}

function guardFor(limiter: WebhookIpLimiter, ip: string) {
  const guard = new WebhookIpLimitGuard(limiter);
  const request = {
    headers: {},
    get: (name: string) => (name === 'cf-connecting-ip' ? ip : undefined),
  };
  return () => guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }) } as never);
}

const is429 = (error: unknown) => error instanceof HttpException && error.getStatus() === 429;

void test('WebhookIpLimiter caps requests per IP per minute without touching other IPs', async () => {
  const clock = { now: 1_000_000 };
  const limiter = new WebhookIpLimiter(memoryStore(clock));

  for (let i = 1; i <= WEBHOOK_IP_MAX_REQUESTS; i++) {
    assert.equal(await limiter.countRequest('1.1.1.1', clock.now), i);
  }
  assert.equal(await limiter.countRequest('1.1.1.1', clock.now), WEBHOOK_IP_MAX_REQUESTS + 1);
  assert.equal(await limiter.countRequest('2.2.2.2', clock.now), 1);

  clock.now += 61_000;
  assert.equal(await limiter.countRequest('1.1.1.1', clock.now), 1);
});

void test('WebhookIpLimiter locks an IP on the wrong key after the allowed ones, then unlocks', async () => {
  const clock = { now: 1_000_000 };
  const limiter = new WebhookIpLimiter(memoryStore(clock));

  for (let i = 0; i < WEBHOOK_IP_MAX_FAILED_KEYS; i++) {
    assert.equal(await limiter.recordFailedKey('1.1.1.1', clock.now), false);
  }
  assert.equal(await limiter.isLocked('1.1.1.1', clock.now), false);
  assert.equal(await limiter.recordFailedKey('1.1.1.1', clock.now), true);
  assert.equal(await limiter.isLocked('1.1.1.1', clock.now), true);
  assert.equal(await limiter.isLocked('2.2.2.2', clock.now), false);
  // Further wrong keys do not re-announce the lock.
  assert.equal(await limiter.recordFailedKey('1.1.1.1', clock.now), false);

  clock.now += WEBHOOK_IP_LOCK_SECONDS * 1000 + 1;
  assert.equal(await limiter.isLocked('1.1.1.1', clock.now), false);
});

void test('WebhookIpLimiter keeps counting and locking in process while Redis is down', async () => {
  const clock = { now: 1_000_000 };
  const limiter = new WebhookIpLimiter(memoryStore(clock, true));

  for (let i = 0; i < WEBHOOK_IP_MAX_FAILED_KEYS + 1; i++) {
    await limiter.recordFailedKey('1.1.1.1', clock.now);
  }
  assert.equal(await limiter.isLocked('1.1.1.1', clock.now), true);
  assert.equal(await limiter.countRequest('1.1.1.1', clock.now), 1);
  assert.equal(await limiter.countRequest('1.1.1.1', clock.now), 2);
});

void test('WebhookIpLimitGuard refuses a locked IP and an IP over the per-minute cap with 429', async () => {
  const clock = { now: Date.now() };
  const limiter = new WebhookIpLimiter(memoryStore(clock));

  for (let i = 0; i < WEBHOOK_IP_MAX_FAILED_KEYS + 1; i++) {
    await limiter.recordFailedKey('9.9.9.9');
  }
  await assert.rejects(guardFor(limiter, '9.9.9.9')(), is429);

  const busy = guardFor(limiter, '8.8.8.8');
  for (let i = 0; i < WEBHOOK_IP_MAX_REQUESTS; i++) {
    assert.equal(await busy(), true);
  }
  await assert.rejects(busy(), is429);
  assert.equal(await guardFor(limiter, '7.7.7.7')(), true);
});

import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export type WebhookCallScope = 'send' | 'targets';

/** Calls per window for each webhook route; listing targets never eats into the send quota. */
export const WEBHOOK_MAX_CALLS: Record<WebhookCallScope, number> = {
  send: 30,
  targets: 10,
};
export const WEBHOOK_WINDOW_SECONDS = 60;

/** The part of `RedisService` the limiter needs; lets specs pass a plain object. */
export interface WebhookCallCounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number | null>;
}

/**
 * Caps webhook calls across all callers: they share one key, so a leaked key or a runaway
 * integration must not flood Zalo from the bot's account. Counts in Redis; when Redis is down it
 * counts in this process so the cap still holds on a single instance.
 */
@Injectable()
export class WebhookRateLimiter {
  private readonly localCounters = new Map<WebhookCallScope, { count: number; resetAt: number }>();

  constructor(@Inject(RedisService) private readonly store: WebhookCallCounterStore) {}

  /** Records one call of `scope`; returns `false` once that scope's window is over the cap. */
  public async tryCall(scope: WebhookCallScope, now: number = Date.now()): Promise<boolean> {
    const count =
      (await this.store.incrWithTtl(`webhook:${scope}:calls`, WEBHOOK_WINDOW_SECONDS)) ??
      this.countLocally(scope, now);
    return count <= WEBHOOK_MAX_CALLS[scope];
  }

  private countLocally(scope: WebhookCallScope, now: number): number {
    const current = this.localCounters.get(scope);
    if (!current || current.resetAt <= now) {
      this.localCounters.set(scope, { count: 1, resetAt: now + WEBHOOK_WINDOW_SECONDS * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

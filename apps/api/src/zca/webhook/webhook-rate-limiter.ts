import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export type WebhookCallScope = 'send' | 'targets' | 'status';

/** Calls per window for each webhook route; each has its own counter so none eats another's quota. */
export const WEBHOOK_MAX_CALLS: Record<WebhookCallScope, number> = {
  send: 30,
  targets: 10,
  status: 60,
};
export const WEBHOOK_WINDOW_SECONDS = 60;

/** The part of `RedisService` the limiter needs; lets specs pass a plain object. */
export interface WebhookCallCounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number | null>;
  get(key: string): Promise<string | null>;
}

function counterKey(scope: WebhookCallScope): string {
  return `webhook:${scope}:calls`;
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
      (await this.store.incrWithTtl(counterKey(scope), WEBHOOK_WINDOW_SECONDS)) ??
      this.countLocally(scope, now);
    return count <= WEBHOOK_MAX_CALLS[scope];
  }

  /** Calls of `scope` still allowed in the current window, without recording one. */
  public async remaining(scope: WebhookCallScope, now: number = Date.now()): Promise<number> {
    // A missing Redis key (fresh window) and a Redis outage both read null; the local counter
    // only fills while Redis is down, so falling back to it covers both.
    const stored = Number(await this.store.get(counterKey(scope)));
    const used = stored > 0 ? stored : this.localCount(scope, now);
    return Math.max(0, WEBHOOK_MAX_CALLS[scope] - used);
  }

  private localCount(scope: WebhookCallScope, now: number): number {
    const current = this.localCounters.get(scope);
    return current && current.resetAt > now ? current.count : 0;
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

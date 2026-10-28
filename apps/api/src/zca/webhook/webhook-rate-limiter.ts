import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export const WEBHOOK_MAX_CALLS = 30;
export const WEBHOOK_WINDOW_SECONDS = 60;
const WEBHOOK_COUNTER_KEY = 'webhook:send:calls';

/** The part of `RedisService` the limiter needs; lets specs pass a plain object. */
export interface WebhookCallCounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number | null>;
}

/**
 * Caps webhook sends across all callers: they share one key, so a leaked key or a runaway
 * integration must not flood Zalo from the bot's account. Counts in Redis; when Redis is down it
 * counts in this process so the cap still holds on a single instance.
 */
@Injectable()
export class WebhookRateLimiter {
  private localCounter: { count: number; resetAt: number } | null = null;

  constructor(@Inject(RedisService) private readonly store: WebhookCallCounterStore) {}

  /** Records one call; returns `false` once the window is over the cap. */
  public async tryCall(now: number = Date.now()): Promise<boolean> {
    const count =
      (await this.store.incrWithTtl(WEBHOOK_COUNTER_KEY, WEBHOOK_WINDOW_SECONDS)) ??
      this.countLocally(now);
    return count <= WEBHOOK_MAX_CALLS;
  }

  private countLocally(now: number): number {
    if (!this.localCounter || this.localCounter.resetAt <= now) {
      this.localCounter = { count: 1, resetAt: now + WEBHOOK_WINDOW_SECONDS * 1000 };
      return 1;
    }
    this.localCounter.count += 1;
    return this.localCounter.count;
  }
}

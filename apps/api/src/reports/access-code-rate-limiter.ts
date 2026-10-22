import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const ACCESS_CODE_MAX_ATTEMPTS = 10;
/** Cap across all clients: client IP headers can be forged, so one IP cap alone is not enough. */
export const ACCESS_CODE_MAX_ATTEMPTS_ALL_CLIENTS = 200;
export const ACCESS_CODE_WINDOW_SECONDS = 15 * 60;

/** The part of `RedisService` the limiter needs; lets specs pass a plain object. */
export interface AttemptCounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number | null>;
}

/**
 * Caps sign-in code attempts per client IP and overall. An 8-character code is far weaker than the 32-byte
 * link token, so guessing must stay slow. Counts in Redis; when Redis is down it counts in this
 * process so the cap still holds on a single instance.
 */
@Injectable()
export class AccessCodeRateLimiter {
  private readonly localCounters = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(RedisService) private readonly store: AttemptCounterStore) {}

  /** Records one attempt; returns `false` once the client, or all clients together, are over the cap. */
  public async tryAttempt(clientKey: string, now: number = Date.now()): Promise<boolean> {
    const clientCount = await this.count(`client:${clientKey}`, now);
    const allCount = await this.count('all', now);
    return (
      clientCount <= ACCESS_CODE_MAX_ATTEMPTS && allCount <= ACCESS_CODE_MAX_ATTEMPTS_ALL_CLIENTS
    );
  }

  private async count(scope: string, now: number): Promise<number> {
    const key = `dashboard:access-code:attempts:${scope}`;
    return (
      (await this.store.incrWithTtl(key, ACCESS_CODE_WINDOW_SECONDS)) ?? this.countLocally(key, now)
    );
  }

  private countLocally(key: string, now: number): number {
    const current = this.localCounters.get(key);
    if (!current || current.resetAt <= now) {
      this.localCounters.set(key, { count: 1, resetAt: now + ACCESS_CODE_WINDOW_SECONDS * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

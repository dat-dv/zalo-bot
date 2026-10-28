import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/** Requests per minute from one IP, with or without a valid key. */
export const WEBHOOK_IP_MAX_REQUESTS = 120;
export const WEBHOOK_IP_WINDOW_SECONDS = 60;
/** Wrong keys one IP may send within `WEBHOOK_IP_FAILED_WINDOW_SECONDS` before it is locked. */
export const WEBHOOK_IP_MAX_FAILED_KEYS = 10;
export const WEBHOOK_IP_FAILED_WINDOW_SECONDS = 15 * 60;
export const WEBHOOK_IP_LOCK_SECONDS = 15 * 60;

/** The part of `RedisService` the limiter needs; lets specs pass a plain object. */
export interface WebhookIpCounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number | null>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
}

interface LocalEntry {
  count: number;
  expiresAt: number;
}

/**
 * Per-IP limits in front of the webhook key check, so callers without the key cannot flood the
 * API or keep guessing. Counts in Redis; when Redis is down it counts in this process so the
 * limits still hold on a single instance.
 */
@Injectable()
export class WebhookIpLimiter {
  private readonly local = new Map<string, LocalEntry>();

  constructor(@Inject(RedisService) private readonly store: WebhookIpCounterStore) {}

  /** Records one request from `ip` and returns how many it sent in this minute, this one included. */
  public async countRequest(ip: string, now: number = Date.now()): Promise<number> {
    return this.increment(`webhook:ip:${ip}:requests`, WEBHOOK_IP_WINDOW_SECONDS, now);
  }

  public async isLocked(ip: string, now: number = Date.now()): Promise<boolean> {
    const key = this.lockKey(ip);
    if ((await this.store.get(key)) !== null) return true;
    return this.readLocal(key, now) > 0;
  }

  /** Counts a wrong key from `ip`; returns `true` when this one locked the IP. */
  public async recordFailedKey(ip: string, now: number = Date.now()): Promise<boolean> {
    const failed = await this.increment(
      `webhook:ip:${ip}:failed`,
      WEBHOOK_IP_FAILED_WINDOW_SECONDS,
      now,
    );
    if (failed !== WEBHOOK_IP_MAX_FAILED_KEYS + 1) return false;

    const key = this.lockKey(ip);
    if (!(await this.store.set(key, '1', WEBHOOK_IP_LOCK_SECONDS))) {
      this.local.set(key, { count: 1, expiresAt: now + WEBHOOK_IP_LOCK_SECONDS * 1000 });
    }
    return true;
  }

  private lockKey(ip: string): string {
    return `webhook:ip:${ip}:locked`;
  }

  private async increment(key: string, ttlSeconds: number, now: number): Promise<number> {
    const stored = await this.store.incrWithTtl(key, ttlSeconds);
    if (stored !== null) return stored;

    const current = this.local.get(key);
    if (!current || current.expiresAt <= now) {
      this.local.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }

  private readLocal(key: string, now: number): number {
    const current = this.local.get(key);
    return current && current.expiresAt > now ? current.count : 0;
  }
}

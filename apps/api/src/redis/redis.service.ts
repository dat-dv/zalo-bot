import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  public onModuleInit(): void {
    const redisUrl =
      this.configService.get<string>('redis.url') ||
      process.env.REDIS_URL ||
      'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 1000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis successfully.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis client error: ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.logger.warn(`Could not connect to Redis: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.error(`Failed to initialize Redis client: ${(err as Error).message}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
      this.isConnected = false;
    }
  }

  public get isReady(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  public async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(`Redis GET failed for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (err) {
      this.logger.warn(`Redis SET failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      this.logger.warn(`Redis DEL failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }

  public async getWhitelist(userId: string): Promise<string | null> {
    return this.get(`whitelist:user:${userId}`);
  }

  public async setWhitelist(userId: string, allowed: boolean): Promise<boolean> {
    // Cache for 24 hours if allowed, 10 minutes if rejected so changes take effect quickly
    const ttlSeconds = allowed ? 86400 : 600;
    return this.set(`whitelist:user:${userId}`, allowed ? '1' : '0', ttlSeconds);
  }

  public async delWhitelist(userId: string): Promise<boolean> {
    return this.del(`whitelist:user:${userId}`);
  }

  public async sadd(key: string, ...members: string[]): Promise<boolean> {
    if (!this.client || !this.isConnected || members.length === 0) return false;
    try {
      await this.client.sadd(key, ...members);
      return true;
    } catch (err) {
      this.logger.warn(`Redis SADD failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }

  public async srem(key: string, ...members: string[]): Promise<boolean> {
    if (!this.client || !this.isConnected || members.length === 0) return false;
    try {
      await this.client.srem(key, ...members);
      return true;
    } catch (err) {
      this.logger.warn(`Redis SREM failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }

  public async smembers(key: string): Promise<string[]> {
    if (!this.client || !this.isConnected) return [];
    try {
      return await this.client.smembers(key);
    } catch (err) {
      this.logger.warn(`Redis SMEMBERS failed for key "${key}": ${(err as Error).message}`);
      return [];
    }
  }

  public async sismember(key: string, member: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const res = await this.client.sismember(key, member);
      return res === 1;
    } catch (err) {
      this.logger.warn(`Redis SISMEMBER failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }
}

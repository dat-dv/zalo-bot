import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PendingImageAction {
  userId: string;
  chatId: string;
  receiptUrl: string;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class PendingImageActionService implements OnModuleDestroy {
  private readonly logger = new Logger(PendingImageActionService.name);
  private readonly memoryMap = new Map<
    string,
    { action: PendingImageAction; timer?: NodeJS.Timeout }
  >();
  public timeoutMs = 5 * 60 * 1000; // 5 phút

  constructor(@Optional() private readonly redisService?: RedisService) {}

  public onModuleDestroy(): void {
    this.clearAll();
  }

  public clearAll(): void {
    for (const item of this.memoryMap.values()) {
      if (item.timer) {
        clearTimeout(item.timer);
      }
    }
    this.memoryMap.clear();
  }

  public async setPending(
    userId: string,
    data: Omit<PendingImageAction, 'createdAt' | 'expiresAt'>,
  ): Promise<PendingImageAction> {
    const now = Date.now();
    const action: PendingImageAction = {
      ...data,
      createdAt: now,
      expiresAt: now + this.timeoutMs,
    };

    // 1. Lưu Redis nếu có
    if (this.redisService) {
      try {
        const key = `pending:image:user:${userId}`;
        const ttlSec = Math.ceil(this.timeoutMs / 1000);
        await this.redisService.set(key, JSON.stringify(action), ttlSec);
      } catch (err) {
        this.logger.warn(`Failed to set pending image to redis: ${(err as Error).message}`);
      }
    }

    // 2. Lưu Memory fallback
    const existing = this.memoryMap.get(userId);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.memoryMap.delete(userId);
      this.logger.debug(`Pending image expired for user ${userId}`);
    }, this.timeoutMs);
    timer.unref();

    this.memoryMap.set(userId, { action, timer });
    return action;
  }

  public async getPending(userId: string): Promise<PendingImageAction | undefined> {
    // 1. Kiểm tra Redis
    if (this.redisService) {
      try {
        const raw = await this.redisService.get(`pending:image:user:${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as PendingImageAction;
          if (parsed.expiresAt > Date.now()) {
            return parsed;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to get pending image from redis: ${(err as Error).message}`);
      }
    }

    // 2. Memory fallback
    const item = this.memoryMap.get(userId);
    if (!item) return undefined;

    if (item.action.expiresAt <= Date.now()) {
      if (item.timer) clearTimeout(item.timer);
      this.memoryMap.delete(userId);
      return undefined;
    }

    return item.action;
  }

  public async clearPending(userId: string): Promise<void> {
    if (this.redisService) {
      try {
        await this.redisService.del(`pending:image:user:${userId}`);
      } catch (err) {
        this.logger.warn(`Failed to delete pending image from redis: ${(err as Error).message}`);
      }
    }

    const item = this.memoryMap.get(userId);
    if (item?.timer) {
      clearTimeout(item.timer);
    }
    this.memoryMap.delete(userId);
  }
}

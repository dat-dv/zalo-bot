import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PendingImageAction {
  userId: string;
  chatId: string;
  receiptUrl: string;
  receiptUrls: string[];
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

  /**
   * Lưu hoặc cập nhật một pending image action
   */
  public async setPending(
    userId: string,
    data: Omit<PendingImageAction, 'createdAt' | 'expiresAt' | 'receiptUrls'> & {
      receiptUrls?: string[];
    },
  ): Promise<PendingImageAction> {
    const now = Date.now();
    const urls = data.receiptUrls?.length ? data.receiptUrls : [data.receiptUrl];
    const action: PendingImageAction = {
      ...data,
      receiptUrls: urls,
      createdAt: now,
      expiresAt: now + this.timeoutMs,
    };

    await this.saveAction(userId, action);
    return action;
  }

  /**
   * Thêm ảnh vào batch đang chờ của người dùng.
   * Nếu người dùng vừa gửi ảnh trước đó (chưa hết timeout), ảnh mới sẽ được gộp vào batch.
   */
  public async addPendingImage(
    userId: string,
    data: { userId: string; chatId: string; receiptUrl: string },
  ): Promise<{ action: PendingImageAction; isNew: boolean; totalCount: number }> {
    const existing = await this.getPending(userId);
    const now = Date.now();

    if (existing) {
      const urls = existing.receiptUrls?.length ? [...existing.receiptUrls] : [existing.receiptUrl];
      if (!urls.includes(data.receiptUrl)) {
        urls.push(data.receiptUrl);
      }
      existing.receiptUrls = urls;
      existing.expiresAt = now + this.timeoutMs;
      await this.saveAction(userId, existing);
      return {
        action: existing,
        isNew: false,
        totalCount: urls.length,
      };
    }

    const action: PendingImageAction = {
      userId: data.userId,
      chatId: data.chatId,
      receiptUrl: data.receiptUrl,
      receiptUrls: [data.receiptUrl],
      createdAt: now,
      expiresAt: now + this.timeoutMs,
    };
    await this.saveAction(userId, action);
    return {
      action,
      isNew: true,
      totalCount: 1,
    };
  }

  private async saveAction(userId: string, action: PendingImageAction): Promise<void> {
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
  }

  public async getPending(userId: string): Promise<PendingImageAction | undefined> {
    // 1. Kiểm tra Redis
    if (this.redisService) {
      try {
        const raw = await this.redisService.get(`pending:image:user:${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as PendingImageAction;
          if (parsed.expiresAt > Date.now()) {
            if (!parsed.receiptUrls) {
              parsed.receiptUrls = [parsed.receiptUrl];
            }
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

    if (!item.action.receiptUrls) {
      item.action.receiptUrls = [item.action.receiptUrl];
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

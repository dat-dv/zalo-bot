import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import { FinanceService } from '../finance/finance.service';
import { RedisService } from '../redis/redis.service';

export interface PendingTransaction {
  code: string;
  userId: string;
  chatId: string;
  payload: {
    userId: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note: string;
    occurredAt?: string;
  };
  createdAt: number;
  expiresAt: number;
  timer?: NodeJS.Timeout;
}

@Injectable()
export class TransactionConfirmationService implements OnModuleDestroy {
  private readonly logger = new Logger(TransactionConfirmationService.name);
  private readonly pendingMap = new Map<string, PendingTransaction>();
  public timeoutMs = 60 * 1000; // 1 phút (60 giây)

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  public onModuleDestroy(): void {
    this.clearAll();
  }

  public clearAll(): void {
    for (const pending of this.pendingMap.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
    }
    this.pendingMap.clear();
  }

  public async getPendingByCode(code: string): Promise<PendingTransaction | undefined> {
    if (this.redisService) {
      const raw = await this.redisService.get(`pending:tx:code:${code}`);
      if (raw) {
        try {
          return JSON.parse(raw) as PendingTransaction;
        } catch {
          // ignore json parse error, fall back to memory
        }
      }
    }
    return this.pendingMap.get(code);
  }

  public async getPendingForUser(userId: string): Promise<PendingTransaction | undefined> {
    if (this.redisService) {
      const code = await this.redisService.get(`pending:tx:user:${userId}`);
      if (code) {
        const item = await this.getPendingByCode(code);
        if (item) return item;
      }
    }
    const list = Array.from(this.pendingMap.values()).filter((p) => p.userId === userId);
    return list[list.length - 1];
  }

  private async deletePending(code: string, userId?: string): Promise<void> {
    if (this.redisService) {
      await this.redisService.del(`pending:tx:code:${code}`);
      if (userId) {
        await this.redisService.del(`pending:tx:user:${userId}`);
      }
    }
    const local = this.pendingMap.get(code);
    if (local) {
      if (local.timer) {
        clearTimeout(local.timer);
      }
      this.pendingMap.delete(code);
    }
  }

  private generateCode(): string {
    let code = '';
    do {
      code = String(Math.floor(100 + Math.random() * 900));
    } while (this.pendingMap.has(code));
    return code;
  }

  public async createPending(params: {
    userId: string;
    chatId: string;
    payload: PendingTransaction['payload'];
  }): Promise<PendingTransaction> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.timeoutMs;

    const pending: PendingTransaction = {
      code,
      userId: params.userId,
      chatId: params.chatId,
      payload: params.payload,
      createdAt: now,
      expiresAt,
    };

    // Lưu vào Redis với TTL 60 giây (tự động giải phóng bộ nhớ khi hết hạn)
    if (this.redisService) {
      const ttlSeconds = Math.ceil(this.timeoutMs / 1000);
      const serialized = JSON.stringify({
        code: pending.code,
        userId: pending.userId,
        chatId: pending.chatId,
        payload: pending.payload,
        createdAt: pending.createdAt,
        expiresAt: pending.expiresAt,
      });
      await this.redisService.set(`pending:tx:code:${code}`, serialized, ttlSeconds);
      await this.redisService.set(`pending:tx:user:${params.userId}`, code, ttlSeconds);
    }

    // Thiết lập timer thông báo hết hạn sau 1 phút
    pending.timer = setTimeout(async () => {
      await this.handleTimeout(code);
    }, this.timeoutMs);

    this.pendingMap.set(code, pending);

    const typeLabel = pending.payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
    const txAmount = Number(pending.payload.amount).toLocaleString('vi-VN');

    let msg =
      `⏳ Xác nhận lưu ${typeLabel.toLowerCase()}?\n\n` +
      `• Số tiền: ${txAmount} đ\n` +
      `• Danh mục: ${pending.payload.category}\n` +
      `• Ghi chú: ${pending.payload.note}`;

    if (pending.payload.occurredAt) {
      const txDate = new Date(pending.payload.occurredAt);
      const formattedDate = txDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      msg += `\n• Thời gian: ${formattedDate}`;
    }

    msg +=
      `\n\n👉 Soạn: yes ${code} (để xác nhận lưu)` +
      `\n👉 Soạn: cancel ${code} (để hủy bỏ)` +
      `\n⏱️ Tự động hết hạn sau 1 phút.`;

    await this.zaloService.sendMessage(params.chatId, msg);
    return pending;
  }

  public async handleTimeout(code: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (!pending) return;

    await this.deletePending(code, pending.userId);

    const typeLabel = pending.payload.type === 'income' ? 'khoản thu' : 'khoản chi';
    const txAmount = Number(pending.payload.amount).toLocaleString('vi-VN');

    await this.zaloService.sendMessage(
      pending.chatId,
      `⏰ Giao dịch ${typeLabel} "${pending.payload.note}" (${txAmount} đ - mã: ${code}) đã hết hạn 1 phút và chưa được xác nhận.`,
    );
  }

  public async handleCommand(userId: string, chatId: string, text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Khớp xác nhận: yes, y, ok, xác nhận, xac nhan (+ mã tùy chọn)
    const confirmMatch = trimmed.match(
      /^(?:yes|y|ok|xác\s*nhận|xac\s*nhan)(?:\s+([a-zA-Z0-9]{3,6}))?$/i,
    );
    if (confirmMatch) {
      const code = confirmMatch[1];
      return this.processConfirm(userId, chatId, code);
    }

    // Khớp hủy: cancel, no, hủy, huy (+ mã tùy chọn)
    const cancelMatch = trimmed.match(/^(?:cancel|no|hủy|huy)(?:\s+([a-zA-Z0-9]{3,6}))?$/i);
    if (cancelMatch) {
      const code = cancelMatch[1];
      return this.processCancel(userId, chatId, code);
    }

    return false;
  }

  private async processConfirm(userId: string, chatId: string, code?: string): Promise<boolean> {
    let pending: PendingTransaction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Không tìm thấy giao dịch chờ xác nhận với mã "${code}". Vui lòng kiểm tra lại.`,
        );
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Bạn không có quyền xác nhận giao dịch mã "${code}".`,
        );
        return true;
      }
    } else {
      pending = await this.getPendingForUser(userId);
      if (!pending) {
        return false;
      }
    }

    if (Date.now() > pending.expiresAt) {
      await this.deletePending(pending.code, pending.userId);
      await this.zaloService.sendMessage(
        chatId,
        `⏰ Giao dịch mã "${pending.code}" đã hết hạn xác nhận (quá 1 phút) và chưa được lưu.`,
      );
      return true;
    }

    await this.deletePending(pending.code, pending.userId);

    try {
      const tx = await this.financeService.createTransaction(pending.payload);
      const typeLabel = pending.payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
      const txAmount = Number(tx.amount || pending.payload.amount).toLocaleString('vi-VN');

      let reply =
        `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n` +
        `• Số tiền: ${txAmount} đ\n` +
        `• Danh mục: ${tx.category}\n` +
        `• Ghi chú: ${tx.note}`;

      if (tx.occurredAt) {
        const txDate = new Date(tx.occurredAt);
        const formattedDate = txDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        reply += `\n• Thời gian: ${formattedDate}`;
      }

      await this.zaloService.sendMessage(chatId, reply);
      return true;
    } catch (err) {
      this.logger.error(`Failed to execute confirmed transaction: ${(err as Error).message}`);
      await this.zaloService.sendMessage(chatId, '⚠️ Có lỗi xảy ra khi lưu giao dịch thu chi.');
      return true;
    }
  }

  private async processCancel(userId: string, chatId: string, code?: string): Promise<boolean> {
    let pending: PendingTransaction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Không tìm thấy giao dịch chờ xác nhận với mã "${code}".`,
        );
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Bạn không có quyền hủy giao dịch mã "${code}".`,
        );
        return true;
      }
    } else {
      pending = await this.getPendingForUser(userId);
      if (!pending) {
        return false;
      }
    }

    await this.deletePending(pending.code, pending.userId);

    const typeLabel = pending.payload.type === 'income' ? 'khoản thu' : 'khoản chi';
    const txAmount = Number(pending.payload.amount).toLocaleString('vi-VN');

    await this.zaloService.sendMessage(
      chatId,
      `❌ Đã hủy giao dịch ${typeLabel} "${pending.payload.note}" (${txAmount} đ - mã: ${pending.code}). Giao dịch chưa được lưu.`,
    );
    return true;
  }
}

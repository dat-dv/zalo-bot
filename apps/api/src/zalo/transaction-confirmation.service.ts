import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import { FinanceService } from '../finance/finance.service';
import { RedisService } from '../redis/redis.service';

export type PendingActionType = 'create' | 'delete';

export interface PendingDeletePayload {
  transactionId: string;
  type: 'income' | 'expense';
  amount: number;
  currency?: string;
  category?: string;
  note?: string;
  occurredAt?: string;
}

export interface PendingTransaction {
  action?: PendingActionType;
  code: string;
  userId: string;
  chatId: string;
  payload?: {
    userId: string;
    type: 'income' | 'expense';
    amount: number;
    currency?: string;
    category?: string;
    paymentMethod?: string;
    placeName?: string;
    note: string;
    occurredAt?: string;
  };
  deletePayload?: PendingDeletePayload;
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
    private readonly redisService?: RedisService,
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

  public formatTransactionCard(payload: NonNullable<PendingTransaction['payload']>): string {
    const txAmount = Number(payload.amount).toLocaleString('vi-VN');
    const currency = payload.currency || 'VND';
    const category = payload.category?.trim() || '(trống)';
    const note = payload.note?.trim() || '(trống)';

    let timeFormatted = '(trống)';
    if (payload.occurredAt) {
      const txDate = new Date(payload.occurredAt);
      if (!Number.isNaN(txDate.getTime())) {
        timeFormatted = txDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    }

    const place = payload.placeName?.trim() || '(trống)';
    const paymentMethod = payload.paymentMethod?.trim() || '(trống)';

    return (
      `• Số tiền: ${txAmount} ${currency === 'VND' ? 'đ' : currency}\n` +
      `• Danh mục: ${category}\n` +
      `• Ghi chú: ${note}\n` +
      `• Thời gian: ${timeFormatted}\n` +
      `• Địa điểm: ${place}\n` +
      `• Phương thức: ${paymentMethod}`
    );
  }

  public async createPending(params: {
    userId: string;
    chatId: string;
    payload: NonNullable<PendingTransaction['payload']>;
  }): Promise<PendingTransaction> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.timeoutMs;

    const pending: PendingTransaction = {
      action: 'create',
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
        action: pending.action,
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

    const msg =
      `⏳ Xác nhận lưu ${typeLabel.toLowerCase()}?\n\n` +
      this.formatTransactionCard(pending.payload) +
      `\n\n👉 Soạn: yes ${code} (để xác nhận lưu)` +
      `\n👉 Soạn: cancel ${code} (để hủy bỏ)` +
      `\n⏱️ Tự động hết hạn sau 1 phút.`;

    await this.zaloService.sendMessage(params.chatId, msg);
    return pending;
  }

  public async createPendingDelete(params: {
    userId: string;
    chatId: string;
    deletePayload: PendingDeletePayload;
  }): Promise<PendingTransaction> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.timeoutMs;

    const pending: PendingTransaction = {
      action: 'delete',
      code,
      userId: params.userId,
      chatId: params.chatId,
      deletePayload: params.deletePayload,
      createdAt: now,
      expiresAt,
    };

    // Lưu vào Redis với TTL 60 giây
    if (this.redisService) {
      const ttlSeconds = Math.ceil(this.timeoutMs / 1000);
      const serialized = JSON.stringify({
        action: pending.action,
        code: pending.code,
        userId: pending.userId,
        chatId: pending.chatId,
        deletePayload: pending.deletePayload,
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

    const typeLabel =
      pending.deletePayload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
    const txAmount = Number(pending.deletePayload.amount).toLocaleString('vi-VN');
    const currency = pending.deletePayload.currency || 'VND';

    let timeFormatted = '(trống)';
    if (pending.deletePayload.occurredAt) {
      const txDate = new Date(pending.deletePayload.occurredAt);
      if (!Number.isNaN(txDate.getTime())) {
        timeFormatted = txDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    }

    const msg =
      `⚠️ Xác nhận XÓA ${typeLabel.toLowerCase()} này?\n\n` +
      `• Số tiền: ${txAmount} ${currency === 'VND' ? 'đ' : currency}\n` +
      `• Danh mục: ${pending.deletePayload.category || '(trống)'}\n` +
      `• Ghi chú: ${pending.deletePayload.note || '(trống)'}\n` +
      `• Thời gian: ${timeFormatted}\n` +
      `• ID: ${pending.deletePayload.transactionId}\n\n` +
      `👉 Soạn: yes ${code} (để xác nhận xóa)\n` +
      `👉 Soạn: cancel ${code} (để hủy bỏ)\n` +
      `⏱️ Tự động hết hạn sau 1 phút.`;

    await this.zaloService.sendMessage(params.chatId, msg);
    return pending;
  }

  public async handleTimeout(code: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (!pending) return;

    await this.deletePending(code, pending.userId);

    if (pending.action === 'delete' && pending.deletePayload) {
      const typeLabel =
        pending.deletePayload.type === 'income' ? 'khoản thu' : 'khoản chi';
      const txAmount = Number(pending.deletePayload.amount).toLocaleString('vi-VN');

      await this.zaloService.sendMessage(
        pending.chatId,
        `⏰ Yêu cầu xóa ${typeLabel} "${pending.deletePayload.note || ''}" (${txAmount} đ - mã: ${code}) đã hết hạn 1 phút. Giao dịch vẫn an toàn.`,
      );
      return;
    }

    if (pending.payload) {
      const typeLabel = pending.payload.type === 'income' ? 'khoản thu' : 'khoản chi';
      const txAmount = Number(pending.payload.amount).toLocaleString('vi-VN');

      await this.zaloService.sendMessage(
        pending.chatId,
        `⏰ Giao dịch ${typeLabel} "${pending.payload.note}" (${txAmount} đ - mã: ${code}) đã hết hạn 1 phút và chưa được xác nhận.`,
      );
    }
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

      const occurredAtVal = tx?.occurredAt
        ? (tx.occurredAt instanceof Date ? tx.occurredAt.toISOString() : String(tx.occurredAt))
        : pending.payload.occurredAt;

      const reply =
        `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n` +
        this.formatTransactionCard({
          ...pending.payload,
          amount: tx?.amount ?? pending.payload.amount,
          category: tx?.category ?? pending.payload.category,
          note: tx?.note ?? pending.payload.note,
          occurredAt: occurredAtVal,
        });

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

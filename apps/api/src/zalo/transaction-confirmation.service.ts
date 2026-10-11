import { Injectable, Logger, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import {
  FinanceService,
  CreateFinanceTransactionDto,
  CreateDebtDto,
} from '../finance/finance.service';
import { RemindersService, CreateReminderDto } from '../reminders/reminders.service';
import { GoogleTasksService, CreateTaskOptions } from '../google/google-tasks.service';
import { GoogleCalendarService, CreateEventOptions } from '../google/google-calendar.service';
import { RedisService } from '../redis/redis.service';
import {
  DtoDescriptor,
  renderDtoConfirmationCard,
  FINANCE_TRANSACTION_DESCRIPTOR,
  DELETE_TRANSACTION_DESCRIPTOR,
  DeleteTransactionDto,
  DEBT_DESCRIPTOR,
  REMINDER_DESCRIPTOR,
  TASK_DESCRIPTOR,
  CALENDAR_EVENT_DESCRIPTOR,
} from './confirmation/dto-descriptor.util';

export type PendingActionType =
  | 'RECORD_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'MANAGE_DEBT'
  | 'SET_REMINDER'
  | 'CREATE_TASK'
  | 'CREATE_CALENDAR_EVENT'
  | 'create'
  | 'delete';

export type PendingDeletePayload = DeleteTransactionDto;

export interface PendingAction {
  code: string;
  userId: string;
  chatId: string;
  actionType: PendingActionType;
  title: string;
  payload: any;
  deletePayload?: PendingDeletePayload;
  createdAt: number;
  expiresAt: number;
  timer?: NodeJS.Timeout;
}

/** Alias to maintain backward compatibility */
export type PendingTransaction = PendingAction;

@Injectable()
export class TransactionConfirmationService implements OnModuleDestroy {
  private readonly logger = new Logger(TransactionConfirmationService.name);
  private readonly pendingMap = new Map<string, PendingAction>();
  public timeoutMs = 60 * 1000; // 1 phút (60 giây)

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
    private readonly remindersService?: RemindersService,
    private readonly googleTasksService?: GoogleTasksService,
    private readonly googleCalendarService?: GoogleCalendarService,
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

  public async getPendingByCode(code: string): Promise<PendingAction | undefined> {
    if (this.redisService) {
      const raw = await this.redisService.get(`pending:tx:code:${code}`);
      if (raw) {
        try {
          return JSON.parse(raw) as PendingAction;
        } catch {
          // ignore json parse error, fall back to memory
        }
      }
    }
    return this.pendingMap.get(code);
  }

  public async getPendingForUser(userId: string): Promise<PendingAction | undefined> {
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

  public formatTransactionCard(payload: any): string {
    return renderDtoConfirmationCard(payload, FINANCE_TRANSACTION_DESCRIPTOR);
  }

  /**
   * Tạo yêu cầu chờ xác nhận tổng quát dựa trên DTO Descriptor.
   */
  public async createPendingAction<T extends object>(params: {
    userId: string;
    chatId: string;
    actionType: PendingActionType;
    title: string;
    payload: T;
    descriptor: DtoDescriptor<T>;
  }): Promise<PendingAction> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.timeoutMs;

    const pending: PendingAction = {
      code,
      userId: params.userId,
      chatId: params.chatId,
      actionType: params.actionType,
      title: params.title,
      payload: params.payload,
      createdAt: now,
      expiresAt,
    };

    // Lưu vào Redis với TTL 60 giây (tự động dọn dẹp khi hết hạn)
    if (this.redisService) {
      const ttlSeconds = Math.ceil(this.timeoutMs / 1000);
      const serialized = JSON.stringify({
        code: pending.code,
        userId: pending.userId,
        chatId: pending.chatId,
        actionType: pending.actionType,
        title: pending.title,
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

    const cardContent = renderDtoConfirmationCard(params.payload, params.descriptor);

    const msg =
      `⏳ Xác nhận ${params.title.toLowerCase()}?\n\n` +
      cardContent +
      `\n\n👉 Soạn: yes ${code} (để xác nhận)` +
      `\n👉 Soạn: cancel ${code} (để hủy bỏ)` +
      `\n⏱️ Tự động hết hạn sau 1 phút.`;

    await this.zaloService.sendMessage(params.chatId, msg);
    return pending;
  }

  /**
   * Tạo yêu cầu xác nhận ghi nhận thu/chi (tương thích backward).
   */
  public async createPending(params: {
    userId: string;
    chatId: string;
    payload: CreateFinanceTransactionDto;
  }): Promise<PendingAction> {
    const typeLabel = params.payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'RECORD_TRANSACTION',
      title: `lưu ${typeLabel}`,
      payload: params.payload,
      descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    });
  }

  /**
   * Tạo yêu cầu xác nhận xóa giao dịch thu/chi.
   */
  public async createPendingDelete(params: {
    userId: string;
    chatId: string;
    deletePayload?: DeleteTransactionDto;
    payload?: DeleteTransactionDto;
  }): Promise<PendingAction> {
    const data = params.deletePayload || params.payload;
    const typeLabel = data.type === 'income' ? 'khoản thu' : 'khoản chi';
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'DELETE_TRANSACTION',
      title: `XÓA ${typeLabel}`,
      payload: data,
      descriptor: DELETE_TRANSACTION_DESCRIPTOR,
    });
  }

  /**
   * Tạo yêu cầu xác nhận ghi nhận công nợ.
   */
  public async createPendingDebt(params: {
    userId: string;
    chatId: string;
    payload: CreateDebtDto;
  }): Promise<PendingAction> {
    const directionLabel =
      params.payload.direction === 'receivable' ? 'khoản cho vay (họ nợ)' : 'khoản nợ (bạn nợ)';
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'MANAGE_DEBT',
      title: `ghi nhận ${directionLabel}`,
      payload: params.payload,
      descriptor: DEBT_DESCRIPTOR,
    });
  }

  /**
   * Tạo yêu cầu xác nhận lịch nhắc nhở.
   */
  public async createPendingReminder(params: {
    userId: string;
    chatId: string;
    payload: CreateReminderDto;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'SET_REMINDER',
      title: 'đặt lịch nhắc nhở',
      payload: params.payload,
      descriptor: REMINDER_DESCRIPTOR,
    });
  }

  /**
   * Tạo yêu cầu xác nhận việc cần làm Google Tasks.
   */
  public async createPendingTask(params: {
    userId: string;
    chatId: string;
    payload: CreateTaskOptions;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'CREATE_TASK',
      title: 'thêm việc cần làm (Google Tasks)',
      payload: params.payload,
      descriptor: TASK_DESCRIPTOR,
    });
  }

  /**
   * Tạo yêu cầu xác nhận sự kiện Google Calendar.
   */
  public async createPendingCalendarEvent(params: {
    userId: string;
    chatId: string;
    payload: CreateEventOptions;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'CREATE_CALENDAR_EVENT',
      title: 'tạo sự kiện Google Calendar',
      payload: params.payload,
      descriptor: CALENDAR_EVENT_DESCRIPTOR,
    });
  }

  public async handleTimeout(code: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (!pending) return;

    await this.deletePending(code, pending.userId);

    let title = pending.title || 'Thao tác';
    if (pending.actionType === 'DELETE_TRANSACTION' || pending.actionType === 'delete') {
      const typeLabel = pending.payload?.type === 'income' ? 'khoản thu' : 'khoản chi';
      title = `Yêu cầu xóa ${typeLabel}`;
    }
    const note = pending.payload?.note || pending.payload?.title || pending.payload?.summary || '';
    const noteSuffix = note ? ` "${note}"` : '';

    await this.zaloService.sendMessage(
      pending.chatId,
      `⏰ ${title}${noteSuffix} (mã: ${code}) đã hết hạn 1 phút và chưa được xác nhận.`,
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
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Không tìm thấy yêu cầu chờ xác nhận với mã "${code}". Vui lòng kiểm tra lại.`,
        );
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Bạn không có quyền xác nhận yêu cầu mã "${code}".`,
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
        `⏰ Yêu cầu mã "${pending.code}" đã hết hạn xác nhận (quá 1 phút) và chưa được thực hiện.`,
      );
      return true;
    }

    await this.deletePending(pending.code, pending.userId);

    try {
      switch (pending.actionType) {
        case 'RECORD_TRANSACTION':
        case 'create': {
          const tx = await this.financeService.createTransaction(pending.payload);
          const typeLabel = pending.payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
          const cardContent = renderDtoConfirmationCard(
            {
              ...pending.payload,
              amount: tx?.amount ?? pending.payload.amount,
              category: tx?.category ?? pending.payload.category,
              note: tx?.note ?? pending.payload.note,
              occurredAt: tx?.occurredAt
                ? tx.occurredAt instanceof Date
                  ? tx.occurredAt.toISOString()
                  : String(tx.occurredAt)
                : pending.payload.occurredAt,
            },
            FINANCE_TRANSACTION_DESCRIPTOR,
          );
          const reply = `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n${cardContent}`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'DELETE_TRANSACTION':
        case 'delete': {
          const payload = (pending.payload || pending.deletePayload) as DeleteTransactionDto;
          const success = await this.financeService.deleteTransaction(
            pending.userId,
            payload.transactionId,
          );
          if (success) {
            const typeLabel = payload.type === 'income' ? 'khoản thu' : 'khoản chi';
            const cardContent = renderDtoConfirmationCard(payload, DELETE_TRANSACTION_DESCRIPTOR);
            await this.zaloService.sendMessage(
              chatId,
              `🗑️ Đã xóa ${typeLabel} thành công!\n\n${cardContent}`,
            );
          } else {
            await this.zaloService.sendMessage(
              chatId,
              `⚠️ Không tìm thấy giao dịch hoặc bạn không có quyền xóa giao dịch này.`,
            );
          }
          break;
        }
        case 'MANAGE_DEBT': {
          const debt = await this.financeService.createDebt(pending.payload);
          const cardContent = renderDtoConfirmationCard(
            {
              ...pending.payload,
              amount: debt?.originalAmount ?? pending.payload.amount,
              counterparty: debt?.counterparty ?? pending.payload.counterparty,
              note: debt?.note ?? pending.payload.note,
              occurredAt: debt?.occurredAt
                ? debt.occurredAt instanceof Date
                  ? debt.occurredAt.toISOString()
                  : String(debt.occurredAt)
                : pending.payload.occurredAt,
              dueAt: debt?.dueAt
                ? debt.dueAt instanceof Date
                  ? debt.dueAt.toISOString()
                  : String(debt.dueAt)
                : pending.payload.dueAt,
            },
            DEBT_DESCRIPTOR,
          );
          const reply = `✅ Đã xác nhận và ghi nhận khoản nợ thành công!\n\n${cardContent}`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'SET_REMINDER': {
          if (!this.remindersService) {
            throw new Error('RemindersService chưa được cấu hình.');
          }
          const reminder = await this.remindersService.createReminder(pending.payload);
          const cardContent = renderDtoConfirmationCard(
            {
              ...pending.payload,
              title: reminder?.title ?? pending.payload.title,
              remindAt: reminder?.remindAt ?? pending.payload.remindAt,
            },
            REMINDER_DESCRIPTOR,
          );
          const reply = `⏰ Đã xác nhận và đặt lịch nhắc thành công!\n\n${cardContent}`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'CREATE_TASK': {
          if (!this.googleTasksService) {
            throw new Error('GoogleTasksService chưa được cấu hình.');
          }
          const task = await this.googleTasksService.createTask(pending.payload, pending.userId);
          const cardContent = renderDtoConfirmationCard(
            {
              ...pending.payload,
              title: task?.title ?? pending.payload.title,
            },
            TASK_DESCRIPTOR,
          );
          const reply =
            `✅ ĐÃ XÁC NHẬN VÀ THÊM VIỆC CẦN LÀM VÀO GOOGLE TASKS!\n\n` +
            cardContent +
            `\n\n💡 Gõ /tasks để xem toàn bộ danh sách việc cần làm.`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'CREATE_CALENDAR_EVENT': {
          if (!this.googleCalendarService) {
            throw new Error('GoogleCalendarService chưa được cấu hình.');
          }
          await this.googleCalendarService.createEvent(pending.payload, pending.userId);
          const cardContent = renderDtoConfirmationCard(pending.payload, CALENDAR_EVENT_DESCRIPTOR);
          const reply =
            `✅ ĐÃ XÁC NHẬN VÀ TẠO SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n` +
            cardContent +
            `\n\n🔗 Sự kiện đã được đồng bộ lên Google Calendar của bạn.`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        default: {
          await this.financeService.createTransaction(pending.payload);
          await this.zaloService.sendMessage(chatId, '✅ Đã xác nhận thao tác thành công!');
          break;
        }
      }
      return true;
    } catch (err) {
      this.logger.error(`Failed to execute confirmed action: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        chatId,
        `⚠️ Có lỗi xảy ra khi thực hiện thao tác: ${(err as Error).message}`,
      );
      return true;
    }
  }

  private async processCancel(userId: string, chatId: string, code?: string): Promise<boolean> {
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Không tìm thấy yêu cầu chờ xác nhận với mã "${code}".`,
        );
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Bạn không có quyền hủy yêu cầu mã "${code}".`,
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

    let actionDesc = pending.title || 'thao tác';
    if (pending.actionType === 'RECORD_TRANSACTION' || pending.actionType === 'create') {
      const typeLabel = pending.payload?.type === 'income' ? 'khoản thu' : 'khoản chi';
      actionDesc = `giao dịch ${typeLabel}`;
    } else if (pending.actionType === 'DELETE_TRANSACTION' || pending.actionType === 'delete') {
      const typeLabel = pending.payload?.type === 'income' ? 'khoản thu' : 'khoản chi';
      actionDesc = `yêu cầu xóa ${typeLabel}`;
    }

    const note = pending.payload?.note || pending.payload?.title || pending.payload?.summary || '';
    const noteSuffix = note ? ` "${note}"` : '';

    await this.zaloService.sendMessage(
      chatId,
      `❌ Đã hủy ${actionDesc.toLowerCase()}${noteSuffix} (mã: ${pending.code}). Yêu cầu chưa được lưu.`,
    );
    return true;
  }
}

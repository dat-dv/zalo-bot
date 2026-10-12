import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import {
  FinanceService,
  CreateFinanceTransactionDto,
  CreateDebtDto,
} from '../finance/finance.service';
import { RemindersService, CreateReminderDto } from '../reminders/reminders.service';
import { GoogleTasksService, CreateTaskOptions } from '../google/google-tasks.service';
import { GoogleCalendarService, CreateEventOptions } from '../google/google-calendar.service';
import { UsersService } from '../users/users.service';
import { GoogleAuthService } from '../google/google-auth.service';
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
  COMPLETE_TASK_DESCRIPTOR,
  CompleteTaskDto,
  DELETE_CALENDAR_EVENT_DESCRIPTOR,
  DeleteCalendarEventDto,
  BAN_USER_DESCRIPTOR,
  BanUserDto,
} from './confirmation/dto-descriptor.util';

export type PendingActionType =
  | 'RECORD_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'MANAGE_DEBT'
  | 'SET_REMINDER'
  | 'CREATE_TASK'
  | 'COMPLETE_TASK'
  | 'CREATE_CALENDAR_EVENT'
  | 'DELETE_CALENDAR_EVENT'
  | 'BAN_USER'
  | 'create'
  | 'delete';

export type PendingDeletePayload = DeleteTransactionDto;

export interface PendingAction {
  code: string;
  userId: string;
  chatId: string;
  actionType: PendingActionType;
  title: string;
  payload: Record<string, unknown>;
  deletePayload?: PendingDeletePayload;
  rawPrompt?: string;
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
  public timeoutMs = 5 * 60 * 1000; // 5 phút (300 giây)

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
    private readonly remindersService?: RemindersService,
    private readonly googleTasksService?: GoogleTasksService,
    private readonly googleCalendarService?: GoogleCalendarService,
    private readonly usersService?: UsersService,
    private readonly googleAuthService?: GoogleAuthService,
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

  public formatTransactionCard(payload: CreateFinanceTransactionDto): string {
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
    rawPrompt?: string;
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
      payload: params.payload as Record<string, unknown>,
      rawPrompt: params.rawPrompt,
      createdAt: now,
      expiresAt,
    };

    // Lưu vào Redis với TTL (tự động dọn dẹp khi hết hạn)
    if (this.redisService) {
      const ttlSeconds = Math.ceil(this.timeoutMs / 1000);
      const serialized = JSON.stringify({
        code: pending.code,
        userId: pending.userId,
        chatId: pending.chatId,
        actionType: pending.actionType,
        title: pending.title,
        payload: pending.payload,
        rawPrompt: pending.rawPrompt,
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
    if (typeof pending.timer?.unref === 'function') {
      pending.timer.unref();
    }

    this.pendingMap.set(code, pending);

    const cardContent = renderDtoConfirmationCard(params.payload, params.descriptor);

    const msg =
      `⏳ Xác nhận ${params.title.toLowerCase()}?\n\n` +
      cardContent +
      `\n\n👉 Soạn: yes ${code} (để xác nhận)` +
      `\n👉 Soạn: cancel ${code} (để hủy bỏ)` +
      `\n👉 Soạn: edit ${code} <nội dung sửa> (để điều chỉnh)` +
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
    rawPrompt?: string;
  }): Promise<PendingAction> {
    const typeLabel = params.payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'RECORD_TRANSACTION',
      title: `lưu ${typeLabel}`,
      payload: params.payload,
      descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
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
    rawPrompt?: string;
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
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận ghi nhận công nợ.
   */
  public async createPendingDebt(params: {
    userId: string;
    chatId: string;
    payload: CreateDebtDto;
    rawPrompt?: string;
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
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận lịch nhắc nhở.
   */
  public async createPendingReminder(params: {
    userId: string;
    chatId: string;
    payload: CreateReminderDto;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'SET_REMINDER',
      title: 'đặt lịch nhắc nhở',
      payload: params.payload,
      descriptor: REMINDER_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận việc cần làm Google Tasks.
   */
  public async createPendingTask(params: {
    userId: string;
    chatId: string;
    payload: CreateTaskOptions;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'CREATE_TASK',
      title: 'thêm việc cần làm (Google Tasks)',
      payload: params.payload,
      descriptor: TASK_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận hoàn thành việc cần làm trên Google Tasks.
   */
  public async createPendingCompleteTask(params: {
    userId: string;
    chatId: string;
    payload: CompleteTaskDto;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'COMPLETE_TASK',
      title: 'hoàn thành việc cần làm',
      payload: params.payload,
      descriptor: COMPLETE_TASK_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận sự kiện Google Calendar.
   */
  public async createPendingCalendarEvent(params: {
    userId: string;
    chatId: string;
    payload: CreateEventOptions;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'CREATE_CALENDAR_EVENT',
      title: 'tạo sự kiện Google Calendar',
      payload: params.payload,
      descriptor: CALENDAR_EVENT_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận xóa sự kiện Google Calendar.
   */
  public async createPendingDeleteCalendarEvent(params: {
    userId: string;
    chatId: string;
    payload: DeleteCalendarEventDto;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'DELETE_CALENDAR_EVENT',
      title: 'XÓA sự kiện Google Calendar',
      payload: params.payload,
      descriptor: DELETE_CALENDAR_EVENT_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận khóa tài khoản người dùng (Admin).
   */
  public async createPendingBanUser(params: {
    userId: string;
    chatId: string;
    payload: BanUserDto;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'BAN_USER',
      title: 'KHÓA tài khoản người dùng',
      payload: params.payload,
      descriptor: BAN_USER_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  public async handleTimeout(code: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (!pending) return;

    await this.deletePending(code, pending.userId);

    let title = pending.title || 'Thao tác';
    const payload = pending.payload;
    const rawType = typeof payload.type === 'string' ? payload.type : undefined;
    if (pending.actionType === 'DELETE_TRANSACTION' || pending.actionType === 'delete') {
      const typeLabel = rawType === 'income' ? 'khoản thu' : 'khoản chi';
      title = `Yêu cầu xóa ${typeLabel}`;
    } else if (pending.actionType === 'COMPLETE_TASK') {
      const taskTitle = typeof payload.taskTitle === 'string' ? payload.taskTitle : '';
      title = `Yêu cầu hoàn thành việc "${taskTitle}"`;
    } else if (pending.actionType === 'DELETE_CALENDAR_EVENT') {
      const summary = typeof payload.summary === 'string' ? payload.summary : '';
      title = `Yêu cầu xóa sự kiện "${summary}"`;
    } else if (pending.actionType === 'BAN_USER') {
      const targetUserId = typeof payload.targetUserId === 'string' ? payload.targetUserId : '';
      title = `Yêu cầu khóa tài khoản "${targetUserId}"`;
    }

    const note =
      (typeof payload.note === 'string' && payload.note) ||
      (typeof payload.title === 'string' && payload.title) ||
      (typeof payload.summary === 'string' && payload.summary) ||
      '';
    const noteSuffix = note ? ` "${note}"` : '';

    await this.zaloService.sendMessage(
      pending.chatId,
      `⏰ ${title}${noteSuffix} (mã: ${code}) đã hết hạn 5 phút và chưa được xác nhận.`,
    );
  }

  public async handleCommand(
    userId: string,
    chatId: string,
    text: string,
    onEdit?: (pending: PendingAction, instruction: string) => Promise<void>,
  ): Promise<boolean> {
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

    // Khớp hủy: cancel, no, hủy, huỷ, huy (+ mã tùy chọn)
    const cancelMatch = trimmed.match(
      /^(?:cancel|no|hủy|huỷ|huy|bỏ\s*qua|bo\s*qua)(?:\s+([a-zA-Z0-9]{3,6}))?$/i,
    );
    if (cancelMatch) {
      const code = cancelMatch[1];
      return this.processCancel(userId, chatId, code);
    }

    // Khớp điều chỉnh / sửa: edit, sửa, sua, chỉnh sửa, chinh sua, sửa lại, sua lai
    const editPrefixMatch = trimmed.match(
      /^(?:edit|chỉnh\s*sửa|chinh\s*sua|sửa\s*lại|sua\s*lai|sửa|sua)(?:[:\-–\s]+|$)([\s\S]*)$/i,
    );
    if (editPrefixMatch) {
      const rest = (editPrefixMatch[1] || '').trim();
      let code: string | undefined;
      let instruction: string = rest;

      const tokenMatch = rest.match(/^([a-zA-Z0-9]{3,6})(?:[:\-–\s]+([\s\S]*)|$)/);
      if (tokenMatch) {
        const possibleCode = tokenMatch[1];
        const remainder = tokenMatch[2]?.trim() || '';

        const existingPending = await this.getPendingByCode(possibleCode);
        if (existingPending) {
          code = possibleCode;
          instruction = remainder;
        } else if (/^\d{3,6}$/.test(possibleCode)) {
          code = possibleCode;
          instruction = remainder;
        }
      }

      const handled = await this.processEdit(userId, chatId, code, instruction, onEdit);
      if (handled) {
        return true;
      }
    }

    return false;
  }

  private async processEdit(
    userId: string,
    chatId: string,
    code?: string,
    instruction?: string,
    onEdit?: (pending: PendingAction, instruction: string) => Promise<void>,
  ): Promise<boolean> {
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
          `⚠️ Bạn không có quyền chỉnh sửa yêu cầu mã "${code}".`,
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

    const trimmedInstruction = instruction?.trim() || '';
    if (!trimmedInstruction) {
      await this.zaloService.sendMessage(
        chatId,
        `✏️ Vui lòng cung cấp nội dung bạn muốn chỉnh sửa cho yêu cầu (mã: ${pending.code}).\nVí dụ: edit ${pending.code} đổi số tiền thành 60k`,
      );
      return true;
    }

    await this.deletePending(pending.code, pending.userId);

    if (onEdit) {
      try {
        await onEdit(pending, trimmedInstruction);
      } catch (err) {
        this.logger.error(`Lỗi khi xử lý edit pending action: ${(err as Error).message}`);
        await this.zaloService.sendMessage(
          chatId,
          `⚠️ Có lỗi xảy ra khi xử lý điều chỉnh yêu cầu: ${(err as Error).message}`,
        );
      }
      return true;
    }

    await this.zaloService.sendMessage(
      chatId,
      `✏️ Đã nhận yêu cầu điều chỉnh cho mã "${pending.code}": "${trimmedInstruction}".`,
    );
    return true;
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
        `⏰ Yêu cầu mã "${pending.code}" đã hết hạn xác nhận (quá 5 phút) và chưa được thực hiện.`,
      );
      return true;
    }

    await this.deletePending(pending.code, pending.userId);

    try {
      switch (pending.actionType) {
        case 'RECORD_TRANSACTION':
        case 'create': {
          const payload = pending.payload as unknown as CreateFinanceTransactionDto;
          const tx = await this.financeService.createTransaction(payload);
          const typeLabel = payload.type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
          const cardContent = renderDtoConfirmationCard(
            {
              ...payload,
              amount: tx?.amount ?? payload.amount,
              category: tx?.category ?? payload.category,
              note: tx?.note ?? payload.note,
              occurredAt: tx?.occurredAt
                ? tx.occurredAt instanceof Date
                  ? tx.occurredAt.toISOString()
                  : String(tx.occurredAt)
                : payload.occurredAt,
            },
            FINANCE_TRANSACTION_DESCRIPTOR,
          );
          const reply = `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n${cardContent}`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'DELETE_TRANSACTION':
        case 'delete': {
          const payload = (pending.payload ||
            pending.deletePayload) as unknown as DeleteTransactionDto;
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
          const payload = pending.payload as unknown as CreateDebtDto;
          const debt = await this.financeService.createDebt(payload);
          const cardContent = renderDtoConfirmationCard(
            {
              ...payload,
              amount: debt?.originalAmount ?? payload.amount,
              counterparty: debt?.counterparty ?? payload.counterparty,
              note: debt?.note ?? payload.note,
              occurredAt: debt?.occurredAt
                ? debt.occurredAt instanceof Date
                  ? debt.occurredAt.toISOString()
                  : String(debt.occurredAt)
                : payload.occurredAt,
              dueAt: debt?.dueAt
                ? debt.dueAt instanceof Date
                  ? debt.dueAt.toISOString()
                  : String(debt.dueAt)
                : payload.dueAt,
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
          const payload = pending.payload as unknown as CreateReminderDto;
          const reminder = await this.remindersService.createReminder(payload);
          const cardContent = renderDtoConfirmationCard(
            {
              ...payload,
              title: reminder?.title ?? payload.title,
              remindAt: reminder?.remindAt ?? payload.remindAt,
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
          const payload = pending.payload as unknown as CreateTaskOptions;
          const task = await this.googleTasksService.createTask(payload, pending.userId);
          const cardContent = renderDtoConfirmationCard(
            {
              ...payload,
              title: task?.title ?? payload.title,
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
        case 'COMPLETE_TASK': {
          if (!this.googleTasksService) {
            throw new Error('GoogleTasksService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CompleteTaskDto;
          await this.googleTasksService.completeTask(payload.taskId, '@default', pending.userId);
          const cardContent = renderDtoConfirmationCard(payload, COMPLETE_TASK_DESCRIPTOR);
          const reply =
            `🎉 ĐÃ XÁC NHẬN VÀ HOÀN THÀNH CÔNG VIỆC TRÊN GOOGLE TASKS!\n\n` +
            cardContent +
            `\n\n💡 Gõ /tasks để xem danh sách việc cần làm còn lại.`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'CREATE_CALENDAR_EVENT': {
          if (!this.googleCalendarService) {
            throw new Error('GoogleCalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CreateEventOptions;
          await this.googleCalendarService.createEvent(payload, pending.userId);
          const cardContent = renderDtoConfirmationCard(payload, CALENDAR_EVENT_DESCRIPTOR);
          const reply =
            `✅ ĐÃ XÁC NHẬN VÀ TẠO SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n` +
            cardContent +
            `\n\n🔗 Sự kiện đã được đồng bộ lên Google Calendar của bạn.`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'DELETE_CALENDAR_EVENT': {
          if (!this.googleCalendarService) {
            throw new Error('GoogleCalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as DeleteCalendarEventDto;
          await this.googleCalendarService.deleteEvent(payload.eventId, pending.userId);
          const cardContent = renderDtoConfirmationCard(payload, DELETE_CALENDAR_EVENT_DESCRIPTOR);
          const reply =
            `🗑️ ĐÃ XÁC NHẬN VÀ XÓA SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n` + cardContent;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        case 'BAN_USER': {
          const payload = pending.payload as unknown as BanUserDto;
          if (this.usersService) {
            await this.usersService.banUser(payload.targetUserId);
          }
          if (this.googleAuthService) {
            await this.googleAuthService.revokeUserTokens(payload.targetUserId);
          }
          const cardContent = renderDtoConfirmationCard(payload, BAN_USER_DESCRIPTOR);
          const reply =
            `⛔ ĐÃ XÁC NHẬN VÀ KHÓA TÀI KHOẢN NGƯỜI DÙNG THÀNH CÔNG!\n\n` +
            cardContent +
            `\n\nToàn bộ quyền truy cập và Token Google của tài khoản đã bị thu hồi.`;
          await this.zaloService.sendMessage(chatId, reply);
          break;
        }
        default: {
          const payload = pending.payload as unknown as CreateFinanceTransactionDto;
          await this.financeService.createTransaction(payload);
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
    const payload = pending.payload;
    const rawType = typeof payload.type === 'string' ? payload.type : undefined;
    if (pending.actionType === 'RECORD_TRANSACTION' || pending.actionType === 'create') {
      const typeLabel = rawType === 'income' ? 'khoản thu' : 'khoản chi';
      actionDesc = `giao dịch ${typeLabel}`;
    } else if (pending.actionType === 'DELETE_TRANSACTION' || pending.actionType === 'delete') {
      const typeLabel = rawType === 'income' ? 'khoản thu' : 'khoản chi';
      actionDesc = `yêu cầu xóa ${typeLabel}`;
    } else if (pending.actionType === 'COMPLETE_TASK') {
      const taskTitle = typeof payload.taskTitle === 'string' ? payload.taskTitle : '';
      actionDesc = `hoàn thành việc "${taskTitle}"`;
    } else if (pending.actionType === 'DELETE_CALENDAR_EVENT') {
      const summary = typeof payload.summary === 'string' ? payload.summary : '';
      actionDesc = `xóa sự kiện "${summary}"`;
    } else if (pending.actionType === 'BAN_USER') {
      const targetUserId = typeof payload.targetUserId === 'string' ? payload.targetUserId : '';
      actionDesc = `khóa tài khoản "${targetUserId}"`;
    }

    const note =
      (typeof payload.note === 'string' && payload.note) ||
      (typeof payload.title === 'string' && payload.title) ||
      (typeof payload.summary === 'string' && payload.summary) ||
      '';
    const noteSuffix = note ? ` "${note}"` : '';

    await this.zaloService.sendMessage(
      chatId,
      `❌ Đã hủy ${actionDesc.toLowerCase()}${noteSuffix} (mã: ${pending.code}). Yêu cầu chưa được lưu.`,
    );
    return true;
  }
}

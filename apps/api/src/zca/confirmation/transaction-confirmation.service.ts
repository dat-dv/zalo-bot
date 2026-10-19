import { Injectable, Logger, OnModuleDestroy, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../zca.service';
import {
  FinanceService,
  CreateFinanceTransactionDto,
  CreateDebtDto,
} from '../../finance/finance.service';
import {
  RemindersService,
  CreateReminderDto,
  toValidReminderDate,
} from '../../reminders/reminders.service';
import { GoogleTasksService, CreateTaskOptions } from '../../google/google-tasks.service';
import { GoogleCalendarService, CreateEventOptions } from '../../google/google-calendar.service';
import { UsersService } from '../../users/users.service';
import { GoogleAuthService } from '../../google/google-auth.service';
import { RedisService } from '../../redis/redis.service';
import { ThreadConfigService } from '../thread-config.service';
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
  CreatePlaceDto,
  PLACE_DESCRIPTOR,
} from './dto-descriptor.util';

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
  | 'CREATE_PLACE'
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
  messageId?: string;
  cliMsgId?: string;
  requiredHearts?: number;
  heartUsers?: string[];
}

/** Alias to maintain backward compatibility */
export type PendingTransaction = PendingAction;

export function normalizePlaceName(val: string): string {
  return (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const REMINDER_NOTIFY_TYPES = ['text', 'call'] as const;
const REMINDER_REPEAT_TYPES = ['none', 'daily', 'weekly'] as const;
const REMINDER_STATUSES = ['pending', 'completed', 'snoozed', 'cancelled'] as const;

function pickOption<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value);
}

/**
 * Rebuilds a CreateReminderDto from a pending payload. Payloads read back from Redis are
 * plain JSON, so `remindAt` arrives as an ISO string and must be revived into a Date.
 */
export function parseReminderPayload(payload: Record<string, unknown>): CreateReminderDto {
  const { userId, title } = payload;
  if (typeof userId !== 'string' && typeof userId !== 'number') {
    throw new Error('Thiếu người dùng cho lịch nhắc.');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Thiếu nội dung lịch nhắc.');
  }
  return {
    userId,
    title,
    remindAt: toValidReminderDate(payload.remindAt),
    notifyType: pickOption(payload.notifyType, REMINDER_NOTIFY_TYPES),
    repeatType: pickOption(payload.repeatType, REMINDER_REPEAT_TYPES),
    status: pickOption(payload.status, REMINDER_STATUSES),
  };
}

@Injectable()
export class TransactionConfirmationService implements OnModuleDestroy {
  private readonly logger = new Logger(TransactionConfirmationService.name);
  private readonly pendingMap = new Map<string, PendingAction>();
  private readonly tempMessagesMap = new Map<
    string,
    Array<{ msgId: string; cliMsgId?: string; chatId: string }>
  >();
  public timeoutMs = 5 * 60 * 1000; // 5 phút (300 giây)

  private readonly zaloService: {
    sendMessage(chatId: string | number, text: string): Promise<unknown>;
    sendMessageWithResult?(
      chatId: string | number,
      text: string,
    ): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }>;
    undoMessage?(chatId: string | number, msgId: string, cliMsgId?: string): Promise<boolean>;
  };

  constructor(
    @Inject(forwardRef(() => ZcaService))
    rawMessenger: any,
    private readonly financeService: FinanceService,
    @Optional() private readonly remindersService?: RemindersService,
    @Optional() private readonly googleTasksService?: GoogleTasksService,
    @Optional() private readonly googleCalendarService?: GoogleCalendarService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly googleAuthService?: GoogleAuthService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
  ) {
    this.zaloService = {
      sendMessage: async (chatId: string | number, text: string) => {
        if (rawMessenger?.sendMessageToChat) {
          return rawMessenger.sendMessageToChat(chatId, text);
        }
        if (typeof rawMessenger?.isLoggedIn === 'function') {
          return rawMessenger.sendMessage(text, String(chatId));
        }
        if (typeof rawMessenger?.sendMessage === 'function') {
          return rawMessenger.sendMessage(chatId, text);
        }
        return false;
      },
      sendMessageWithResult: async (chatId: string | number, text: string) => {
        if (rawMessenger?.sendMessageWithResult) {
          return rawMessenger.sendMessageWithResult(chatId, text);
        }
        if (rawMessenger?.sendMessage) {
          await rawMessenger.sendMessage(chatId, text);
          return { success: true };
        }
        return { success: false };
      },
      undoMessage: async (chatId: string | number, msgId: string, cliMsgId?: string) => {
        if (rawMessenger?.undoMessage) {
          return rawMessenger.undoMessage(chatId, msgId, cliMsgId);
        }
        return false;
      },
    };
  }
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

  public async getPendingListForUser(userId: string): Promise<PendingAction[]> {
    if (this.redisService) {
      const key = `pending:tx:user-codes:${userId}`;
      const raw = await this.redisService.get(key);
      if (raw) {
        try {
          const codes = JSON.parse(raw) as string[];
          const list: PendingAction[] = [];
          for (const code of codes) {
            const p = await this.getPendingByCode(code);
            if (p) list.push(p);
          }
          if (list.length > 0) {
            return list;
          }
        } catch {
          // fallback to memory
        }
      }
    }
    return Array.from(this.pendingMap.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  public async getPendingForUser(userId: string): Promise<PendingAction | undefined> {
    const list = await this.getPendingListForUser(userId);
    return list[list.length - 1];
  }

  public async hasPendingPlace(userId: string, placeName: string): Promise<boolean> {
    const norm = normalizePlaceName(placeName);
    if (!norm) return false;
    const list = await this.getPendingListForUser(userId);
    return list.some(
      (p) =>
        p.actionType === 'CREATE_PLACE' &&
        normalizePlaceName((p.payload?.name as string) || '') === norm,
    );
  }

  private async addUserPendingCode(userId: string, code: string): Promise<void> {
    if (this.redisService) {
      const key = `pending:tx:user-codes:${userId}`;
      const raw = await this.redisService.get(key);
      let codes: string[] = [];
      if (raw) {
        try {
          codes = JSON.parse(raw) as string[];
        } catch {
          codes = [];
        }
      }
      if (!codes.includes(code)) {
        codes.push(code);
      }
      const ttl = Math.ceil(this.timeoutMs / 1000);
      await this.redisService.set(key, JSON.stringify(codes), ttl);
    }
  }

  private async removeUserPendingCode(userId: string, code: string): Promise<void> {
    if (this.redisService) {
      const key = `pending:tx:user-codes:${userId}`;
      const raw = await this.redisService.get(key);
      if (raw) {
        try {
          let codes = JSON.parse(raw) as string[];
          codes = codes.filter((c) => c !== code);
          if (codes.length > 0) {
            const ttl = Math.ceil(this.timeoutMs / 1000);
            await this.redisService.set(key, JSON.stringify(codes), ttl);
          } else {
            await this.redisService.del(key);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  private async deletePending(code: string, userId?: string): Promise<void> {
    const local = this.pendingMap.get(code);
    const targetUserId = userId || local?.userId;
    if (this.redisService) {
      await this.redisService.del(`pending:tx:code:${code}`);
      if (targetUserId) {
        await this.redisService.del(`pending:tx:user:${targetUserId}`);
        await this.removeUserPendingCode(targetUserId, code);
      }
      if (local?.messageId) {
        await this.redisService.del(`pending:tx:msg:${local.messageId}`);
      }
    }
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
   * Số tim cần để duyệt theo `confirmationRules` của kênh đã lưu (nhóm mặc định 5).
   * Chỉ đọc config sẵn có: chat chưa có config (vd. webhook chính thức) dùng 1 tim.
   */
  private async resolveRequiredHearts(chatId: string): Promise<number> {
    if (!this.threadConfigService) return 1;
    try {
      const config = await this.threadConfigService.findStoredConfig(chatId);
      const hearts = Math.floor(Number(config?.confirmationRules?.requiredHearts));
      return Number.isFinite(hearts) && hearts >= 1 ? hearts : 1;
    } catch (err: unknown) {
      this.logger.warn(
        `Không đọc được confirmationRules của kênh ${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }
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
    requiredHearts?: number;
    messageId?: string;
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
      messageId: params.messageId,
      requiredHearts: params.requiredHearts ?? (await this.resolveRequiredHearts(params.chatId)),
      heartUsers: [],
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
        messageId: pending.messageId,
        cliMsgId: pending.cliMsgId,
        requiredHearts: pending.requiredHearts,
        heartUsers: pending.heartUsers,
      });
      await this.redisService.set(`pending:tx:code:${code}`, serialized, ttlSeconds);
      await this.redisService.set(`pending:tx:user:${params.userId}`, code, ttlSeconds);
      await this.addUserPendingCode(params.userId, code);
      if (params.messageId) {
        await this.redisService.set(`pending:tx:msg:${params.messageId}`, code, ttlSeconds);
      }
    }

    // Thiết lập timer thông báo hết hạn sau 5 phút
    pending.timer = setTimeout(async () => {
      await this.handleTimeout(code);
    }, this.timeoutMs);
    if (typeof pending.timer?.unref === 'function') {
      pending.timer.unref();
    }

    this.pendingMap.set(code, pending);

    const cardContent = renderDtoConfirmationCard(params.payload, params.descriptor);
    const reqHearts = pending.requiredHearts || 1;
    const heartPrompt = reqHearts > 1 ? `Thả tim (❤️) ${reqHearts} lần` : `Thả tim (❤️)`;

    const msg =
      `⏳ Xác nhận ${params.title.toLowerCase()}?\n\n` +
      cardContent +
      `\n\n👉 ${heartPrompt} hoặc soạn: yes ${code} (để xác nhận)` +
      `\n👉 Thả phẫn nộ (😡) hoặc soạn: cancel ${code} (để hủy bỏ)` +
      `\n👉 Soạn: edit ${code} <nội dung sửa> (để điều chỉnh)` +
      `\n⏱️ Tự động hết hạn sau 5 phút.`;

    if (this.zaloService.sendMessageWithResult) {
      const sendResult = await this.zaloService.sendMessageWithResult(params.chatId, msg);
      if (sendResult?.msgId) {
        pending.messageId = sendResult.msgId;
        if (sendResult.cliMsgId) {
          pending.cliMsgId = sendResult.cliMsgId;
        }
        await this.setMessageId(code, sendResult.msgId, sendResult.cliMsgId);
      }
    } else {
      await this.zaloService.sendMessage(params.chatId, msg);
    }
    return pending;
  }

  public async setMessageId(code: string, messageId: string, cliMsgId?: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (pending) {
      pending.messageId = messageId;
      if (cliMsgId) {
        pending.cliMsgId = cliMsgId;
      }
      this.pendingMap.set(code, pending);
      if (this.redisService) {
        const ttlSeconds = Math.ceil(this.timeoutMs / 1000);
        await this.redisService.set(`pending:tx:code:${code}`, JSON.stringify(pending), ttlSeconds);
        await this.redisService.set(`pending:tx:msg:${messageId}`, code, ttlSeconds);
      }
      await this.addTempMessage(pending.chatId, messageId, cliMsgId, code);
    }
  }

  public async addTempMessage(
    chatId: string,
    msgId: string,
    cliMsgId?: string,
    code?: string,
  ): Promise<void> {
    if (!msgId) return;
    const item = {
      msgId: String(msgId),
      cliMsgId: cliMsgId ? String(cliMsgId) : undefined,
      chatId: String(chatId),
    };

    if (code) {
      const codeKey = `pending:tx:temp:${code}`;
      if (this.redisService) {
        try {
          const raw = await this.redisService.get(codeKey);
          const list: { msgId: string; cliMsgId?: string; chatId: string }[] = raw
            ? (JSON.parse(raw) as { msgId: string; cliMsgId?: string; chatId: string }[])
            : [];
          if (!list.some((m) => m.msgId === item.msgId)) {
            list.push(item);
            await this.redisService.set(codeKey, JSON.stringify(list), 3600);
          }
        } catch {
          // ignore
        }
      }
      const existing = this.tempMessagesMap.get(codeKey) || [];
      if (!existing.some((m) => m.msgId === item.msgId)) {
        existing.push(item);
        this.tempMessagesMap.set(codeKey, existing);
      }
    } else {
      const chatKey = `pending:tx:chat-temp:${chatId}`;
      if (this.redisService) {
        try {
          const raw = await this.redisService.get(chatKey);
          const list: { msgId: string; cliMsgId?: string; chatId: string }[] = raw
            ? (JSON.parse(raw) as { msgId: string; cliMsgId?: string; chatId: string }[])
            : [];
          if (!list.some((m) => m.msgId === item.msgId)) {
            list.push(item);
            await this.redisService.set(chatKey, JSON.stringify(list), 3600);
          }
        } catch {
          // ignore
        }
      }
      const existingChat = this.tempMessagesMap.get(chatKey) || [];
      if (!existingChat.some((m) => m.msgId === item.msgId)) {
        existingChat.push(item);
        this.tempMessagesMap.set(chatKey, existingChat);
      }
    }
  }

  public async recallTempMessages(chatId: string, code?: string): Promise<void> {
    const toRecall: { msgId: string; cliMsgId?: string; chatId: string }[] = [];

    if (code) {
      const codeKey = `pending:tx:temp:${code}`;
      let fromRedis: { msgId: string; cliMsgId?: string; chatId: string }[] = [];
      if (this.redisService) {
        try {
          const raw = await this.redisService.get(codeKey);
          if (raw)
            fromRedis = JSON.parse(raw) as {
              msgId: string;
              cliMsgId?: string;
              chatId: string;
            }[];
          await this.redisService.del(codeKey);
        } catch {
          // ignore
        }
      }
      const fromMem = this.tempMessagesMap.get(codeKey) || [];
      this.tempMessagesMap.delete(codeKey);
      for (const m of [...fromRedis, ...fromMem]) {
        if (!toRecall.some((x) => x.msgId === m.msgId)) {
          toRecall.push(m);
        }
      }
    }

    const chatKey = `pending:tx:chat-temp:${chatId}`;
    let fromChatRedis: { msgId: string; cliMsgId?: string; chatId: string }[] = [];
    if (this.redisService) {
      try {
        const raw = await this.redisService.get(chatKey);
        if (raw)
          fromChatRedis = JSON.parse(raw) as {
            msgId: string;
            cliMsgId?: string;
            chatId: string;
          }[];
        await this.redisService.del(chatKey);
      } catch {
        // ignore
      }
    }
    const fromChatMem = this.tempMessagesMap.get(chatKey) || [];
    this.tempMessagesMap.delete(chatKey);
    for (const m of [...fromChatRedis, ...fromChatMem]) {
      if (!toRecall.some((x) => x.msgId === m.msgId)) {
        toRecall.push(m);
      }
    }

    if (toRecall.length > 0 && this.zaloService.undoMessage) {
      await Promise.allSettled(
        toRecall.map((item) =>
          this.zaloService.undoMessage(item.chatId || chatId, item.msgId, item.cliMsgId),
        ),
      );
    }
  }

  public async handleReaction(params: {
    chatId: string;
    userId: string;
    reactionIcon: string;
    msgId?: string;
    cliMsgId?: string;
  }): Promise<{
    handled: boolean;
    status?: 'confirmed' | 'cancelled' | 'heart_added';
    currentHearts?: number;
    requiredHearts?: number;
    code?: string;
  }> {
    let pending: PendingAction | undefined;

    if (params.msgId) {
      if (this.redisService) {
        const code = await this.redisService.get(`pending:tx:msg:${params.msgId}`);
        if (code) {
          pending = await this.getPendingByCode(code);
        }
      }
      if (!pending) {
        pending = Array.from(this.pendingMap.values()).find(
          (p) => p.chatId === params.chatId && p.messageId === params.msgId,
        );
      }
    }

    if (!pending) {
      // Fallback 1: pending gần nhất trong chatId từ memory
      const list = Array.from(this.pendingMap.values()).filter((p) => p.chatId === params.chatId);
      pending = list[list.length - 1];
    }

    if (!pending && this.redisService) {
      // Fallback 2: pending gần nhất của user từ Redis nếu memory trống
      const userPending = await this.getPendingForUser(params.userId);
      if (userPending && userPending.chatId === params.chatId) {
        pending = userPending;
      }
    }

    if (!pending) {
      return { handled: false };
    }

    if (params.cliMsgId && pending.cliMsgId !== params.cliMsgId) {
      pending.cliMsgId = params.cliMsgId;
      this.pendingMap.set(pending.code, pending);
      if (this.redisService) {
        const ttlSeconds = Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1000));
        void this.redisService.set(
          `pending:tx:code:${pending.code}`,
          JSON.stringify(pending),
          ttlSeconds,
        );
      }
      if (params.msgId) {
        void this.addTempMessage(params.chatId, params.msgId, params.cliMsgId, pending.code);
      }
    }

    // 1. Phẫn nộ (Angry) -> Hủy bỏ
    if (
      params.reactionIcon === ':-h' ||
      params.reactionIcon === 'ANGRY' ||
      params.reactionIcon === '😡'
    ) {
      await this.processCancel(params.userId, params.chatId, pending.code);
      return { handled: true, status: 'cancelled', code: pending.code };
    }

    // 2. Thả tim (Heart) -> Đếm tim hoặc Duyệt
    if (
      params.reactionIcon === '/-heart' ||
      params.reactionIcon === 'HEART' ||
      params.reactionIcon === '❤️'
    ) {
      if (!pending.heartUsers) {
        pending.heartUsers = [];
      }
      if (!pending.heartUsers.includes(params.userId)) {
        pending.heartUsers.push(params.userId);
        if (this.redisService) {
          const ttlSeconds = Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1000));
          await this.redisService.set(
            `pending:tx:code:${pending.code}`,
            JSON.stringify(pending),
            ttlSeconds,
          );
        }
      }

      const req = pending.requiredHearts || 1;
      if (pending.heartUsers.length >= req) {
        await this.processConfirm(pending.userId, params.chatId, pending.code, false, {
          isHeartConfirmed: true,
          requiredHearts: req,
        });
        return {
          handled: true,
          status: 'confirmed',
          currentHearts: pending.heartUsers.length,
          requiredHearts: req,
          code: pending.code,
        };
      }

      const heartNotice = `❤️ Đã nhận ${pending.heartUsers.length}/${req} lượt thả tim để duyệt yêu cầu [${pending.code}]!`;
      if (this.zaloService.sendMessageWithResult) {
        const sendRes = await this.zaloService.sendMessageWithResult(params.chatId, heartNotice);
        if (sendRes?.msgId) {
          await this.addTempMessage(params.chatId, sendRes.msgId, sendRes.cliMsgId);
        }
      } else {
        await this.zaloService.sendMessage(params.chatId, heartNotice);
      }
      return {
        handled: true,
        status: 'heart_added',
        currentHearts: pending.heartUsers.length,
        requiredHearts: req,
        code: pending.code,
      };
    }

    return { handled: false };
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

  /**
   * Tạo yêu cầu xác nhận tạo nơi chốn mới.
   */
  public async createPendingPlace(params: {
    userId: string;
    chatId: string;
    payload: CreatePlaceDto;
    rawPrompt?: string;
  }): Promise<PendingAction> {
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'CREATE_PLACE',
      title: `tạo nơi chốn "${params.payload.name}"`,
      payload: params.payload,
      descriptor: PLACE_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  public async handleTimeout(code: string): Promise<void> {
    const pending = await this.getPendingByCode(code);
    if (!pending) return;

    await this.recallTempMessages(pending.chatId, pending.code);
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
    } else if (pending.actionType === 'CREATE_PLACE') {
      const placeName = typeof payload.name === 'string' ? payload.name : '';
      title = `Yêu cầu tạo nơi chốn "${placeName}"`;
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
    canEdit?: (pending: PendingAction) => Promise<boolean>,
  ): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // 1. Khớp xác nhận tất cả: yes all, ok all, y all, xác nhận tất cả, xac nhan tat ca, xác nhận hết, đồng ý tất cả
    const confirmAllMatch = trimmed.match(
      /^(?:yes|y|ok|xác\s*nhận|xac\s*nhan|đồng\s*ý|dong\s*y)\s+(?:all|tất\s*cả|tat\s*ca|hết|het)$/i,
    );
    if (confirmAllMatch) {
      return this.processConfirmAll(userId, chatId);
    }

    // 2. Khớp hủy tất cả: cancel all, no all, hủy tất cả, huỷ tất cả, huy tat ca, bỏ qua tất cả
    const cancelAllMatch = trimmed.match(
      /^(?:cancel|no|hủy|huỷ|huy|bỏ\s*qua|bo\s*qua)\s+(?:all|tất\s*cả|tat\s*ca|hết|het)$/i,
    );
    if (cancelAllMatch) {
      return this.processCancelAll(userId, chatId);
    }

    // 3. Khớp xác nhận: yes, y, ok, xác nhận, xac nhan (+ mã tùy chọn)
    const confirmMatch = trimmed.match(
      /^(?:yes|y|ok|xác\s*nhận|xac\s*nhan)(?:\s+([a-zA-Z0-9]{3,6}))?$/i,
    );
    if (confirmMatch) {
      const code = confirmMatch[1];
      return this.processConfirm(userId, chatId, code);
    }

    // 4. Khớp hủy: cancel, no, hủy, huỷ, huy (+ mã tùy chọn)
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

      const handled = await this.processEdit(userId, chatId, code, instruction, onEdit, canEdit);
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
    canEdit?: (pending: PendingAction) => Promise<boolean>,
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

    // Checked before any recall/delete so an unauthorized sender cannot destroy someone else's card.
    if (canEdit && !(await canEdit(pending))) {
      this.logger.debug(
        `Edit of pending "${pending.code}" by ${userId} in ${chatId} rejected silently (no access).`,
      );
      return true;
    }

    if (Date.now() > pending.expiresAt) {
      await this.deletePending(pending.code, pending.userId);
      await this.zaloService.sendMessage(
        chatId,
        `⏰ Yêu cầu mã "${pending.code}" đã hết hạn xác nhận (quá 5 phút) và chưa được thực hiện.`,
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

    if (!onEdit) {
      await this.zaloService.sendMessage(
        chatId,
        `⚠️ Hệ thống hiện chưa hỗ trợ tự động điều chỉnh cho yêu cầu mã "${pending.code}". Bạn có thể soạn: yes ${pending.code} (để xác nhận) hoặc: cancel ${pending.code} (để hủy bỏ và tạo lại).`,
      );
      return true;
    }

    try {
      await this.recallTempMessages(chatId, pending.code);
      await onEdit(pending, trimmedInstruction);
      await this.deletePending(pending.code, pending.userId);
    } catch (err) {
      this.logger.error(`Lỗi khi xử lý edit pending action: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        chatId,
        `⚠️ Có lỗi xảy ra khi xử lý điều chỉnh yêu cầu: ${(err as Error).message}`,
      );
    }
    return true;
  }

  public async processConfirmAll(userId: string, chatId: string): Promise<boolean> {
    const list = await this.getPendingListForUser(userId);
    if (list.length === 0) {
      await this.zaloService.sendMessage(chatId, 'ℹ️ Không có yêu cầu nào đang chờ xác nhận.');
      return true;
    }

    let successCount = 0;
    for (const pending of list) {
      const ok = await this.processConfirm(userId, chatId, pending.code, true);
      if (ok) successCount++;
    }

    await this.recallTempMessages(chatId);

    await this.zaloService.sendMessage(
      chatId,
      `🎉 Đã xác nhận thành công tất cả (${successCount}/${list.length}) yêu cầu!`,
    );
    return true;
  }

  public async processCancelAll(userId: string, chatId: string): Promise<boolean> {
    const list = await this.getPendingListForUser(userId);
    if (list.length === 0) {
      await this.zaloService.sendMessage(
        chatId,
        'ℹ️ Không có yêu cầu nào đang chờ xác nhận để hủy.',
      );
      return true;
    }

    for (const pending of list) {
      await this.recallTempMessages(chatId, pending.code);
      await this.deletePending(pending.code, pending.userId);
    }

    await this.recallTempMessages(chatId);

    await this.zaloService.sendMessage(
      chatId,
      `🚫 Đã hủy tất cả (${list.length}) yêu cầu chờ xác nhận của bạn.`,
    );
    return true;
  }

  private async processConfirm(
    userId: string,
    chatId: string,
    code?: string,
    silent = false,
    options?: {
      isHeartConfirmed?: boolean;
      requiredHearts?: number;
    },
  ): Promise<boolean> {
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        if (!silent) {
          await this.zaloService.sendMessage(
            chatId,
            `⚠️ Không tìm thấy yêu cầu chờ xác nhận với mã "${code}". Vui lòng kiểm tra lại.`,
          );
        }
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        if (!silent) {
          await this.zaloService.sendMessage(
            chatId,
            `⚠️ Bạn không có quyền xác nhận yêu cầu mã "${code}".`,
          );
        }
        return true;
      }
    } else {
      const pendingList = await this.getPendingListForUser(userId);
      if (pendingList.length === 0) {
        return false;
      }
      pending = pendingList[0];
    }

    if (Date.now() > pending.expiresAt) {
      await this.deletePending(pending.code, pending.userId);
      await this.recallTempMessages(chatId, pending.code);
      await this.zaloService.sendMessage(
        chatId,
        `⏰ Yêu cầu mã "${pending.code}" đã hết hạn xác nhận (quá 5 phút) và chưa được thực hiện.`,
      );
      return true;
    }

    await this.deletePending(pending.code, pending.userId);
    await this.recallTempMessages(chatId, pending.code);

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

          if (payload.placeName) {
            const companionPending = Array.from(this.pendingMap.values()).find(
              (p) =>
                p.actionType === 'CREATE_PLACE' &&
                p.userId === pending.userId &&
                normalizePlaceName((p.payload?.name as string) || '') ===
                  normalizePlaceName(payload.placeName),
            );
            if (companionPending) {
              await this.recallTempMessages(companionPending.chatId, companionPending.code);
              await this.deletePending(companionPending.code, companionPending.userId);
            }
          }

          if (!silent) {
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n`;
            const reply = `${header}${cardContent}`;
            await this.zaloService.sendMessage(chatId, reply);
          }
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
            if (!silent) {
              const typeLabel = payload.type === 'income' ? 'khoản thu' : 'khoản chi';
              const cardContent = renderDtoConfirmationCard(payload, DELETE_TRANSACTION_DESCRIPTOR);
              const header = options?.isHeartConfirmed
                ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
                : `🗑️ Đã xóa ${typeLabel} thành công!\n\n`;
              await this.zaloService.sendMessage(chatId, `${header}${cardContent}`);
            }
          } else {
            if (!silent) {
              await this.zaloService.sendMessage(
                chatId,
                `⚠️ Không tìm thấy giao dịch hoặc bạn không có quyền xóa giao dịch này.`,
              );
            }
          }
          break;
        }
        case 'MANAGE_DEBT': {
          const payload = pending.payload as unknown as CreateDebtDto;
          const debt = await this.financeService.createDebt(payload);
          if (!silent) {
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
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `✅ Đã xác nhận và ghi nhận khoản nợ thành công!\n\n`;
            await this.zaloService.sendMessage(chatId, `${header}${cardContent}`);
          }
          break;
        }
        case 'SET_REMINDER': {
          if (!this.remindersService) {
            throw new Error('RemindersService chưa được cấu hình.');
          }
          const payload = parseReminderPayload(pending.payload);
          const reminder = await this.remindersService.createReminder(payload);
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(
              {
                ...payload,
                title: reminder?.title ?? payload.title,
                remindAt: reminder?.remindAt ?? payload.remindAt,
              },
              REMINDER_DESCRIPTOR,
            );
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `⏰ Đã xác nhận và đặt lịch nhắc thành công!\n\n`;
            await this.zaloService.sendMessage(chatId, `${header}${cardContent}`);
          }
          break;
        }
        case 'CREATE_TASK': {
          if (!this.googleTasksService) {
            throw new Error('GoogleTasksService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CreateTaskOptions;
          const task = await this.googleTasksService.createTask(payload, pending.userId);
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(
              {
                ...payload,
                title: task?.title ?? payload.title,
              },
              TASK_DESCRIPTOR,
            );
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `✅ ĐÃ XÁC NHẬN VÀ THÊM VIỆC CẦN LÀM VÀO GOOGLE TASKS!\n\n`;
            const reply =
              `${header}${cardContent}` + `\n\n💡 Gõ /tasks để xem toàn bộ danh sách việc cần làm.`;
            await this.zaloService.sendMessage(chatId, reply);
          }
          break;
        }
        case 'COMPLETE_TASK': {
          if (!this.googleTasksService) {
            throw new Error('GoogleTasksService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CompleteTaskDto;
          await this.googleTasksService.completeTask(payload.taskId, '@default', pending.userId);
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(payload, COMPLETE_TASK_DESCRIPTOR);
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `🎉 ĐÃ XÁC NHẬN VÀ HOÀN THÀNH CÔNG VIỆC TRÊN GOOGLE TASKS!\n\n`;
            const reply =
              `${header}${cardContent}` + `\n\n💡 Gõ /tasks để xem danh sách việc cần làm còn lại.`;
            await this.zaloService.sendMessage(chatId, reply);
          }
          break;
        }
        case 'CREATE_CALENDAR_EVENT': {
          if (!this.googleCalendarService) {
            throw new Error('GoogleCalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CreateEventOptions;
          await this.googleCalendarService.createEvent(payload, pending.userId);
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(payload, CALENDAR_EVENT_DESCRIPTOR);
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `✅ ĐÃ XÁC NHẬN VÀ TẠO SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n`;
            const reply =
              `${header}${cardContent}` +
              `\n\n🔗 Sự kiện đã được đồng bộ lên Google Calendar của bạn.`;
            await this.zaloService.sendMessage(chatId, reply);
          }
          break;
        }
        case 'DELETE_CALENDAR_EVENT': {
          if (!this.googleCalendarService) {
            throw new Error('GoogleCalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as DeleteCalendarEventDto;
          await this.googleCalendarService.deleteEvent(payload.eventId, pending.userId);
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(
              payload,
              DELETE_CALENDAR_EVENT_DESCRIPTOR,
            );
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `🗑️ ĐÃ XÁC NHẬN VÀ XÓA SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n`;
            const reply = `${header}${cardContent}`;
            await this.zaloService.sendMessage(chatId, reply);
          }
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
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(payload, BAN_USER_DESCRIPTOR);
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `⛔ ĐÃ XÁC NHẬN VÀ KHÓA TÀI KHOẢN NGƯỜI DÙNG THÀNH CÔNG!\n\n`;
            const reply =
              `${header}${cardContent}` +
              `\n\nToàn bộ quyền truy cập và Token Google của tài khoản đã bị thu hồi.`;
            await this.zaloService.sendMessage(chatId, reply);
          }
          break;
        }
        case 'CREATE_PLACE': {
          const payload = pending.payload as unknown as CreatePlaceDto;
          const place = await this.financeService.resolveOrCreatePlace(
            pending.userId,
            payload.name,
          );
          if (!silent) {
            const cardContent = renderDtoConfirmationCard(
              {
                userId: pending.userId,
                name: place?.name || payload.name,
              },
              PLACE_DESCRIPTOR,
            );
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
              : `✅ Đã xác nhận và tạo nơi chốn "${place?.name || payload.name}" thành công!\n\n`;
            const reply = `${header}${cardContent}`;
            const remainingList = await this.getPendingListForUser(userId);
            if (this.zaloService.sendMessageWithResult) {
              const sendRes = await this.zaloService.sendMessageWithResult(chatId, reply);
              if (remainingList.length > 0 && sendRes?.msgId) {
                await this.addTempMessage(chatId, sendRes.msgId, sendRes.cliMsgId);
              }
            } else {
              await this.zaloService.sendMessage(chatId, reply);
            }
          }
          break;
        }
        default: {
          const payload = pending.payload as unknown as CreateFinanceTransactionDto;
          await this.financeService.createTransaction(payload);
          if (!silent) {
            const header = options?.isHeartConfirmed
              ? `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!`
              : `✅ Đã xác nhận thao tác thành công!`;
            await this.zaloService.sendMessage(chatId, header);
          }
          break;
        }
      }

      if (!silent) {
        const remainingList = await this.getPendingListForUser(userId);
        if (remainingList.length > 0) {
          const notice = `💡 Bạn còn ${remainingList.length} yêu cầu chờ xác nhận. Soạn "yes all" để duyệt tất cả hoặc "yes <mã>".`;
          if (this.zaloService.sendMessageWithResult) {
            const res = await this.zaloService.sendMessageWithResult(chatId, notice);
            if (res?.msgId) {
              await this.addTempMessage(chatId, res.msgId, res.cliMsgId);
            }
          } else {
            await this.zaloService.sendMessage(chatId, notice);
          }
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
    await this.recallTempMessages(chatId, pending.code);

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
    } else if (pending.actionType === 'CREATE_PLACE') {
      const placeName = typeof payload.name === 'string' ? payload.name : '';
      actionDesc = `tạo nơi chốn "${placeName}"`;
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

    if (!code) {
      const remainingList = await this.getPendingListForUser(userId);
      if (remainingList.length > 0) {
        const notice = `💡 Bạn còn ${remainingList.length} yêu cầu chờ xác nhận. Soạn "cancel all" để hủy tất cả hoặc "cancel <mã>".`;
        if (this.zaloService.sendMessageWithResult) {
          const res = await this.zaloService.sendMessageWithResult(chatId, notice);
          if (res?.msgId) {
            await this.addTempMessage(chatId, res.msgId, res.cliMsgId);
          }
        } else {
          await this.zaloService.sendMessage(chatId, notice);
        }
      }
    }
    return true;
  }
}

import { Injectable, Logger, OnModuleDestroy, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../zca.service';
import {
  sendChatText,
  sendChatTextWithResult,
  undoChatMessage,
  type ChatMessenger,
} from '../chat-messenger.util';
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
import { isReminderTargetMode, parseTargetUsers } from '../../reminders/reminder-target';
import { REMINDER_REPEAT_TYPES, REMINDER_TARGET_MODES } from '@zalobot/contracts';
import {
  type RequestedReminderTime,
  revivePayloadTimes,
  withUpcomingRepeats,
} from '../../reminders/reminder-times';
import { CreateTaskOptions } from '../../tasks/task.types';
import { TasksService } from '../../tasks/tasks.service';
import { CreateEventOptions } from '../../google/google-calendar.service';
import { CalendarService } from '../../calendar/calendar.service';
import { UsersService } from '../../users/users.service';
import { GoogleAuthService } from '../../google/google-auth.service';
import { RedisService } from '../../redis/redis.service';
import { AuditContext, zaloAuditContext } from '../../audit/audit-context';
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
import {
  summarizeBannedUser,
  summarizeCalendarEvent,
  summarizeCompletedTask,
  summarizeDebt,
  summarizeDeletedCalendarEvent,
  summarizeDeletedTransaction,
  summarizeGeneric,
  summarizePlace,
  summarizeReminder,
  summarizeTask,
  summarizeTransaction,
} from './compact-summary.util';

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

/** Re-issues an edited pending action; `true` once its new card is out. */
export type PendingEditHandler = (pending: PendingAction, instruction: string) => Promise<boolean>;

export function normalizePlaceName(val: string): string {
  return (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Longer subjects are cut in the cancel/timeout notices; the card already showed them in full. */
const SUBJECT_MAX_LENGTH = 60;

function payloadText(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * What a pending action does, in the words of its card header and notices ("thêm việc").
 * Derived from the action type, not the stored title, so cards saved by an older build read the same.
 * `transactionType` is the payload's `type` (income/expense) for transaction actions.
 */
export function pendingActionLabel(
  actionType: PendingActionType,
  transactionType?: unknown,
): string {
  const kind = transactionType === 'income' ? 'khoản thu' : 'khoản chi';
  switch (actionType) {
    case 'RECORD_TRANSACTION':
    case 'create':
      return `lưu ${kind}`;
    case 'DELETE_TRANSACTION':
    case 'delete':
      return `xoá ${kind}`;
    case 'MANAGE_DEBT':
      return 'ghi công nợ';
    case 'SET_REMINDER':
      return 'đặt lời nhắc';
    case 'CREATE_TASK':
      return 'thêm việc';
    case 'COMPLETE_TASK':
      return 'đánh dấu xong việc';
    case 'CREATE_CALENDAR_EVENT':
      return 'thêm lịch';
    case 'DELETE_CALENDAR_EVENT':
      return 'xoá lịch';
    case 'BAN_USER':
      return 'khoá tài khoản';
    case 'CREATE_PLACE':
      return 'tạo nơi chốn';
  }
}

function pendingSubject(pending: Pick<PendingAction, 'actionType' | 'payload'>): string {
  const { payload } = pending;
  switch (pending.actionType) {
    case 'COMPLETE_TASK':
      return payloadText(payload, 'taskTitle');
    case 'BAN_USER':
      return payloadText(payload, 'targetName') || payloadText(payload, 'targetUserId');
    case 'CREATE_PLACE':
      return payloadText(payload, 'name');
    default:
      return (
        payloadText(payload, 'note') ||
        payloadText(payload, 'title') ||
        payloadText(payload, 'summary')
      );
  }
}

/** The action and its subject for the cancel and timeout notices: `thêm việc "Mua hoa…"`. */
export function describePendingAction(
  pending: Pick<PendingAction, 'actionType' | 'payload'>,
): string {
  const label = pendingActionLabel(pending.actionType, pending.payload.type);
  const subject = pendingSubject(pending);
  if (!subject) return label;
  const short =
    subject.length > SUBJECT_MAX_LENGTH
      ? `${subject.slice(0, SUBJECT_MAX_LENGTH).trimEnd()}…`
      : subject;
  return `${label} "${short}"`;
}

function expiredNotice(pending: Pick<PendingAction, 'code' | 'actionType' | 'payload'>): string {
  return `[${pending.code}] Hết hạn, chưa lưu: ${describePendingAction(pending)}`;
}

/** A task due date from an LLM payload; unparseable values mean "no due date". */
function toValidTaskDue(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Task reminder times from an LLM payload, each with its repeat. The card may have waited
 * minutes for approval: a repeating time passed meanwhile starts at its next occurrence, other
 * past or unparseable times are dropped rather than failing the whole task.
 */
export function toValidRemindTimes(
  remindTimes: unknown,
  remindAt: unknown,
  now: Date = new Date(),
): RequestedReminderTime[] {
  return withUpcomingRepeats(revivePayloadTimes(remindTimes, remindAt), now).filter(
    (time) => time.at.getTime() > now.getTime(),
  );
}

/** "Remind again" of a payload: both whole numbers, or neither. */
export function payloadNagRule(payload: { nagEveryMinutes?: unknown; nagCount?: unknown }): {
  nagEveryMinutes?: number;
  nagCount?: number;
} {
  const { nagEveryMinutes: every, nagCount: count } = payload;
  return Number.isInteger(every) && Number.isInteger(count)
    ? { nagEveryMinutes: Number(every), nagCount: Number(count) }
    : {};
}

const REMINDER_NOTIFY_TYPES = ['text', 'call'] as const;
const REMINDER_STATUSES = ['pending', 'completed', 'snoozed', 'cancelled'] as const;

function pickOption<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value);
}

/**
 * Rebuilds a CreateReminderDto from a pending payload. Payloads read back from Redis are
 * plain JSON, so `remindAt` arrives as an ISO string and must be revived into a Date.
 */
export function parseReminderPayload(
  payload: Record<string, unknown>,
  now: Date = new Date(),
): CreateReminderDto {
  const { userId, title } = payload;
  if (typeof userId !== 'string' && typeof userId !== 'number') {
    throw new Error('Thiếu người dùng cho lịch nhắc.');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Thiếu nội dung lịch nhắc.');
  }
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
  // Past one-off times are kept: they go out on the next tick, as a reminder always did. A
  // repeating time passed meanwhile starts at its next occurrence instead (not sent late).
  const remindTimes = withUpcomingRepeats(
    revivePayloadTimes(payload.remindTimes, payload.remindAt),
    now,
  );
  if (remindTimes.length === 0) remindTimes.push({ at: toValidReminderDate(payload.remindAt) });
  return {
    userId,
    title,
    remindAt: remindTimes[0].at,
    remindTimes,
    notifyType: pickOption(payload.notifyType, REMINDER_NOTIFY_TYPES),
    // Older pending payloads carry one repeat for the whole reminder.
    repeatType: pickOption(payload.repeatType, REMINDER_REPEAT_TYPES),
    ...payloadNagRule(payload),
    status: pickOption(payload.status, REMINDER_STATUSES),
    chatId: text(payload.chatId),
    remindUsers: parseTargetUsers(payload.remindUsers),
    remindMode: pickOption(payload.remindMode, REMINDER_TARGET_MODES),
    originChatId: text(payload.originChatId),
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

  private readonly zcaMessenger: {
    sendMessage(chatId: string | number, text: string): Promise<unknown>;
    sendMessageWithResult?(
      chatId: string | number,
      text: string,
    ): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }>;
    undoMessage?(chatId: string | number, msgId: string, cliMsgId?: string): Promise<boolean>;
  };

  constructor(
    @Inject(forwardRef(() => ZcaService))
    rawMessenger: ChatMessenger | undefined,
    private readonly financeService: FinanceService,
    @Optional() private readonly remindersService?: RemindersService,
    @Optional() private readonly tasksService?: TasksService,
    @Optional() private readonly calendarService?: CalendarService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly googleAuthService?: GoogleAuthService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
  ) {
    // ZcaService in the app; ZcaMessengerService or a test double elsewhere.
    this.zcaMessenger = {
      sendMessage: (chatId, text) => sendChatText(rawMessenger, chatId, text),
      sendMessageWithResult: (chatId, text) => sendChatTextWithResult(rawMessenger, chatId, text),
      undoMessage: (chatId, msgId, cliMsgId) =>
        undoChatMessage(rawMessenger, chatId, msgId, cliMsgId),
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
   * Chỉ đọc config sẵn có: chat chưa có config dùng 1 tim.
   */
  private async resolveRequiredHearts(chatId: string): Promise<number> {
    if (!this.threadConfigService) return 1;
    try {
      const config = await this.threadConfigService.findStoredConfig(chatId);
      const hearts = Math.floor(Number(config?.confirmationRules?.requiredHearts));
      return Number.isFinite(hearts) && hearts >= 1 ? hearts : 1;
    } catch (err: unknown) {
      this.logger.warn(
        `Không đọc được confirmationRules của kênh ${chatId}: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
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
    const heart = reqHearts > 1 ? `❤️ x${reqHearts}` : '❤️';
    const header = params.title.charAt(0).toLocaleUpperCase('vi') + params.title.slice(1);

    // ❤️ and 😡 stay: they are the reactions to tap, not decoration.
    const msg = [
      `${header} [${code}]?`,
      cardContent,
      `${heart} hoặc yes ${code}: duyệt · 😡 hoặc cancel ${code}: huỷ`,
      `edit ${code} <nội dung>: sửa · tự huỷ sau 5 phút`,
    ]
      .filter(Boolean)
      .join('\n');

    if (this.zcaMessenger.sendMessageWithResult) {
      const sendResult = await this.zcaMessenger.sendMessageWithResult(params.chatId, msg);
      if (sendResult?.msgId) {
        pending.messageId = sendResult.msgId;
        if (sendResult.cliMsgId) {
          pending.cliMsgId = sendResult.cliMsgId;
        }
        await this.setMessageId(code, sendResult.msgId, sendResult.cliMsgId);
      }
    } else {
      await this.zcaMessenger.sendMessage(params.chatId, msg);
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

    if (toRecall.length > 0 && this.zcaMessenger.undoMessage) {
      await Promise.allSettled(
        toRecall.map((item) =>
          this.zcaMessenger.undoMessage(item.chatId || chatId, item.msgId, item.cliMsgId),
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
    // Only a reaction placed on the pending card itself counts. Falling back to "latest pending in
    // the chat" let a heart on any message (e.g. a previous success notice) approve another request.
    let pending: PendingAction | undefined;

    if (params.msgId && this.redisService) {
      const code = await this.redisService.get(`pending:tx:msg:${params.msgId}`);
      if (code) {
        pending = await this.getPendingByCode(code);
      }
    }
    if (!pending && (params.msgId || params.cliMsgId)) {
      pending = Array.from(this.pendingMap.values()).find(
        (p) =>
          p.chatId === params.chatId &&
          ((params.msgId !== undefined && p.messageId === params.msgId) ||
            (params.cliMsgId !== undefined && p.cliMsgId === params.cliMsgId)),
      );
    }

    if (!pending || pending.chatId !== params.chatId || pending.expiresAt <= Date.now()) {
      this.logger.debug(
        `Reaction on non-pending message ignored (chat=${params.chatId}, msgId=${params.msgId || ''}, cliMsgId=${params.cliMsgId || ''})`,
      );
      return { handled: false };
    }

    // Cards sent through an API that returns no cliMsgId learn it from the first matching reaction.
    if (params.cliMsgId && !pending.cliMsgId) {
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

      const heartNotice = `❤️ ${pending.heartUsers.length}/${req} [${pending.code}]`;
      if (this.zcaMessenger.sendMessageWithResult) {
        const sendRes = await this.zcaMessenger.sendMessageWithResult(params.chatId, heartNotice);
        if (sendRes?.msgId) {
          await this.addTempMessage(params.chatId, sendRes.msgId, sendRes.cliMsgId);
        }
      } else {
        await this.zcaMessenger.sendMessage(params.chatId, heartNotice);
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
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'RECORD_TRANSACTION',
      title: pendingActionLabel('RECORD_TRANSACTION', params.payload.type),
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
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'DELETE_TRANSACTION',
      title: pendingActionLabel('DELETE_TRANSACTION', data.type),
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
    return this.createPendingAction({
      userId: params.userId,
      chatId: params.chatId,
      actionType: 'MANAGE_DEBT',
      title: pendingActionLabel('MANAGE_DEBT'),
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
      title: pendingActionLabel('SET_REMINDER'),
      payload: params.payload,
      descriptor: REMINDER_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận việc cần làm (lưu trong danh sách việc chung của zalobot).
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
      title: pendingActionLabel('CREATE_TASK'),
      payload: params.payload,
      descriptor: TASK_DESCRIPTOR,
      rawPrompt: params.rawPrompt,
    });
  }

  /**
   * Tạo yêu cầu xác nhận hoàn thành việc cần làm.
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
      title: pendingActionLabel('COMPLETE_TASK'),
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
      title: pendingActionLabel('CREATE_CALENDAR_EVENT'),
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
      title: pendingActionLabel('DELETE_CALENDAR_EVENT'),
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
      title: pendingActionLabel('BAN_USER'),
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
      title: pendingActionLabel('CREATE_PLACE'),
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

    await this.zcaMessenger.sendMessage(pending.chatId, expiredNotice(pending));
  }

  public async handleCommand(
    userId: string,
    chatId: string,
    text: string,
    onEdit?: PendingEditHandler,
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

  /** Re-issues a pending action from a follow-up message of its owner in its chat (no `edit` prefix). */
  public async amendPending(
    userId: string,
    chatId: string,
    code: string,
    instruction: string,
    onEdit: PendingEditHandler,
  ): Promise<boolean> {
    return this.processEdit(userId, chatId, code, instruction, onEdit, (pending) =>
      Promise.resolve(pending.userId === userId && pending.chatId === chatId),
    );
  }

  private async processEdit(
    userId: string,
    chatId: string,
    code?: string,
    instruction?: string,
    onEdit?: PendingEditHandler,
    canEdit?: (pending: PendingAction) => Promise<boolean>,
  ): Promise<boolean> {
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zcaMessenger.sendMessage(chatId, `⚠️ Không có yêu cầu [${code}] đang chờ.`);
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zcaMessenger.sendMessage(chatId, `⚠️ Bạn không sửa được yêu cầu [${code}].`);
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
      await this.zcaMessenger.sendMessage(chatId, expiredNotice(pending));
      return true;
    }

    const trimmedInstruction = instruction?.trim() || '';
    if (!trimmedInstruction) {
      await this.zcaMessenger.sendMessage(
        chatId,
        `Muốn sửa gì? Ví dụ: edit ${pending.code} đổi số tiền thành 60k`,
      );
      return true;
    }

    if (!onEdit) {
      await this.zcaMessenger.sendMessage(
        chatId,
        `⚠️ Yêu cầu [${pending.code}] chưa sửa tự động được. Gõ yes ${pending.code} để duyệt, hoặc cancel ${pending.code} rồi tạo lại.`,
      );
      return true;
    }

    try {
      // The old card goes only once the new one is out: a failed edit keeps it to approve.
      if (await onEdit(pending, trimmedInstruction)) {
        await this.recallTempMessages(chatId, pending.code);
        await this.deletePending(pending.code, pending.userId);
      }
    } catch (err) {
      this.logger.error(`Lỗi khi xử lý edit pending action: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        chatId,
        `⚠️ Chưa sửa được yêu cầu: ${(err as Error).message}`,
      );
    }
    return true;
  }

  public async processConfirmAll(userId: string, chatId: string): Promise<boolean> {
    const list = await this.getPendingListForUser(userId);
    if (list.length === 0) {
      await this.zcaMessenger.sendMessage(chatId, 'Không có yêu cầu nào đang chờ.');
      return true;
    }

    let successCount = 0;
    for (const pending of list) {
      const ok = await this.processConfirm(userId, chatId, pending.code, true);
      if (ok) successCount++;
    }

    await this.recallTempMessages(chatId);

    await this.zcaMessenger.sendMessage(
      chatId,
      `✅ Đã duyệt ${successCount}/${list.length} yêu cầu`,
    );
    return true;
  }

  public async processCancelAll(userId: string, chatId: string): Promise<boolean> {
    const list = await this.getPendingListForUser(userId);
    if (list.length === 0) {
      await this.zcaMessenger.sendMessage(chatId, 'Không có yêu cầu nào đang chờ.');
      return true;
    }

    for (const pending of list) {
      await this.recallTempMessages(chatId, pending.code);
      await this.deletePending(pending.code, pending.userId);
    }

    await this.recallTempMessages(chatId);

    await this.zcaMessenger.sendMessage(chatId, `Đã huỷ ${list.length} yêu cầu`);
    return true;
  }

  private async processConfirm(
    userId: string,
    chatId: string,
    code?: string,
    silent = false,
    // Heart vs text confirmation no longer changes the success message; kept for callers.
    _options?: {
      isHeartConfirmed?: boolean;
      requiredHearts?: number;
    },
  ): Promise<boolean> {
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        if (!silent) {
          await this.zcaMessenger.sendMessage(chatId, `⚠️ Không có yêu cầu [${code}] đang chờ.`);
        }
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        if (!silent) {
          await this.zcaMessenger.sendMessage(chatId, `⚠️ Bạn không duyệt được yêu cầu [${code}].`);
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
      await this.zcaMessenger.sendMessage(chatId, expiredNotice(pending));
      return true;
    }

    await this.deletePending(pending.code, pending.userId);
    await this.recallTempMessages(chatId, pending.code);

    // The writes belong to whoever asked for the action, not to whoever approved it. The pending
    // action does not store the requester's name, so the current sender's name is kept only
    // when the requester confirms their own action.
    const confirmed = pending;
    const current = AuditContext.current();
    const requesterName =
      current?.actorId === String(confirmed.userId) ? current.actorName : undefined;
    return AuditContext.run(
      zaloAuditContext(confirmed.userId, confirmed.chatId, requesterName),
      () => this.executeConfirmed(confirmed, userId, chatId, silent),
    );
  }

  private async executeConfirmed(
    pending: PendingAction,
    userId: string,
    chatId: string,
    silent: boolean,
  ): Promise<boolean> {
    try {
      switch (pending.actionType) {
        case 'RECORD_TRANSACTION':
        case 'create': {
          const payload = pending.payload as unknown as CreateFinanceTransactionDto;
          const tx = await this.financeService.createTransaction(payload);
          const summary = summarizeTransaction(pending.code, {
            ...payload,
            amount: tx?.amount ?? payload.amount,
            category: tx?.category ?? payload.category,
            note: tx?.note ?? payload.note,
            occurredAt: tx?.occurredAt
              ? tx.occurredAt instanceof Date
                ? tx.occurredAt.toISOString()
                : String(tx.occurredAt)
              : payload.occurredAt,
          });

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
            await this.zcaMessenger.sendMessage(chatId, summary);
          }
          break;
        }
        case 'DELETE_TRANSACTION':
        case 'delete': {
          const payload = (pending.payload ||
            pending.deletePayload) as unknown as DeleteTransactionDto;
          const success = await this.financeService.deleteTransaction(payload.transactionId);
          if (success) {
            if (!silent) {
              await this.zcaMessenger.sendMessage(
                chatId,
                summarizeDeletedTransaction(pending.code, payload),
              );
            }
          } else {
            if (!silent) {
              await this.zcaMessenger.sendMessage(
                chatId,
                `⚠️ Không tìm thấy giao dịch, hoặc bạn không có quyền xoá nó.`,
              );
            }
          }
          break;
        }
        case 'MANAGE_DEBT': {
          const payload = pending.payload as unknown as CreateDebtDto;
          const debt = await this.financeService.createDebt(payload);
          if (!silent) {
            const summary = summarizeDebt(pending.code, {
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
            });
            await this.zcaMessenger.sendMessage(chatId, summary);
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
            const summary = summarizeReminder(pending.code, {
              ...payload,
              title: reminder?.title ?? payload.title,
              remindAt: reminder?.remindAt ?? payload.remindAt,
            });
            await this.zcaMessenger.sendMessage(chatId, summary);
          }
          break;
        }
        case 'CREATE_TASK': {
          if (!this.tasksService) {
            throw new Error('TasksService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CreateTaskOptions;
          // Saved in the shared task list (zalobot only, no Google copy).
          const task = await this.tasksService.createTask(
            {
              title: payload.title,
              notes: payload.notes,
              dueAt: toValidTaskDue(payload.due),
              // Reminds in the chat the task was asked in (the actor's chatId).
              remindTimes: toValidRemindTimes(payload.remindTimes, payload.remindAt),
              ...payloadNagRule(payload),
              remindUsers: parseTargetUsers(payload.remindUsers),
              remindMode: isReminderTargetMode(payload.remindMode) ? payload.remindMode : undefined,
            },
            { userId: pending.userId, chatId: pending.chatId, source: 'zalo' },
          );
          if (!silent) {
            const summary = summarizeTask(pending.code, {
              ...payload,
              title: task?.title ?? payload.title,
            });
            await this.zcaMessenger.sendMessage(chatId, summary);
          }
          break;
        }
        case 'COMPLETE_TASK': {
          if (!this.tasksService) {
            throw new Error('TasksService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CompleteTaskDto;
          await this.tasksService.completeTask(payload.taskId);
          if (!silent) {
            await this.zcaMessenger.sendMessage(
              chatId,
              summarizeCompletedTask(pending.code, payload),
            );
          }
          break;
        }
        case 'CREATE_CALENDAR_EVENT': {
          if (!this.calendarService) {
            throw new Error('CalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as CreateEventOptions;
          // Saved in the shared calendar; copied to Google when an account is connected.
          await this.calendarService.createEvent(
            {
              title: payload.summary,
              description: payload.description,
              location: payload.location,
              startAt: new Date(payload.startDateTime),
              endAt: new Date(payload.endDateTime),
              timeZone: payload.timeZone,
              reminderMinutes: payload.reminderMinutes,
            },
            { userId: pending.userId, chatId: pending.chatId, source: 'zalo' },
          );
          if (!silent) {
            await this.zcaMessenger.sendMessage(
              chatId,
              summarizeCalendarEvent(pending.code, payload),
            );
          }
          break;
        }
        case 'DELETE_CALENDAR_EVENT': {
          if (!this.calendarService) {
            throw new Error('CalendarService chưa được cấu hình.');
          }
          const payload = pending.payload as unknown as DeleteCalendarEventDto;
          await this.calendarService.deleteEvent(payload.eventId, pending.userId);
          if (!silent) {
            await this.zcaMessenger.sendMessage(
              chatId,
              summarizeDeletedCalendarEvent(pending.code, payload),
            );
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
            await this.zcaMessenger.sendMessage(chatId, summarizeBannedUser(pending.code, payload));
          }
          break;
        }
        case 'CREATE_PLACE': {
          const payload = pending.payload as unknown as CreatePlaceDto;
          const place = await this.financeService.resolveOrCreatePlace(payload.name);
          if (!silent) {
            const reply = summarizePlace(pending.code, place?.name || payload.name);
            const remainingList = await this.getPendingListForUser(userId);
            if (this.zcaMessenger.sendMessageWithResult) {
              const sendRes = await this.zcaMessenger.sendMessageWithResult(chatId, reply);
              if (remainingList.length > 0 && sendRes?.msgId) {
                await this.addTempMessage(chatId, sendRes.msgId, sendRes.cliMsgId);
              }
            } else {
              await this.zcaMessenger.sendMessage(chatId, reply);
            }
          }
          break;
        }
        default: {
          const payload = pending.payload as unknown as CreateFinanceTransactionDto;
          await this.financeService.createTransaction(payload);
          if (!silent) {
            await this.zcaMessenger.sendMessage(chatId, summarizeGeneric(pending.code));
          }
          break;
        }
      }

      return true;
    } catch (err) {
      this.logger.error(`Failed to execute confirmed action: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        chatId,
        `⚠️ Chưa thực hiện được: ${(err as Error).message}`,
      );
      return true;
    }
  }

  private async processCancel(userId: string, chatId: string, code?: string): Promise<boolean> {
    let pending: PendingAction | undefined;

    if (code) {
      pending = await this.getPendingByCode(code);
      if (!pending) {
        await this.zcaMessenger.sendMessage(chatId, `⚠️ Không có yêu cầu [${code}] đang chờ.`);
        return true;
      }
      if (pending.userId !== userId && pending.chatId !== chatId) {
        await this.zcaMessenger.sendMessage(chatId, `⚠️ Bạn không huỷ được yêu cầu [${code}].`);
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

    await this.zcaMessenger.sendMessage(
      chatId,
      `[${pending.code}] Đã huỷ: ${describePendingAction(pending)}`,
    );
    return true;
  }
}

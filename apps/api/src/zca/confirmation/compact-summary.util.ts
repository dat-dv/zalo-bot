import { CreateFinanceTransactionDto, CreateDebtDto } from '../../finance/finance.service';
import { nagLabel, repeatLabel } from '../../reminders/reminder-rule.format';
import {
  type PayloadReminderTime,
  payloadTimeAt,
  payloadTimeRepeat,
} from '../../reminders/reminder-times';
import type { ReminderRepeat } from '../../reminders/reminder-schedule';
import { CreateReminderDto } from '../../reminders/reminders.service';
import type { ReminderRepeatType } from '@zalobot/contracts';
import { CreateTaskOptions } from '../../tasks/task.types';
import { CreateEventOptions } from '../../google/google-calendar.service';
import {
  BanUserDto,
  CompleteTaskDto,
  DeleteCalendarEventDto,
  DeleteTransactionDto,
  formatCurrencyVN,
} from './dto-descriptor.util';

/**
 * Tin nhắn "đã xác nhận thành công" dạng gọn (1–2 dòng) cho điện thoại.
 * Chỉ một icon ở đầu tin; các phần phụ là chữ, nối bằng ` · `, bỏ phần rỗng.
 */

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function toValidDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function zonedParts(d: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

function formatShortDate(p: ZonedParts, now: Date): string {
  const sameYear = zonedParts(now).year === p.year;
  return sameYear ? `${p.day}/${p.month}` : `${p.day}/${p.month}/${p.year}`;
}

/** `08:30 21/10`; năm chỉ in khi khác năm hiện tại (giờ Việt Nam). Rỗng nếu không hợp lệ. */
export function formatShortDateTimeVN(
  value?: string | Date | null,
  now: Date = new Date(),
): string {
  const d = toValidDate(value);
  if (!d) return '';
  const p = zonedParts(d);
  return `${p.hour}:${p.minute} ${formatShortDate(p, now)}`;
}

/** `21/10` (hoặc `21/10/2025` khi khác năm). Rỗng nếu không hợp lệ. */
export function formatShortDateVN(value?: string | Date | null, now: Date = new Date()): string {
  const d = toValidDate(value);
  if (!d) return '';
  return formatShortDate(zonedParts(d), now);
}

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Nối các phần bằng ` · `, bỏ phần rỗng. */
export function joinParts(parts: ReadonlyArray<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(' · ');
}

function joinLines(lines: ReadonlyArray<string>): string {
  return lines.filter((line) => line.trim() !== '').join('\n');
}

function withPrefix(prefix: string, value: string): string {
  return value ? `${prefix} ${value}` : '';
}

function money(amount: number | null | undefined, currency?: string): string {
  const formatted = formatCurrencyVN(amount, currency);
  return formatted === '(trống)' ? '' : formatted.replace(' đ', 'đ');
}

export function summarizeTransaction(
  code: string,
  dto: CreateFinanceTransactionDto,
  now: Date = new Date(),
): string {
  const typeWord = dto.type === 'income' ? 'Thu' : 'Chi';
  const first = `✅ [${code}] ${joinParts([
    `${typeWord} ${money(dto.amount, dto.currency)}`.trim(),
    clean(dto.category),
    clean(dto.note),
  ])}`;
  const second = joinParts([
    clean(dto.placeName),
    formatShortDateTimeVN(dto.occurredAt, now),
    clean(dto.paymentMethod),
  ]);
  return joinLines([first, second, withPrefix('Hoá đơn:', clean(dto.receiptUrl))]);
}

export function summarizeDeletedTransaction(
  code: string,
  dto: DeleteTransactionDto,
  now: Date = new Date(),
): string {
  const typeWord = dto.type === 'income' ? 'thu' : 'chi';
  const first = `🗑️ [${code}] Đã xoá ${joinParts([
    `${typeWord} ${money(dto.amount, dto.currency)}`.trim(),
    clean(dto.category),
    clean(dto.note),
  ])}`;
  return joinLines([first, formatShortDateTimeVN(dto.occurredAt, now)]);
}

export function summarizeDebt(code: string, dto: CreateDebtDto, now: Date = new Date()): string {
  const alias = clean(dto.counterpartyAlias);
  const person = alias
    ? `${clean(dto.counterparty)} (${alias})`
    : clean(dto.counterparty) || 'Người liên quan';
  const amount = money(dto.amount, dto.currency);
  const relation =
    dto.direction === 'receivable' ? `${person} nợ bạn ${amount}` : `Bạn nợ ${person} ${amount}`;
  const first = `✅ [${code}] ${joinParts([relation.trim(), clean(dto.note)])}`;
  const second = joinParts([
    formatShortDateTimeVN(dto.occurredAt, now),
    withPrefix('hạn', formatShortDateVN(dto.dueAt, now)),
  ]);
  return joinLines([first, second]);
}

export function summarizeReminder(
  code: string,
  dto: Pick<
    CreateReminderDto,
    | 'title'
    | 'notifyType'
    | 'repeatType'
    | 'nagEveryMinutes'
    | 'nagCount'
    | 'remindUsers'
    | 'remindMode'
  > & {
    remindAt: string | Date;
    remindTimes?: readonly PayloadReminderTime[];
  },
  now: Date = new Date(),
): string {
  const when = formatShortTimesVN(dto.remindTimes, dto.remindAt, now, dto.repeatType);
  const first = `⏰ [${code}] Nhắc "${clean(dto.title)}"${when ? ` lúc ${when}` : ''}`;
  const second = joinParts([
    nagLabel(dto),
    dto.notifyType === 'call' ? 'gọi điện' : '',
    remindPeople(dto),
  ]);
  return joinLines([first, second]);
}

/**
 * "08:00 23/10 (hàng ngày), 14:00 25/10" for several times, else the single `remindAt`.
 * `legacyRepeat` is the whole-reminder repeat of older payloads.
 */
function formatShortTimesVN(
  times: readonly PayloadReminderTime[] | undefined,
  single: string | Date | undefined,
  now: Date,
  legacyRepeat?: ReminderRepeatType,
): string {
  const values: readonly (PayloadReminderTime | undefined)[] = times?.length ? times : [single];
  return values
    .map((value) => {
      const when = formatShortDateTimeVN(payloadTimeAt(value), now);
      const own = payloadTimeRepeat(value);
      const repeat: ReminderRepeat =
        own.repeatType === 'none' && legacyRepeat
          ? { repeatType: legacyRepeat, repeatWeekdays: [] }
          : own;
      return when && repeat.repeatType !== 'none'
        ? `${when} (${repeatLabel(repeat).toLocaleLowerCase('vi')})`
        : when;
    })
    .filter(Boolean)
    .join(', ');
}

/** "@Trí, @Đạt (nhắn riêng)", or "" when nobody is tagged. */
function remindPeople(dto: Pick<CreateTaskOptions, 'remindUsers' | 'remindMode'>): string {
  if (!dto.remindUsers?.length) return '';
  const names = dto.remindUsers.map((user) => `@${user.name}`).join(', ');
  return `${names}${dto.remindMode === 'direct' ? ' (nhắn riêng)' : ''}`;
}

export function summarizeTask(
  code: string,
  dto: CreateTaskOptions,
  now: Date = new Date(),
): string {
  const first = `✅ [${code}] ${joinParts([
    `Thêm việc: ${clean(dto.title)}`,
    withPrefix('hạn', formatShortDateVN(dto.due, now)),
    withPrefix('nhắc', formatShortTimesVN(dto.remindTimes, dto.remindAt, now)),
    nagLabel(dto),
    remindPeople(dto),
  ])}`;
  return joinLines([first, withPrefix('Ghi chú:', clean(dto.notes))]);
}

export function summarizeCompletedTask(code: string, dto: CompleteTaskDto): string {
  return `☑️ [${code}] Đã xong: ${clean(dto.taskTitle)}`;
}

function formatEventRange(start: string | undefined, end: string | undefined, now: Date): string {
  const startDate = toValidDate(start);
  if (!startDate) return '';
  const endDate = toValidDate(end);
  const s = zonedParts(startDate);
  if (!endDate) return formatShortDateTimeVN(startDate, now);
  const e = zonedParts(endDate);
  const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
  return sameDay
    ? `${s.hour}:${s.minute}–${e.hour}:${e.minute} ${formatShortDate(s, now)}`
    : `${formatShortDateTimeVN(startDate, now)} – ${formatShortDateTimeVN(endDate, now)}`;
}

export function summarizeCalendarEvent(
  code: string,
  dto: CreateEventOptions,
  now: Date = new Date(),
): string {
  const first = `📅 [${code}] ${joinParts([
    clean(dto.summary),
    formatEventRange(dto.startDateTime, dto.endDateTime, now),
  ])}`;
  const reminders =
    dto.reminderMinutes && dto.reminderMinutes.length > 0
      ? `báo trước ${dto.reminderMinutes.map((m) => `${m}p`).join(', ')}`
      : '';
  const second = joinParts([clean(dto.location), reminders]);
  return joinLines([first, second]);
}

export function summarizeDeletedCalendarEvent(
  code: string,
  dto: DeleteCalendarEventDto,
  now: Date = new Date(),
): string {
  return `🗑️ [${code}] Đã xoá lịch: ${joinParts([
    clean(dto.summary),
    formatShortDateTimeVN(dto.startDateTime, now),
  ])}`;
}

export function summarizeBannedUser(code: string, dto: BanUserDto): string {
  const name = clean(dto.targetName);
  const who = name ? `${name} (id ${dto.targetUserId})` : `id ${dto.targetUserId}`;
  const first = `⛔ [${code}] ${joinParts([`Đã khoá ${who}`, 'đã thu hồi quyền và token Google'])}`;
  return joinLines([first, withPrefix('Lý do:', clean(dto.reason))]);
}

export function summarizePlace(code: string, name: string): string {
  return `📍 [${code}] Đã tạo nơi chốn: ${clean(name)}`;
}

export function summarizeGeneric(code: string): string {
  return `✅ [${code}] Đã xác nhận`;
}

export function summarizeRememberedNote(code: string, text: string): string {
  return `🧠 [${code}] Đã ghi nhớ: ${clean(text)}`;
}

export function summarizeForgotten(code: string, items: readonly string[]): string {
  return `🧹 [${code}] Đã quên: ${items.map((item) => `"${clean(item)}"`).join('; ')}`;
}

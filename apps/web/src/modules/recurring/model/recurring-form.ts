import type {
  ICreateRecurringRequest,
  IRecurringTransactionItem,
  RecurringMode,
  RecurringRepeatType,
  TransactionType,
} from '@zalobot/contracts';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';

export const RECURRING_REPEAT_OPTIONS: readonly RecurringRepeatType[] = [
  'monthly',
  'weekly',
  'weekdays',
  'daily',
  'yearly',
];

export interface RecurringDraft {
  type: TransactionType;
  note: string;
  category: string;
  amount: string;
  mode: RecurringMode;
  repeatType: RecurringRepeatType;
  startAt: string;
  notifyChatId: string;
}

/** Defaults to tomorrow: a start of "now" is already past on save and would skip to next period. */
export function emptyRecurringDraft(now: Date = new Date()): RecurringDraft {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
  return {
    type: 'expense',
    note: '',
    category: '',
    amount: '',
    mode: 'auto',
    repeatType: 'monthly',
    startAt: toLocalDateTimeInput(tomorrow),
    notifyChatId: '',
  };
}

export function draftFromRecurring(item: IRecurringTransactionItem): RecurringDraft {
  return {
    type: item.type,
    note: item.note,
    category: item.category,
    amount: item.amount === null ? '' : String(item.amount),
    mode: item.mode,
    repeatType: item.repeatType,
    startAt: toLocalDateTimeInput(new Date(item.nextDueAt)),
    notifyChatId: item.notifyChatId ?? '',
  };
}

/** Digits only, so `1.200.000` and `1200000` both work. */
export function parseAmountInput(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  const amount = Number(digits);
  return digits && amount > 0 ? amount : null;
}

/** The amount is required only when the rule records itself. */
export function isRecurringDraftValid(draft: RecurringDraft): boolean {
  if (!draft.note.trim() || !draft.startAt) return false;
  return draft.mode === 'confirm' || parseAmountInput(draft.amount) !== null;
}

export function draftToRequest(draft: RecurringDraft): ICreateRecurringRequest {
  return {
    type: draft.type,
    note: draft.note.trim(),
    category: draft.category.trim() || undefined,
    amount: parseAmountInput(draft.amount),
    mode: draft.mode,
    repeatType: draft.repeatType,
    startAt: new Date(draft.startAt).toISOString(),
    notifyChatId: draft.notifyChatId || null,
  };
}

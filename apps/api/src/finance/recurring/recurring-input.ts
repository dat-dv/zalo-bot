import {
  isRecurringRepeatType,
  type ICreateRecurringRequest,
  type RecurringMode,
  type RecurringRepeatType,
} from '@zalobot/contracts';

export interface RecurringInput {
  type: 'income' | 'expense';
  amount: number | null;
  category: string;
  note: string;
  placeName?: string;
  repeatType: RecurringRepeatType;
  repeatWeekdays: number[];
  startAt: Date;
  mode: RecurringMode;
  notifyChatId: string | null;
}

/** Validates a rule; the thrown message is shown to the person filling in the form. */
export function parseRecurringInput(body: Partial<ICreateRecurringRequest>): RecurringInput {
  if (body.type !== 'income' && body.type !== 'expense') {
    throw new Error('Loại khoản phải là thu hoặc chi.');
  }
  const note = body.note?.trim();
  if (!note) throw new Error('Cần có tên khoản.');
  if (!isRecurringRepeatType(body.repeatType)) throw new Error('Kiểu lặp không hợp lệ.');
  if (body.mode !== 'auto' && body.mode !== 'confirm') throw new Error('Chế độ không hợp lệ.');

  const hasAmount = body.amount !== undefined && body.amount !== null;
  const amount = hasAmount ? Math.round(Number(body.amount)) : null;
  if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
    throw new Error('Số tiền phải lớn hơn 0.');
  }
  if (body.mode === 'auto' && amount === null) {
    throw new Error('Khoản tự ghi cần có số tiền cố định.');
  }

  const startAt = new Date(body.startAt ?? '');
  if (Number.isNaN(startAt.getTime())) throw new Error('Ngày bắt đầu không hợp lệ.');

  const weekdays = body.repeatWeekdays ?? [];
  if (weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error('Thứ trong tuần không hợp lệ.');
  }

  return {
    type: body.type,
    amount,
    category: body.category?.trim() || 'Khác',
    note,
    placeName: body.placeName?.trim() || undefined,
    repeatType: body.repeatType,
    repeatWeekdays: body.repeatType === 'weekly' ? [...new Set(weekdays)].sort() : [],
    startAt,
    mode: body.mode,
    notifyChatId: body.notifyChatId?.trim() || null,
  };
}

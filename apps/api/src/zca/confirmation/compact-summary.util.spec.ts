import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatShortDateTimeVN,
  joinParts,
  summarizeCalendarEvent,
  summarizeDebt,
  summarizeReminder,
  summarizeTask,
  summarizeTransaction,
} from './compact-summary.util';

const NOW = new Date('2026-10-21T03:00:00Z');

void test('formatShortDateTimeVN omits the year only within the current year', () => {
  assert.equal(formatShortDateTimeVN('2026-10-21T01:30:00Z', NOW), '08:30 21/10');
  assert.equal(formatShortDateTimeVN('2025-10-21T01:30:00Z', NOW), '08:30 21/10/2025');
  assert.equal(formatShortDateTimeVN(undefined, NOW), '');
  assert.equal(formatShortDateTimeVN('not-a-date', NOW), '');
});

void test('joinParts skips empty parts', () => {
  assert.equal(joinParts(['a', '', null, undefined, false, ' ', 'b']), 'a · b');
});

void test('summarizeTransaction prints only filled fields on at most two lines', () => {
  const text = summarizeTransaction(
    '230',
    {
      type: 'expense',
      amount: 15000,
      category: 'Ăn uống',
      note: 'bánh mỳ',
      placeName: 'đối diện ctgroup',
      occurredAt: '2026-10-21T01:30:00Z',
    },
    NOW,
  );
  assert.equal(
    text,
    '✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ\n📍 đối diện ctgroup · 🕗 08:30 21/10',
  );
  assert.doesNotMatch(text, /\(trống\)/);
});

void test('summarizeTransaction handles income with no optional fields', () => {
  assert.equal(
    summarizeTransaction('231', { type: 'income', amount: 5000000, note: '' }, NOW),
    '✅ [231] Thu 5.000.000đ',
  );
});

void test('summarizeTransaction keeps the receipt URL on its own line', () => {
  const text = summarizeTransaction(
    '232',
    { type: 'expense', amount: 85000, note: 'cà phê', receiptUrl: 'https://drive/x' },
    NOW,
  );
  assert.equal(text, '✅ [232] Chi 85.000đ · cà phê\n🧾 https://drive/x');
});

void test('summarizeDebt covers both directions, alias and due date', () => {
  assert.equal(
    summarizeDebt(
      '300',
      {
        direction: 'receivable',
        counterparty: 'Nam',
        counterpartyAlias: 'Nam Béo',
        amount: 100000,
        note: 'tiền ăn',
        dueAt: '2026-10-30T10:00:00Z',
      },
      NOW,
    ),
    '✅ [300] Nam (Nam Béo) nợ bạn 100.000đ · tiền ăn\n⏳ hạn 30/10',
  );
  assert.equal(
    summarizeDebt('301', { direction: 'payable', counterparty: 'Huy', amount: 50000 }, NOW),
    '✅ [301] Bạn nợ Huy 50.000đ',
  );
});

void test('summarizeReminder adds a second line only for repeat or call', () => {
  assert.equal(
    summarizeReminder('400', { title: 'tắt bếp', remindAt: '2026-10-21T02:15:00Z' }, NOW),
    '⏰ [400] Nhắc "tắt bếp" lúc 09:15 21/10',
  );
  assert.equal(
    summarizeReminder(
      '401',
      {
        title: 'uống thuốc',
        remindAt: new Date('2026-10-21T13:00:00Z'),
        repeatType: 'daily',
        notifyType: 'call',
      },
      NOW,
    ),
    '⏰ [401] Nhắc "uống thuốc" lúc 20:00 21/10 (hàng ngày)\n📞 gọi điện',
  );
  assert.equal(
    summarizeReminder(
      '402',
      {
        title: 'uống thuốc',
        remindAt: '2026-10-21T01:00:00Z',
        remindTimes: [
          { at: '2026-10-21T01:00:00Z', repeat: { repeatType: 'daily', repeatWeekdays: [] } },
          '2026-10-21T07:00:00Z',
        ],
        nagEveryMinutes: 15,
        nagCount: 3,
      },
      NOW,
    ),
    '⏰ [402] Nhắc "uống thuốc" lúc 08:00 21/10 (hàng ngày), 14:00 21/10\n🔁 nhắc lại mỗi 15 phút ×3',
  );
});

void test('summarizeTask shows due date inline', () => {
  assert.equal(
    summarizeTask('500', { title: 'nộp báo cáo', due: '2026-10-22T10:00:00Z' }, NOW),
    '✅ [500] Thêm việc: nộp báo cáo · ⏳ hạn 22/10',
  );
});

void test('summarizeTask shows the reminder time inline', () => {
  assert.equal(
    summarizeTask('501', { title: 'họp', remindAt: '2026-10-22T08:00:00Z' }, NOW),
    '✅ [501] Thêm việc: họp · ⏰ nhắc 15:00 22/10',
  );
});

void test('summarizeCalendarEvent collapses same-day ranges', () => {
  assert.equal(
    summarizeCalendarEvent(
      '600',
      {
        summary: 'Họp dự án',
        startDateTime: '2026-10-22T14:00:00+07:00',
        endDateTime: '2026-10-22T15:00:00+07:00',
        location: 'Phòng A',
        reminderMinutes: [10],
      },
      NOW,
    ),
    '📅 [600] Họp dự án · 14:00–15:00 22/10\n📍 Phòng A · 🔔 trước 10p',
  );
  assert.equal(
    summarizeCalendarEvent(
      '601',
      {
        summary: 'Du lịch',
        startDateTime: '2026-10-22T08:00:00+07:00',
        endDateTime: '2026-10-23T18:00:00+07:00',
      },
      NOW,
    ),
    '📅 [601] Du lịch · 08:00 22/10 – 18:00 23/10',
  );
});

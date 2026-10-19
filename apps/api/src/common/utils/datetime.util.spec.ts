import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { getVietnamDateTimeContext, getStartAndEndOfDayInTz } from './datetime.util';

void test('getVietnamDateTimeContext accurately calculates weekday and date in Vietnam timezone', () => {
  // 2026-10-19 12:45:18 GMT+7 is 2026-10-19T05:45:18.000Z
  const date = new Date('2026-10-19T05:45:18.000Z');
  const ctx = getVietnamDateTimeContext(date);

  assert.equal(ctx.weekday, 'Thứ Hai');
  assert.equal(ctx.day, '19');
  assert.equal(ctx.month, '10');
  assert.equal(ctx.year, '2026');
  assert.equal(ctx.time, '12:45:18');
  assert.equal(ctx.formattedDate, 'Thứ Hai, ngày 19 tháng 10 năm 2026');
  assert.equal(ctx.isoLocal, '2026-10-19T12:45:18+07:00');
  assert.match(ctx.systemInstructionSnippet, /Hôm nay là: Thứ Hai/);
  assert.match(ctx.systemInstructionSnippet, /ngày 19\/10\/2026/);
});

void test('getVietnamDateTimeContext handles early morning in Vietnam across UTC midnight', () => {
  // 2026-10-19 03:00:00 GMT+7 is 2026-10-18T20:00:00.000Z
  const earlyMorningDate = new Date('2026-10-18T20:00:00.000Z');
  const ctx = getVietnamDateTimeContext(earlyMorningDate);

  // Even though UTC is Oct 18 (Sunday), in Vietnam it is Oct 19 (Monday / Thứ Hai)
  assert.equal(ctx.weekday, 'Thứ Hai');
  assert.equal(ctx.day, '19');
  assert.equal(ctx.month, '10');
  assert.equal(ctx.year, '2026');
  assert.equal(ctx.time, '03:00:00');
  assert.equal(ctx.formattedDate, 'Thứ Hai, ngày 19 tháng 10 năm 2026');
});

void test('getVietnamDateTimeContext handles Sunday correctly', () => {
  // 2026-10-18 15:00:00 GMT+7 is 2026-10-18T08:00:00.000Z
  const sunday = new Date('2026-10-18T08:00:00.000Z');
  const ctx = getVietnamDateTimeContext(sunday);

  assert.equal(ctx.weekday, 'Chủ Nhật');
  assert.equal(ctx.day, '18');
  assert.equal(ctx.month, '10');
  assert.equal(ctx.year, '2026');
});

void test('getStartAndEndOfDayInTz returns correct start and end boundaries', () => {
  const date = new Date('2026-10-18T20:00:00.000Z'); // 03:00 AM VN on Oct 19
  const { startOfDay, endOfDay } = getStartAndEndOfDayInTz(date);

  // Start of Oct 19 in VN (+7) is 2026-10-18T17:00:00.000Z
  assert.equal(startOfDay.toISOString(), '2026-10-18T17:00:00.000Z');
  // End of Oct 19 in VN (+7) is 2026-10-19T16:59:59.999Z
  assert.equal(endOfDay.toISOString(), '2026-10-19T16:59:59.999Z');
});

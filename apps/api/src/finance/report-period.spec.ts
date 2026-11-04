import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveReportPeriod, resolveReportRange } from './report-period';

const iso = (date: Date | null) => date?.toISOString() ?? null;

void test('the day turns over at midnight in Vietnam, not UTC', () => {
  // 17:30 UTC on Nov 3 is already 00:30 on Nov 4 in Vietnam.
  const range = resolveReportPeriod('today', new Date('2026-11-03T17:30:00Z'));
  assert.equal(iso(range.startAt), '2026-11-03T17:00:00.000Z');
  assert.equal(iso(range.endAt), '2026-11-04T17:00:00.000Z');
});

void test('yesterday ends where today starts', () => {
  const now = new Date('2026-11-04T05:00:00Z');
  const yesterday = resolveReportPeriod('yesterday', now);
  assert.equal(iso(yesterday.endAt), iso(resolveReportPeriod('today', now).startAt));
});

void test('weeks run Monday to Sunday, including on a Sunday', () => {
  // Sunday Nov 8, 2026 in Vietnam.
  const range = resolveReportPeriod('this_week', new Date('2026-11-08T05:00:00Z'));
  assert.equal(iso(range.startAt), '2026-11-01T17:00:00.000Z');
  assert.equal(iso(range.endAt), '2026-11-08T17:00:00.000Z');
  assert.equal(range.label, 'Tuần này (02/11–08/11)');
});

void test('last month crosses the year boundary', () => {
  const range = resolveReportPeriod('last_month', new Date('2027-01-15T05:00:00Z'));
  assert.equal(iso(range.startAt), '2026-11-30T17:00:00.000Z');
  assert.equal(iso(range.endAt), '2026-12-31T17:00:00.000Z');
  assert.equal(range.label, 'Tháng 12/2026');
});

void test('this month label uses the Vietnam month at a boundary', () => {
  const range = resolveReportPeriod('this_month', new Date('2026-10-31T18:00:00Z'));
  assert.equal(range.label, 'Tháng 11/2026');
});

void test('all time has no bounds', () => {
  const range = resolveReportPeriod('all_time', new Date());
  assert.equal(range.startAt, null);
  assert.equal(range.endAt, null);
});

void test('a custom range includes its last day', () => {
  const range = resolveReportRange('2026-10-01', '2026-10-15');
  assert.equal(iso(range?.startAt ?? null), '2026-09-30T17:00:00.000Z');
  assert.equal(iso(range?.endAt ?? null), '2026-10-15T17:00:00.000Z');
  assert.equal(range?.label, '01/10/2026–15/10/2026');
});

void test('impossible or reversed dates are refused', () => {
  assert.equal(resolveReportRange('2026-02-30', '2026-03-01'), null);
  assert.equal(resolveReportRange('2026-10-15', '2026-10-01'), null);
  assert.equal(resolveReportRange('15/10/2026', '2026-10-20'), null);
});

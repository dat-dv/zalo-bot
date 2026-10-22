import test from 'node:test';
import assert from 'node:assert/strict';
import { isDashboardAccessCode } from '@zalobot/contracts';
import {
  DASHBOARD_ACCESS_CODE_LENGTH,
  formatDashboardAccessCode,
  generateDashboardAccessCode,
  hashDashboardAccessCode,
} from './dashboard-access-code';

void test('generateDashboardAccessCode yields 8 decimal digits', () => {
  for (let i = 0; i < 50; i += 1) {
    const code = generateDashboardAccessCode();
    assert.equal(code.length, DASHBOARD_ACCESS_CODE_LENGTH);
    assert.ok(isDashboardAccessCode(code));
  }
});

void test('generateDashboardAccessCode joins one digit per position', () => {
  const digits = [0, 9, 1, 8, 2, 7, 3, 6];
  assert.equal(
    generateDashboardAccessCode(() => digits.shift() ?? -1),
    '09182736',
  );
});

void test('formatDashboardAccessCode splits the code in two groups', () => {
  assert.equal(formatDashboardAccessCode('12345678'), '1234-5678');
});

void test('hashDashboardAccessCode ignores dashes and spaces', () => {
  const expected = hashDashboardAccessCode('12345678');
  assert.ok(expected);
  assert.equal(hashDashboardAccessCode('1234-5678'), expected);
  assert.equal(hashDashboardAccessCode(' 1234 5678 '), expected);
});

void test('hashDashboardAccessCode accepts digit codes of any length', () => {
  assert.ok(hashDashboardAccessCode('893091'));
  assert.ok(hashDashboardAccessCode('1'));
});

void test('hashDashboardAccessCode rejects input that cannot be a code', () => {
  assert.equal(hashDashboardAccessCode(''), null);
  assert.equal(hashDashboardAccessCode('- -'), null);
  assert.equal(hashDashboardAccessCode('K7P2QX9M'), null);
  assert.equal(hashDashboardAccessCode('1234567a'), null);
  assert.equal(hashDashboardAccessCode('1'.repeat(33)), null);
});

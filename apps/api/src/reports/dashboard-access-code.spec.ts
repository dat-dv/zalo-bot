import test from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_ACCESS_CODE_ALPHABET, isDashboardAccessCode } from '@zalobot/contracts';
import {
  formatDashboardAccessCode,
  generateDashboardAccessCode,
  hashDashboardAccessCode,
} from './dashboard-access-code';

void test('generateDashboardAccessCode yields 8 symbols from the code alphabet', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.ok(isDashboardAccessCode(generateDashboardAccessCode()));
  }
});

void test('generateDashboardAccessCode maps every byte value onto the alphabet', () => {
  const code = generateDashboardAccessCode(() => Buffer.from([0, 31, 32, 255, 1, 2, 3, 4]));
  const alphabet = DASHBOARD_ACCESS_CODE_ALPHABET;
  assert.equal(code, `${alphabet[0]}${alphabet[31]}${alphabet[0]}${alphabet[31]}123${'4'}`);
});

void test('formatDashboardAccessCode splits the code in two groups', () => {
  assert.equal(formatDashboardAccessCode('K7P2QX9M'), 'K7P2-QX9M');
});

void test('hashDashboardAccessCode ignores case, dashes and spaces', () => {
  const expected = hashDashboardAccessCode('K7P2QX9M');
  assert.ok(expected);
  assert.equal(hashDashboardAccessCode('k7p2-qx9m'), expected);
  assert.equal(hashDashboardAccessCode(' K7P2 QX9M '), expected);
});

void test('hashDashboardAccessCode rejects input that cannot be a code', () => {
  assert.equal(hashDashboardAccessCode(''), null);
  assert.equal(hashDashboardAccessCode('K7P2QX9'), null);
  assert.equal(hashDashboardAccessCode('K7P2QX9MM'), null);
  // I, L, O and U are left out of the alphabet so they cannot be confused with 1 and 0.
  assert.equal(hashDashboardAccessCode('K7P2QX9O'), null);
});

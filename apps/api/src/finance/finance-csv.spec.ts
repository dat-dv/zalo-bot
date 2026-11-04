import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { DebtEntity } from '../database/entities/debt.entity';
import { csvCell, csvFileName, debtCsvRow, transactionCsvRow } from './finance-csv';

void test('text that a spreadsheet would run as a formula is neutralized', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+84912345678'), "'+84912345678");
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
});

void test('amounts stay numbers so Excel can add them', () => {
  assert.equal(csvCell(45000), '45000');
  assert.equal(csvCell(-500), '-500');
});

void test('commas, quotes and newlines are quoted', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('nói "có"'), '"nói ""có"""');
  assert.equal(csvCell('dòng 1\ndòng 2'), '"dòng 1\ndòng 2"');
});

void test('missing values become empty cells', () => {
  assert.equal(csvCell(undefined), '');
  assert.equal(csvCell(null), '');
});

void test('a transaction row is dated in Vietnam time', () => {
  const row = transactionCsvRow({
    id: 't1',
    type: 'expense',
    amount: 45_000,
    category: 'Ăn uống',
    note: 'ăn trưa',
    occurredAt: '2026-11-03T17:30:00.000Z',
    runningBalance: 100_000,
    runningBalanceWithSavings: 150_000,
  });
  assert.equal(row, '04/11/2026 00:30,Chi,45000,Ăn uống,ăn trưa,,,,100000\r\n');
});

void test('a debt row names the person with their alias', () => {
  const row = debtCsvRow({
    direction: 'receivable',
    counterparty: 'Trí',
    counterpartyAlias: 'Trí Đen',
    originalAmount: 200_000,
    remainingAmount: 50_000,
    status: 'active',
    occurredAt: new Date('2026-11-01T05:00:00Z'),
    dueAt: new Date('2026-12-01T05:00:00Z'),
  } as DebtEntity);
  assert.equal(row, '01/11/2026,Phải thu,Trí (Trí Đen),200000,50000,Còn nợ,01/12/2026,\r\n');
});

void test('the file name carries the Vietnam date', () => {
  assert.equal(
    csvFileName('giao-dich', new Date('2026-11-03T17:30:00Z')),
    'giao-dich-2026-11-04.csv',
  );
});

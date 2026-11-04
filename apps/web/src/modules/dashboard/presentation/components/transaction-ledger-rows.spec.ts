import assert from 'node:assert/strict';
import test from 'node:test';
import type { ITransactionListItem, ITransactionSavingMovement } from '@zalobot/contracts';
import { mergeLedgerRows } from './transaction-ledger-rows';

function transaction(id: string, occurredAt: string): ITransactionListItem {
  return {
    id,
    type: 'income',
    category: 'Lương',
    note: 'Lương',
    amount: 100,
    occurredAt,
    runningBalance: 80,
    runningBalanceWithSavings: 100,
  };
}

const deposit: ITransactionSavingMovement = {
  id: 'm1',
  groupId: 'g1',
  groupName: 'Du lịch',
  type: 'deposit',
  amount: 20,
  occurredAt: '2026-10-02T00:00:00.000Z',
  createdAt: '2026-10-02T00:00:00.000Z',
  runningBalance: 80,
  runningBalanceWithSavings: 100,
};

const label = (type: string) => `label:${type}`;

void test('places movements between transactions, newest first', () => {
  const rows = mergeLedgerRows(
    [
      transaction('later', '2026-10-03T00:00:00.000Z'),
      transaction('old', '2026-10-01T00:00:00.000Z'),
    ],
    [deposit],
    false,
    label,
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['later', 'm1', 'old'],
  );
});

void test('a movement is read-only and names its group', () => {
  const [row] = mergeLedgerRows([], [{ ...deposit, note: 'Tháng 10' }], false, label);
  assert.equal(row?.readOnly, true);
  assert.equal(row?.type, 'expense');
  assert.equal(row?.category, 'label:deposit');
  assert.equal(row?.note, 'Du lịch: Tháng 10');
});

void test('the toggle picks the balance that includes savings', () => {
  const rows = [transaction('t', '2026-10-01T00:00:00.000Z')];
  assert.equal(mergeLedgerRows(rows, [], false, label)[0]?.runningBalance, 80);
  assert.equal(mergeLedgerRows(rows, [], true, label)[0]?.runningBalance, 100);
});

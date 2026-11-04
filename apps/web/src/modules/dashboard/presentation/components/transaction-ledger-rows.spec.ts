import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ITransactionListItem,
  ITransactionSavingMovement,
  SavingMovementType,
} from '@zalobot/contracts';
import { mergeLedgerRows, walletSignOfSavingsMoved } from './transaction-ledger-rows';

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

void test('a movement is signed by its effect on the wallet', () => {
  const signOf = (type: SavingMovementType) =>
    mergeLedgerRows([], [{ ...deposit, type }], false, label)[0]?.walletSign;
  assert.equal(signOf('deposit'), '-');
  assert.equal(signOf('withdrawal'), '+');
  assert.equal(signOf('opening'), '');
});

void test('a transaction has no wallet sign, so it keeps the income and expense look', () => {
  const rows = [transaction('t', '2026-10-01T00:00:00.000Z')];
  assert.equal(mergeLedgerRows(rows, [], false, label)[0]?.walletSign, undefined);
});

void test('money moved to savings takes from the wallet, money moved back adds to it', () => {
  assert.equal(walletSignOfSavingsMoved(88_000_000), '-');
  assert.equal(walletSignOfSavingsMoved(-1_000), '+');
  assert.equal(walletSignOfSavingsMoved(0), '');
});

void test('the toggle picks the balance that includes savings', () => {
  const rows = [transaction('t', '2026-10-01T00:00:00.000Z')];
  assert.equal(mergeLedgerRows(rows, [], false, label)[0]?.runningBalance, 80);
  assert.equal(mergeLedgerRows(rows, [], true, label)[0]?.runningBalance, 100);
});

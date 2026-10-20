import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countActiveColumnFilters,
  EMPTY_TRANSACTION_COLUMN_FILTERS,
  parseTransactionColumnFilters,
  toTransactionListFilterQuery,
  writeTransactionColumnFilters,
} from './transaction-column-filters';

void test('column filters round-trip through the URL and keep unrelated params', () => {
  const filters = {
    ...EMPTY_TRANSACTION_COLUMN_FILTERS,
    type: 'expense' as const,
    categories: ['Ăn uống', 'Đi lại'],
    note: 'phở',
    placeIds: ['none', 'p1'],
    createdByUserIds: ['u1'],
    receipt: 'yes' as const,
    amountMin: '1000',
  };
  const params = writeTransactionColumnFilters(new URLSearchParams('grain=month'), filters);

  assert.equal(params.get('grain'), 'month');
  assert.deepEqual(parseTransactionColumnFilters(params), filters);
  assert.equal(countActiveColumnFilters(filters), 6);
});

void test('parseTransactionColumnFilters drops invalid values', () => {
  const filters = parseTransactionColumnFilters(
    new URLSearchParams(
      'type=transfer&receipt=maybe&amountMin=-5&amountMax=abc&category=+&category=A',
    ),
  );
  assert.deepEqual(filters, { ...EMPTY_TRANSACTION_COLUMN_FILTERS, categories: ['A'] });
  assert.equal(countActiveColumnFilters(EMPTY_TRANSACTION_COLUMN_FILTERS), 0);
});

void test('toTransactionListFilterQuery omits empty filters and swaps a reversed amount range', () => {
  assert.deepEqual(toTransactionListFilterQuery(EMPTY_TRANSACTION_COLUMN_FILTERS), {
    type: undefined,
    categories: undefined,
    note: undefined,
    placeIds: undefined,
    createdByUserIds: undefined,
    hasReceipt: undefined,
    amountMin: undefined,
    amountMax: undefined,
  });
  const query = toTransactionListFilterQuery({
    ...EMPTY_TRANSACTION_COLUMN_FILTERS,
    receipt: 'no',
    amountMin: '50000',
    amountMax: '1000',
  });
  assert.equal(query.hasReceipt, false);
  assert.equal(query.amountMin, 1000);
  assert.equal(query.amountMax, 50000);
});

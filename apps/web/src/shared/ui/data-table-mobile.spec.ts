import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionMobileColumns, supportsMobileList, type MobileSlot } from './data-table-mobile';

type Column = { id: string; mobileSlot?: MobileSlot; mobileHeader?: boolean };

const columns: Column[] = [
  { id: 'type', mobileHeader: true },
  { id: 'category', mobileSlot: 'secondary', mobileHeader: true },
  { id: 'note', mobileSlot: 'primary' },
  { id: 'amount', mobileSlot: 'trailing', mobileHeader: true },
  { id: 'occurredAt', mobileSlot: 'secondary' },
  { id: 'actions' },
];

test('tables without mobile slots keep the scrolling table', () => {
  assert.equal(supportsMobileList([{ id: 'name' }, { id: 'actions' }]), false);
  assert.equal(supportsMobileList(columns), true);
});

test('partitions columns into list slots in table order', () => {
  const layout = partitionMobileColumns(columns);
  assert.equal(layout.primary?.id, 'note');
  assert.equal(layout.trailing?.id, 'amount');
  assert.deepEqual(
    layout.secondary.map((column) => column.id),
    ['category', 'occurredAt'],
  );
});

test('detail sheet lists every column except actions, which go to the footer', () => {
  const layout = partitionMobileColumns(columns);
  assert.deepEqual(
    layout.detail.map((column) => column.id),
    ['type', 'category', 'note', 'amount', 'occurredAt'],
  );
  assert.equal(layout.actions?.id, 'actions');
});

test('filter strip keeps only columns that opt in', () => {
  const layout = partitionMobileColumns(columns);
  assert.deepEqual(
    layout.headers.map((column) => column.id),
    ['type', 'category', 'amount'],
  );
});

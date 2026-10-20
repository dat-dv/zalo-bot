import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { FindManyOptions } from 'typeorm';
import type { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { FinanceController } from './finance.controller';
import {
  computeLedger,
  FinanceService,
  TRANSACTION_LIST_MAX_LIMIT,
  type LedgerRow,
} from './finance.service';

function row(
  id: string,
  type: 'income' | 'expense',
  amount: number,
  occurredAt: string,
  createdAt = occurredAt,
): LedgerRow {
  return { id, type, amount, occurredAt: new Date(occurredAt), createdAt: new Date(createdAt) };
}

const LEDGER: LedgerRow[] = [
  row('a', 'income', 10_000_000, '2026-08-01T02:00:00.000Z'),
  row('b', 'expense', 2_000_000, '2026-08-20T02:00:00.000Z'),
  row('c', 'expense', 500_000, '2026-09-05T02:00:00.000Z'),
  row('d', 'income', 1_000_000, '2026-09-10T02:00:00.000Z'),
  row('e', 'expense', 300_000, '2026-09-10T02:00:00.000Z', '2026-09-10T03:00:00.000Z'),
];

function createService(pageRows: LedgerRow[], total = pageRows.length) {
  const findAndCountCalls: FindManyOptions<FinanceTransactionEntity>[] = [];
  const findCalls: FindManyOptions<FinanceTransactionEntity>[] = [];
  const transactionRepo = {
    find: (options: FindManyOptions<FinanceTransactionEntity>) => {
      findCalls.push(options);
      return Promise.resolve(LEDGER);
    },
    findAndCount: (options: FindManyOptions<FinanceTransactionEntity>) => {
      findAndCountCalls.push(options);
      const entities = pageRows.map((item) => ({
        ...item,
        category: 'Khác',
        note: item.id,
        currency: 'VND',
        userId: '42',
      }));
      return Promise.resolve([entities, total]);
    },
  };
  const service = new FinanceService(
    transactionRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, findAndCountCalls, findCalls };
}

void test('computeLedger walks occurredAt, then createdAt, and returns the all-time balance', () => {
  const { runningBalances, ledgerBalance } = computeLedger([...LEDGER].reverse());

  assert.equal(runningBalances.get('a'), 10_000_000);
  assert.equal(runningBalances.get('b'), 8_000_000);
  assert.equal(runningBalances.get('c'), 7_500_000);
  assert.equal(runningBalances.get('d'), 8_500_000);
  assert.equal(runningBalances.get('e'), 8_200_000);
  assert.equal(ledgerBalance, 8_200_000);
});

void test('queryTransactions keeps running balances from the whole ledger when filtering a period and type', async () => {
  const { service, findAndCountCalls, findCalls } = createService([LEDGER[2]]);

  const result = await service.queryTransactions({
    type: 'expense',
    startAt: '2026-09-01T00:00:00.000Z',
    endAt: '2026-09-30T23:59:59.999Z',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'c');
  // Balance carries the August history even though August is outside the period.
  assert.equal(result.items[0].runningBalance, 7_500_000);
  assert.equal(result.ledgerBalance, 8_200_000);
  // Summary covers the whole period (both types), independent of the type filter.
  assert.deepEqual(result.summary, { income: 1_000_000, expense: 800_000, count: 3 });
  // Finance data is shared: the ledger walk and the page never filter by user.
  assert.equal(findCalls[0].where, undefined);
  const where = findAndCountCalls[0].where;
  assert.ok(Array.isArray(where));
  assert.equal(where.length, 1);
  assert.equal('userId' in where[0], false);
  assert.equal(where[0].type, 'expense');
});

void test('queryTransactions searches category, note and place name across the shared ledger', async () => {
  const { service, findAndCountCalls } = createService([]);

  await service.queryTransactions({ search: '  phở ' });

  const where = findAndCountCalls[0].where;
  assert.ok(Array.isArray(where));
  assert.equal(where.length, 3);
  for (const condition of where) assert.equal('userId' in condition, false);
  assert.ok('category' in where[0]);
  assert.ok('note' in where[1]);
  assert.ok('place' in where[2]);
});

void test('queryTransactions clamps limit and offset and reports the total', async () => {
  const { service, findAndCountCalls } = createService([LEDGER[0]], 1234);

  const result = await service.queryTransactions({ limit: 10_000, offset: -5 });

  assert.equal(findAndCountCalls[0].take, TRANSACTION_LIST_MAX_LIMIT);
  assert.equal(findAndCountCalls[0].skip, 0);
  assert.equal(result.limit, TRANSACTION_LIST_MAX_LIMIT);
  assert.equal(result.offset, 0);
  assert.equal(result.total, 1234);
});

void test('createTransaction stores the author but no owner, so every user reads the row', async () => {
  const created: Partial<FinanceTransactionEntity>[] = [];
  const service = new FinanceService(
    {
      create: (data: Partial<FinanceTransactionEntity>) => {
        created.push(data);
        return data;
      },
      save: (entity: unknown) => Promise.resolve(entity),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await service.createTransaction({
    type: 'expense',
    amount: 13_000,
    note: 'cà phê',
    createdByUserId: 'diệu-hằng',
    source: 'zalo',
  });

  assert.equal(created[0].createdByUserId, 'diệu-hằng');
  assert.equal('userId' in created[0], false);
});

void test('GET /api/transactions rejects malformed query parameters', async () => {
  const calls: unknown[] = [];
  const controller = new FinanceController(
    {
      queryTransactions: (query: unknown) => {
        calls.push(query);
        return Promise.resolve({});
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  // actorId() is stubbed below, so the request object itself is never read.
  const req = {} as Request;
  Reflect.set(controller, 'actorId', () => '42');

  await assert.rejects(controller.listTransactions(req, { startAt: 'nope' }), BadRequestException);
  await assert.rejects(controller.listTransactions(req, { limit: '0' }), BadRequestException);
  await assert.rejects(controller.listTransactions(req, { offset: '1.5' }), BadRequestException);
  await assert.rejects(controller.listTransactions(req, { type: 'transfer' }), BadRequestException);
  await assert.rejects(
    controller.listTransactions(req, {
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-09-01T00:00:00.000Z',
    }),
    BadRequestException,
  );
  assert.equal(calls.length, 0);

  await controller.listTransactions(req, {
    type: 'income',
    startAt: '2026-09-01T00:00:00.000Z',
    limit: '50',
    offset: '100',
    search: ' lương ',
  });
  assert.deepEqual(calls[0], {
    type: 'income',
    startAt: '2026-09-01T00:00:00.000Z',
    endAt: undefined,
    search: 'lương',
    categories: undefined,
    note: undefined,
    placeIds: undefined,
    createdByUserIds: undefined,
    hasReceipt: undefined,
    amountMin: undefined,
    amountMax: undefined,
    limit: 50,
    offset: 100,
  });
});

void test('GET /api/transactions parses column filters and rejects malformed ones', async () => {
  const calls: unknown[] = [];
  const controller = new FinanceController(
    {
      queryTransactions: (query: unknown) => {
        calls.push(query);
        return Promise.resolve({});
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const req = {} as Request;
  Reflect.set(controller, 'actorId', () => '42');

  await assert.rejects(
    controller.listTransactions(req, { hasReceipt: 'yes' }),
    BadRequestException,
  );
  await assert.rejects(controller.listTransactions(req, { amountMin: '-1' }), BadRequestException);
  await assert.rejects(
    controller.listTransactions(req, { amountMin: '500', amountMax: '100' }),
    BadRequestException,
  );
  await assert.rejects(
    controller.listTransactions(req, {
      categories: Array.from({ length: 51 }, (_, i) => `c${i}`),
    }),
    BadRequestException,
  );
  assert.equal(calls.length, 0);

  await controller.listTransactions(req, {
    categories: [' Ăn uống ', 'Đi lại', 'Ăn uống', ''],
    note: '  phở ',
    placeIds: 'none',
    createdByUserIds: ['u1'],
    hasReceipt: 'false',
    amountMin: '1000',
    amountMax: '50000',
  });
  assert.deepEqual(calls[0], {
    type: undefined,
    startAt: undefined,
    endAt: undefined,
    search: undefined,
    categories: ['Ăn uống', 'Đi lại'],
    note: 'phở',
    placeIds: ['none'],
    createdByUserIds: ['u1'],
    hasReceipt: false,
    amountMin: 1000,
    amountMax: 50000,
    limit: undefined,
    offset: undefined,
  });
});

void test('queryTransactions applies column filters as AND conditions on every branch', async () => {
  const { service, findAndCountCalls } = createService([]);

  await service.queryTransactions({
    categories: ['Ăn uống'],
    note: 'phở',
    createdByUserIds: ['u1', 'u2'],
    hasReceipt: true,
    amountMin: 10_000,
    placeIds: ['p1', 'none'],
    search: 'bún',
  });

  const where = findAndCountCalls[0].where;
  assert.ok(Array.isArray(where));
  // 2 place branches (ids, no place) x 3 search branches.
  assert.equal(where.length, 6);
  for (const condition of where) {
    assert.ok(condition.createdByUserId);
    assert.ok(condition.receiptUrl);
    assert.ok(condition.amount);
    // The category/note filters survive even on the search branch for the same column.
    assert.ok(condition.category);
    assert.ok(condition.note);
  }
  assert.ok('placeId' in where[0]);
  assert.ok('placeId' in where[3]);
});

void test('queryTransactions lists period creators and categories as filter options', async () => {
  const { service } = createService([]);
  const rows: LedgerRow[] = [
    { ...LEDGER[0], createdByUserId: 'u3', createdByName: 'Ngoài kỳ', category: 'Lương' },
    { ...LEDGER[2], createdByUserId: 'u2', createdByName: 'An', category: 'Đi lại' },
    { ...LEDGER[3], createdByUserId: 'u1', createdByName: 'Cũ', category: 'Ăn uống' },
    { ...LEDGER[4], createdByUserId: 'u1', createdByName: 'Cũ', category: 'Ăn uống' },
    { ...LEDGER[4], id: 'f', createdByUserId: 'u9999', createdByName: null, category: 'Ăn uống' },
  ];
  Reflect.set(service, 'loadLedgerRows', () => Promise.resolve(rows));
  Reflect.set(service, 'userRepo', {
    find: () => Promise.resolve([{ id: 'u1', firstName: 'Bình' }]),
  });

  const result = await service.queryTransactions({ startAt: '2026-09-01T00:00:00.000Z' });

  assert.deepEqual(result.facets.creators, [
    { id: 'u2', name: 'An' },
    { id: 'u1', name: 'Bình' },
    // No profile name and no snapshot: empty name (the web labels it), listed last.
    { id: 'u9999', name: '' },
  ]);
  assert.deepEqual(result.facets.categories, ['Ăn uống', 'Đi lại']);
});

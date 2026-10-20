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

  const result = await service.queryTransactions(42, {
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
  assert.equal(findCalls[0].where && 'userId' in findCalls[0].where, true);
  const where = findAndCountCalls[0].where;
  assert.ok(Array.isArray(where));
  assert.equal(where.length, 1);
  assert.equal(where[0].userId, '42');
  assert.equal(where[0].type, 'expense');
});

void test('queryTransactions searches category, note and place name for the caller only', async () => {
  const { service, findAndCountCalls } = createService([]);

  await service.queryTransactions('42', { search: '  phở ' });

  const where = findAndCountCalls[0].where;
  assert.ok(Array.isArray(where));
  assert.equal(where.length, 3);
  for (const condition of where) assert.equal(condition.userId, '42');
  assert.ok('category' in where[0]);
  assert.ok('note' in where[1]);
  assert.ok('place' in where[2]);
});

void test('queryTransactions clamps limit and offset and reports the total', async () => {
  const { service, findAndCountCalls } = createService([LEDGER[0]], 1234);

  const result = await service.queryTransactions(42, { limit: 10_000, offset: -5 });

  assert.equal(findAndCountCalls[0].take, TRANSACTION_LIST_MAX_LIMIT);
  assert.equal(findAndCountCalls[0].skip, 0);
  assert.equal(result.limit, TRANSACTION_LIST_MAX_LIMIT);
  assert.equal(result.offset, 0);
  assert.equal(result.total, 1234);
});

void test('GET /api/transactions rejects malformed query parameters', async () => {
  const calls: unknown[] = [];
  const controller = new FinanceController(
    {
      queryTransactions: (_userId: unknown, query: unknown) => {
        calls.push(query);
        return Promise.resolve({});
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { resolveLedgerUserId: (id: string | number) => Promise.resolve(String(id)) } as never,
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
    limit: 50,
    offset: 100,
  });
});

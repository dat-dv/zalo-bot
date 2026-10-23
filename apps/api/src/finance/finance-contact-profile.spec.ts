import test from 'node:test';
import assert from 'node:assert/strict';
import type { FindManyOptions } from 'typeorm';
import type { DebtContactEntity } from '../database/entities/debt-contact.entity';
import type { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import type { TransactionTypeTotal } from './contact-profile';
import { FinanceService } from './finance.service';

interface TotalsWhereCall {
  method: 'where' | 'orWhere';
  condition: string;
  parameters: Record<string, unknown>;
}

function contact(overrides: Partial<DebtContactEntity> = {}): DebtContactEntity {
  return {
    id: 'c-hang',
    displayName: 'Diệu Hằng',
    normalizedName: 'dieu hang',
    createdAt: new Date('2026-10-20T09:05:29Z'),
    updatedAt: new Date('2026-10-20T09:05:29Z'),
    ...overrides,
  };
}

function transaction(id: string, createdByUserId: string): FinanceTransactionEntity {
  return {
    id,
    type: 'expense',
    amount: 161_000,
    currency: 'VND',
    category: 'Ăn uống',
    note: id,
    createdByUserId,
    createdByName: 'Diệu Hằng',
    source: 'zalo',
    occurredAt: new Date('2026-10-21T05:00:00Z'),
    createdAt: new Date('2026-10-21T05:00:00Z'),
    updatedAt: new Date('2026-10-21T05:00:00Z'),
  };
}

/** Fake repos: the contact lookup, no debts, and a totals query builder that records its filters. */
function createService(input: {
  contact: DebtContactEntity | null;
  rows?: FinanceTransactionEntity[];
  totals?: TransactionTypeTotal[];
}) {
  const findCalls: FindManyOptions<FinanceTransactionEntity>[] = [];
  const totalsWhere: TotalsWhereCall[] = [];
  const totalsQuery = {
    select: () => totalsQuery,
    addSelect: () => totalsQuery,
    where: (condition: string, parameters: Record<string, unknown>) => {
      totalsWhere.push({ method: 'where', condition, parameters });
      return totalsQuery;
    },
    orWhere: (condition: string, parameters: Record<string, unknown>) => {
      totalsWhere.push({ method: 'orWhere', condition, parameters });
      return totalsQuery;
    },
    groupBy: () => totalsQuery,
    getRawMany: () => Promise.resolve(input.totals ?? []),
  };
  const transactionRepo = {
    find: (options: FindManyOptions<FinanceTransactionEntity>) => {
      findCalls.push(options);
      return Promise.resolve(input.rows ?? []);
    },
    createQueryBuilder: () => totalsQuery,
  };
  const service = new FinanceService(
    transactionRepo as never,
    { find: () => Promise.resolve([]) } as never,
    { findOne: () => Promise.resolve(input.contact) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, findCalls, totalsWhere };
}

void test('profile of a linked contact also lists and totals what its Zalo user recorded', async () => {
  const { service, findCalls, totalsWhere } = createService({
    contact: contact({ linkedUserId: '5369142156728714489' }),
    rows: [transaction('t-1', '5369142156728714489'), transaction('t-2', '5369142156728714489')],
    totals: [{ type: 'expense', count: '2', total: '459620' }],
  });

  const profile = await service.getContactProfile('c-hang', false);

  assert.deepEqual(findCalls[0]?.where, [
    { contactId: 'c-hang' },
    { createdByUserId: '5369142156728714489' },
  ]);
  assert.deepEqual(totalsWhere, [
    { method: 'where', condition: 't.contact_id = :id', parameters: { id: 'c-hang' } },
    {
      method: 'orWhere',
      condition: 't.created_by_user_id = :linkedUserId',
      parameters: { linkedUserId: '5369142156728714489' },
    },
  ]);
  assert.deepEqual(
    profile?.recentTransactions.map((item) => item.id),
    ['t-1', 't-2'],
  );
  assert.equal(profile?.summary.transactionCount, 2);
  assert.equal(profile?.summary.expenseTotal, 459_620);
});

void test('profile of an unlinked contact keeps matching transactions by contact only', async () => {
  const { service, findCalls, totalsWhere } = createService({ contact: contact() });

  const profile = await service.getContactProfile('c-hang', false);

  assert.deepEqual(findCalls[0]?.where, [{ contactId: 'c-hang' }]);
  assert.deepEqual(
    totalsWhere.map((call) => call.method),
    ['where'],
  );
  assert.equal(profile?.summary.transactionCount, 0);
});

void test('profile of a missing contact is null so the controller answers 404', async () => {
  const { service, findCalls } = createService({ contact: null });

  assert.equal(await service.getContactProfile('missing', false), null);
  assert.equal(findCalls.length, 0);
});

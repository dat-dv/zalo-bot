import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AUDIT_TECHNICAL_TABLES } from '@zalobot/contracts';
import { Brackets, type FindOperator } from 'typeorm';
import type { AuditLogEntity } from '../database/entities/audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

interface Recorded {
  wheres: Array<{ condition: string; params?: Record<string, unknown> }>;
  orders: string[];
  skip?: number;
  take?: number;
  findOptions?: unknown;
}

/** Just enough of TypeORM's query builder to record the filters the service applies. */
function fakeAuditRepo(
  rows: AuditLogEntity[],
  actorIds: string[],
  recorded: Recorded,
  savedNames: Record<string, string> = {},
) {
  const builder = {
    andWhere(condition: string | Brackets, params?: Record<string, unknown>) {
      if (condition instanceof Brackets) {
        const inner = {
          orWhere(text: string, innerParams?: Record<string, unknown>) {
            recorded.wheres.push({ condition: `OR ${text}`, params: innerParams });
            return inner;
          },
        };
        condition.whereFactory(inner as never);
      } else {
        recorded.wheres.push({ condition, params });
      }
      return builder;
    },
    orderBy(field: string, order: string) {
      recorded.orders.push(`${field} ${order}`);
      return builder;
    },
    addOrderBy(field: string, order: string) {
      recorded.orders.push(`${field} ${order}`);
      return builder;
    },
    skip(value: number) {
      recorded.skip = value;
      return builder;
    },
    take(value: number) {
      recorded.take = value;
      return builder;
    },
    getManyAndCount: () => Promise.resolve([rows, rows.length + 100]),
    select: () => builder,
    addSelect: () => builder,
    where: () => builder,
    groupBy: () => builder,
    getRawMany: () =>
      Promise.resolve(
        actorIds.map((actorId) => ({ actorId, actorName: savedNames[actorId] ?? null })),
      ),
  };
  return {
    createQueryBuilder: () => builder,
    findOne: () => Promise.resolve(rows[0] ?? null),
    find: (options: unknown) => {
      recorded.findOptions = options;
      return Promise.resolve(rows);
    },
  };
}

function row(overrides: Partial<AuditLogEntity>): AuditLogEntity {
  return {
    id: 'log1',
    tableName: 'finance_transactions',
    recordId: 'tx1',
    action: 'update',
    actorId: 'u2',
    actorSource: 'zalo',
    channelId: 'g1',
    beforeData: { amount: 1, note: 'a' },
    afterData: { amount: 2, note: 'a' },
    createdAt: new Date('2026-10-23T01:02:03.000Z'),
    ...overrides,
  };
}

function service(
  rows: AuditLogEntity[],
  actorIds: string[],
  recorded: Recorded,
  savedNames: Record<string, string> = {},
) {
  const users = {
    find: () =>
      Promise.resolve([
        { id: 'u2', firstName: 'Bình' },
        { id: 'dashboard-owner', firstName: null },
      ]),
  };
  const chats = {
    find: () => Promise.resolve([{ threadId: 'g1', threadName: 'Nhà', threadType: 'group' }]),
  };
  return new AuditService(
    fakeAuditRepo(rows, actorIds, recorded, savedNames) as never,
    users as never,
    chats as never,
  );
}

void test('the default list hides technical tables and pages newest first', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  await service([], [], recorded).list({ limit: 50, offset: 100 });
  assert.deepEqual(recorded.wheres, [
    {
      condition: 'log.tableName NOT IN (:...technical)',
      params: { technical: [...AUDIT_TECHNICAL_TABLES] },
    },
  ]);
  assert.deepEqual(recorded.orders, ['log.createdAt DESC', 'log.id DESC']);
  assert.equal(recorded.skip, 100);
  assert.equal(recorded.take, 50);
});

void test('picking tables replaces the technical filter; legacy matches a missing source', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  await service([], [], recorded).list({
    tables: ['user_tokens'],
    sources: ['zalo', 'legacy'],
    recordId: 'tx1',
  });
  assert.deepEqual(
    recorded.wheres.map((where) => where.condition),
    [
      'log.tableName IN (:...tables)',
      'OR log.actorSource IN (:...sources)',
      'OR log.actorSource IS NULL',
      'log.recordId = :recordId',
    ],
  );
  assert.deepEqual(recorded.wheres[1].params, { sources: ['zalo'] });
});

void test('items carry actor and chat names, changed fields and the actor facet', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  const result = await service(
    [row({}), row({ id: 'log2', actorId: 'dashboard-owner', actorSource: null, channelId: null })],
    ['dashboard-owner', 'u2', 'u9'],
    recorded,
  ).list({});
  assert.equal(result.total, 102);
  assert.deepEqual(result.items[0], {
    id: 'log1',
    tableName: 'finance_transactions',
    recordId: 'tx1',
    action: 'update',
    actorId: 'u2',
    actorName: 'Bình',
    actorIsOwner: false,
    actorSource: 'zalo',
    channelId: 'g1',
    channelName: 'Nhà',
    channelType: 'group',
    changedFields: ['amount'],
    createdAt: '2026-10-23T01:02:03.000Z',
  });
  assert.equal(result.items[1].actorIsOwner, true);
  assert.equal(result.items[1].actorSource, null);
  assert.equal(result.items[1].channelType, null);
  assert.deepEqual(result.facets.actors, [
    { id: 'dashboard-owner', name: '', isOwner: true },
    { id: 'u2', name: 'Bình', isOwner: false },
    { id: 'u9', name: '', isOwner: false },
  ]);
});

void test('actor names: ZCA directory, then the name saved on the row, then first_name', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  const asked: string[][] = [];
  const resolveNames = (ids: string[]) => {
    asked.push(ids);
    return Promise.resolve(new Map([['u3', 'Cường (danh bạ)']]));
  };
  const result = await service(
    [
      row({ actorId: 'u2', actorName: 'Bình lúc đó' }),
      row({ id: 'log2', actorId: 'u3', actorName: 'Cường lúc đó' }),
      row({ id: 'log3', actorId: 'u2', actorName: null }),
      row({ id: 'log4', actorId: 'u9', actorName: '  ' }),
    ],
    ['u2', 'u3', 'u9'],
    recorded,
    { u2: 'Bình lúc đó', u9: 'Chín' },
  ).list({}, resolveNames);

  assert.deepEqual(
    result.items.map((item) => item.actorName),
    ['Bình lúc đó', 'Cường (danh bạ)', 'Bình', ''],
  );
  assert.deepEqual(
    result.facets.actors.map((actor) => actor.name),
    ['Bình lúc đó', 'Cường (danh bạ)', 'Chín'],
  );
  assert.deepEqual(asked, [['u2', 'u3', 'u9']]);
});

void test('an unreadable ZCA directory falls back to the saved names', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  const detail = await service([row({ actorName: 'Bình lúc đó' })], [], recorded).get('log1', () =>
    Promise.reject(new Error('ZCA offline')),
  );
  assert.equal(detail?.actorName, 'Bình lúc đó');
});

void test('the home page activity leaves out the technical tables', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  await service([], [], recorded).listRecent(42, 10);
  const options = recorded.findOptions as {
    where: { actorId: string; tableName: FindOperator<string> };
    take: number;
  };
  assert.equal(options.where.actorId, '42');
  assert.equal(options.where.tableName.type, 'not');
  // FindOperator.value unwraps the nested In(...).
  assert.deepEqual(options.where.tableName.value, [...AUDIT_TECHNICAL_TABLES]);
  assert.equal(options.take, 10);
});

void test('the detail returns the before and after data', async () => {
  const recorded: Recorded = { wheres: [], orders: [] };
  const detail = await service([row({})], [], recorded).get('log1');
  assert.deepEqual(detail?.beforeData, { amount: 1, note: 'a' });
  assert.deepEqual(detail?.afterData, { amount: 2, note: 'a' });
});

void test('only admins may read the activity log', async () => {
  const controller = new AuditController(
    { list: () => Promise.resolve(null) } as never,
    { verifyAccessToken: () => 'u1' } as never,
    { isAdmin: () => false } as never,
  );
  const req = { headers: { authorization: 'Bearer token' } } as never;
  await assert.rejects(controller.list(req, {}), ForbiddenException);
  await assert.rejects(controller.get(req, 'log1'), ForbiddenException);
});

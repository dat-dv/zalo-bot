import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AUDIT_TECHNICAL_TABLES } from '@zalobot/contracts';
import { Brackets } from 'typeorm';
import type { AuditLogEntity } from '../database/entities/audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

interface Recorded {
  wheres: Array<{ condition: string; params?: Record<string, unknown> }>;
  orders: string[];
  skip?: number;
  take?: number;
}

/** Just enough of TypeORM's query builder to record the filters the service applies. */
function fakeAuditRepo(rows: AuditLogEntity[], actorIds: string[], recorded: Recorded) {
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
    where: () => builder,
    getRawMany: () => Promise.resolve(actorIds.map((actorId) => ({ actorId }))),
  };
  return { createQueryBuilder: () => builder, findOne: () => Promise.resolve(rows[0] ?? null) };
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

function service(rows: AuditLogEntity[], actorIds: string[], recorded: Recorded) {
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
    fakeAuditRepo(rows, actorIds, recorded) as never,
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

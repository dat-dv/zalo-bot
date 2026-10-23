import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AUDIT_LOG_DEFAULT_LIMIT, AUDIT_LOG_MAX_LIMIT } from '@zalobot/contracts';
import { computeChangedFields, parseAuditLogListQuery } from './audit-log-query';

void test('an empty query gets the default page and hides nothing explicitly', () => {
  assert.deepEqual(parseAuditLogListQuery({}), {
    tables: undefined,
    actions: undefined,
    sources: undefined,
    actorIds: undefined,
    recordId: undefined,
    startAt: undefined,
    endAt: undefined,
    includeTechnical: false,
    limit: AUDIT_LOG_DEFAULT_LIMIT,
    offset: 0,
  });
});

void test('repeated keys become lists, single values too', () => {
  const query = parseAuditLogListQuery({
    tables: ['finance_transactions', 'debts', 'debts'],
    actions: 'remove',
    sources: ['zalo', 'legacy'],
    actorIds: ' u1 ',
    recordId: ' tx1 ',
    includeTechnical: 'true',
    limit: '500',
    offset: '50',
  });
  assert.deepEqual(query.tables, ['finance_transactions', 'debts']);
  assert.deepEqual(query.actions, ['remove']);
  assert.deepEqual(query.sources, ['zalo', 'legacy']);
  assert.deepEqual(query.actorIds, ['u1']);
  assert.equal(query.recordId, 'tx1');
  assert.equal(query.includeTechnical, true);
  assert.equal(query.limit, AUDIT_LOG_MAX_LIMIT);
  assert.equal(query.offset, 50);
});

void test('unknown tables, actions or sources are rejected', () => {
  assert.throws(() => parseAuditLogListQuery({ tables: 'pg_user' }), BadRequestException);
  assert.throws(() => parseAuditLogListQuery({ actions: 'drop' }), BadRequestException);
  assert.throws(() => parseAuditLogListQuery({ sources: 'cron' }), BadRequestException);
});

void test('dates must parse and come in order', () => {
  const query = parseAuditLogListQuery({ startAt: '2026-10-01', endAt: '2026-10-23T23:59:59Z' });
  assert.equal(query.startAt, '2026-10-01T00:00:00.000Z');
  assert.throws(() => parseAuditLogListQuery({ startAt: 'yesterday' }), BadRequestException);
  assert.throws(
    () => parseAuditLogListQuery({ startAt: '2026-10-23', endAt: '2026-10-01' }),
    BadRequestException,
  );
  assert.throws(() => parseAuditLogListQuery({ limit: '0' }), BadRequestException);
});

void test('changed fields: an update compares before and after, ignoring updatedAt', () => {
  assert.deepEqual(
    computeChangedFields(
      'update',
      { id: 'a', amount: 1, note: 'x', meta: { a: 1 }, updatedAt: '1' },
      { id: 'a', amount: 2, note: 'x', meta: { a: 2 }, updatedAt: '2' },
    ),
    ['amount', 'meta'],
  );
});

void test('changed fields: a bulk update lists what it wrote; insert and remove list none', () => {
  assert.deepEqual(computeChangedFields('update', undefined, { sentAt: 'now', updatedAt: 'n' }), [
    'sentAt',
  ]);
  assert.deepEqual(computeChangedFields('insert', undefined, { id: 'a' }), []);
  assert.deepEqual(computeChangedFields('remove', { id: 'a' }, undefined), []);
});

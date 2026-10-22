import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditContext } from '../audit/audit-context';
import { AuditLogSubscriber } from './audit-log.subscriber';
import type { AuditLogEntity } from './entities/audit-log.entity';

function fakeEvent(tableName: string, entity: Record<string, unknown>, saved: AuditLogEntity[]) {
  return {
    metadata: { tableName, primaryColumns: [{ propertyName: 'id' }] },
    manager: {
      getRepository: () => ({
        save: (row: AuditLogEntity) => {
          saved.push(row);
          return Promise.resolve(row);
        },
      }),
    },
    entity,
  } as never;
}

void test('the actor comes from the audit context, not from the row creator', async () => {
  const saved: AuditLogEntity[] = [];
  const row = { id: 'tx1', createdByUserId: 'creator', amount: 1 };
  await AuditContext.run({ source: 'dashboard', actorId: 'editor' }, () =>
    new AuditLogSubscriber().afterInsert(fakeEvent('finance_transactions', row, saved)),
  );
  assert.equal(saved.length, 1);
  assert.equal(saved[0].recordId, 'tx1');
  assert.equal(saved[0].actorId, 'editor');
  assert.equal(saved[0].actorSource, 'dashboard');
  assert.equal(saved[0].channelId, null);
});

void test('a Zalo write keeps the sender and the chat', async () => {
  const saved: AuditLogEntity[] = [];
  await AuditContext.run({ source: 'zalo', actorId: 'sender', channelId: 'group1' }, () =>
    new AuditLogSubscriber().afterInsert(fakeEvent('tasks', { id: 't1' }, saved)),
  );
  assert.equal(saved[0].actorId, 'sender');
  assert.equal(saved[0].actorSource, 'zalo');
  assert.equal(saved[0].channelId, 'group1');
});

void test('without a context the write is the system, even if the row names a user', async () => {
  const saved: AuditLogEntity[] = [];
  await new AuditLogSubscriber().afterInsert(
    fakeEvent('reminders', { id: 'r1', userId: 'owner' }, saved),
  );
  assert.equal(saved[0].actorId, null);
  assert.equal(saved[0].actorSource, 'system');
});

void test('chat memory rows are not audited', async () => {
  const saved: AuditLogEntity[] = [];
  await new AuditLogSubscriber().afterInsert(fakeEvent('zca_messages', { id: 'm1' }, saved));
  assert.equal(saved.length, 0);
});

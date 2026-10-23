import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditContext, zaloAuditContext } from './audit-context';

void test('there is no context outside a run, and setActor is then a no-op', () => {
  AuditContext.setActor('u1');
  assert.equal(AuditContext.current(), undefined);
});

void test('a dashboard request learns its actor once the token is verified', async () => {
  await AuditContext.run({ source: 'dashboard' }, async () => {
    assert.deepEqual(AuditContext.current(), { source: 'dashboard' });
    await Promise.resolve();
    AuditContext.setActor('u1');
    await Promise.resolve();
    assert.deepEqual(AuditContext.current(), { source: 'dashboard', actorId: 'u1' });
  });
});

void test('runAsSystem drops the actor of the surrounding request', async () => {
  await AuditContext.run({ source: 'zalo', actorId: 'u1', channelId: 'c1' }, async () => {
    await AuditContext.runAsSystem(async () => {
      await Promise.resolve();
      assert.deepEqual(AuditContext.current(), { source: 'system' });
    });
    assert.equal(AuditContext.current()?.actorId, 'u1');
  });
});

void test('run copies the store so a nested setActor does not leak out', () => {
  const outer = { source: 'zalo' as const, actorId: 'u1' };
  AuditContext.run(outer, () => {
    AuditContext.run({ source: 'dashboard' }, () => AuditContext.setActor('u2'));
    assert.equal(AuditContext.current()?.actorId, 'u1');
  });
  assert.equal(outer.actorId, 'u1');
});

void test('zaloAuditContext accepts zca ids as strings or numbers', () => {
  assert.deepEqual(zaloAuditContext(' 123 ', 456), {
    source: 'zalo',
    actorId: '123',
    channelId: '456',
  });
  assert.deepEqual(zaloAuditContext(undefined, ''), {
    source: 'zalo',
    actorId: undefined,
    channelId: undefined,
  });
});

void test('zaloAuditContext keeps the trimmed sender name, and only a real one', () => {
  assert.deepEqual(zaloAuditContext('1', '2', ' Văn Đạt '), {
    source: 'zalo',
    actorId: '1',
    actorName: 'Văn Đạt',
    channelId: '2',
  });
  assert.equal(zaloAuditContext('1', '2', '   ').actorName, undefined);
  assert.equal(zaloAuditContext('1', '2', 42).actorName, undefined);
});

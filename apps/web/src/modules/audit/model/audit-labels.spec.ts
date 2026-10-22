import assert from 'node:assert/strict';
import test from 'node:test';
import { translate, type TranslationKey } from '@zalobot/contracts';
import {
  buildAuditDiffRows,
  describeAuditActor,
  describeAuditChannel,
  describeAuditTable,
  formatAuditValue,
} from './audit-labels';

const t = (key: TranslationKey, values?: Record<string, string | number>) =>
  translate('vi', key, values);

void test('actor names: profile name, owner, unnamed id, system, unknown', () => {
  const base = { actorId: null, actorName: '', actorIsOwner: false, actorSource: null } as const;
  assert.equal(describeAuditActor({ ...base, actorId: 'u1', actorName: 'An' }, t), 'An');
  assert.equal(
    describeAuditActor({ ...base, actorId: 'dashboard-owner', actorIsOwner: true }, t),
    'Chủ hệ thống (mã đăng nhập)',
  );
  assert.equal(describeAuditActor({ ...base, actorId: '1234567' }, t), 'Chưa rõ tên (…4567)');
  assert.equal(describeAuditActor({ ...base, actorSource: 'system' }, t), 'Hệ thống');
  assert.equal(describeAuditActor({ ...base, actorSource: 'dashboard' }, t), 'Không xác định');
});

void test('channels and tables read like the rest of the dashboard', () => {
  assert.equal(
    describeAuditChannel({ channelId: 'g', channelName: 'Nhà', channelType: 'group' }, t),
    'Nhóm Nhà',
  );
  assert.equal(
    describeAuditChannel({ channelId: 'u', channelName: '', channelType: null }, t),
    'Chat riêng',
  );
  assert.equal(
    describeAuditChannel({ channelId: null, channelName: '', channelType: null }, t),
    '',
  );
  assert.equal(describeAuditTable('finance_transactions', t), 'Giao dịch thu chi');
  assert.equal(describeAuditTable('legacy_table', t), 'legacy_table');
});

void test('diff rows put changed fields first and format values', () => {
  const rows = buildAuditDiffRows({
    beforeData: { id: 'a', amount: 1, note: null, tags: ['x'] },
    afterData: { id: 'a', amount: 2, note: null, tags: ['x'], placeId: 'p' },
    changedFields: ['amount', 'placeId'],
  });
  assert.deepEqual(rows, [
    { field: 'amount', before: '1', after: '2', changed: true },
    { field: 'placeId', before: '—', after: 'p', changed: true },
    { field: 'id', before: 'a', after: 'a', changed: false },
    { field: 'note', before: '—', after: '—', changed: false },
    { field: 'tags', before: '["x"]', after: '["x"]', changed: false },
  ]);
  assert.equal(formatAuditValue(false), 'false');
});

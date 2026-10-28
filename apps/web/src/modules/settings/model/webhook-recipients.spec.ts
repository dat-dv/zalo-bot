import assert from 'node:assert/strict';
import test from 'node:test';
import type { IWebhookRecipient } from '@zalobot/contracts';
import {
  buildWebhookRecipientRows,
  filterWebhookRecipientRows,
  isSameRecipientSet,
  toggleWebhookRecipient,
} from './webhook-recipients';

const THREADS = [
  { id: 'u1', name: 'Bình', type: 'user' as const },
  { id: 'g1', name: 'Kế toán', type: 'group' as const },
  { id: 'u2', name: 'An', type: 'user' as const },
];

function draftOf(...recipients: IWebhookRecipient[]) {
  return new Map(recipients.map((recipient) => [recipient.threadId, recipient]));
}

void test('buildWebhookRecipientRows lists picked chats first and keeps ones Zalo dropped', () => {
  const rows = buildWebhookRecipientRows(
    [...THREADS, { id: 'left', name: 'Nhóm đã rời', type: 'group', missingFromZalo: true }],
    draftOf(
      { threadId: 'u1', threadName: 'Bình', threadType: 'user' },
      { threadId: 'gone', threadName: 'Nhóm cũ', threadType: 'group' },
    ),
  );

  assert.deepEqual(
    rows.map((row) => [row.id, row.selected, row.missing]),
    [
      ['gone', true, true],
      ['u1', true, false],
      ['g1', false, false],
      ['u2', false, false],
    ],
  );
});

void test('filterWebhookRecipientRows filters by type, selection and accent-free search', () => {
  const rows = buildWebhookRecipientRows(
    THREADS,
    draftOf({ threadId: 'u2', threadName: 'An', threadType: 'user' }),
  );

  assert.deepEqual(
    filterWebhookRecipientRows(rows, 'group', '').map((row) => row.id),
    ['g1'],
  );
  assert.deepEqual(
    filterWebhookRecipientRows(rows, 'selected', '').map((row) => row.id),
    ['u2'],
  );
  assert.deepEqual(
    filterWebhookRecipientRows(rows, 'all', 'ke toan').map((row) => row.id),
    ['g1'],
  );
  assert.deepEqual(
    filterWebhookRecipientRows(rows, 'all', 'u1').map((row) => row.id),
    ['u1'],
  );
});

void test('toggleWebhookRecipient adds and removes a chat without touching the input', () => {
  const draft = draftOf();
  const [row] = buildWebhookRecipientRows([THREADS[1]], draft);

  const added = toggleWebhookRecipient(draft, row);
  assert.deepEqual(added.get('g1'), { threadId: 'g1', threadName: 'Kế toán', threadType: 'group' });
  assert.equal(draft.size, 0);
  assert.equal(toggleWebhookRecipient(added, { ...row, selected: true }).size, 0);
});

void test('isSameRecipientSet ignores order', () => {
  const a: IWebhookRecipient = { threadId: 'a', threadName: null, threadType: 'user' };
  const b: IWebhookRecipient = { threadId: 'b', threadName: null, threadType: 'group' };

  assert.equal(isSameRecipientSet(draftOf(a, b), [b, a]), true);
  assert.equal(isSameRecipientSet(draftOf(a), [a, b]), false);
});

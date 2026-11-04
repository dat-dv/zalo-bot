import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FinanceTransactionEntity } from '../../../database/entities/finance-transaction.entity';
import type { FinanceService } from '../../../finance/finance.service';
import type { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import {
  describeTransactionChanges,
  type EditTransactionPayload,
} from '../../confirmation/dto-descriptor.util';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { TextToolContext } from '../text-tool.interface';
import { pendingToolArgs } from '../pending-edit-args.util';
import { findTransactionTargets } from '../transaction-target';
import {
  EditTransactionToolStrategy,
  pickTransactionChanges,
} from './edit-transaction-tool.strategy';

const lunch = {
  id: '88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
  type: 'expense',
  amount: 45_000,
  currency: 'VND',
  category: 'Ăn uống',
  note: 'ăn trưa',
  occurredAt: new Date('2026-11-03T05:00:00Z'),
} as FinanceTransactionEntity;
const lunchToo = { ...lunch, id: '11111111-5e4a-4f10-af57-48fcb57e48b7', amount: 60_000 };

function setup(rows: FinanceTransactionEntity[]) {
  const replies: string[] = [];
  const pendings: EditTransactionPayload[] = [];
  const finance = {
    getTransaction: (id: string) => Promise.resolve(rows.find((row) => row.id === id) ?? null),
    getLatestTransaction: () => Promise.resolve(rows[0] ?? null),
    listTransactions: () => Promise.resolve(rows),
  } as unknown as FinanceService;
  const strategy = new EditTransactionToolStrategy(
    {
      sendMessage: (_id: string, message: string) => {
        replies.push(message);
        return Promise.resolve(true);
      },
    } as unknown as ZcaMessengerService,
    finance,
    {
      createPendingEdit: (params: { payload: EditTransactionPayload }) => {
        pendings.push(params.payload);
        return Promise.resolve();
      },
    } as unknown as TransactionConfirmationService,
  );
  const run = (toolArgs: Record<string, unknown>) =>
    strategy.execute({
      chatId: 'c1',
      senderId: 'u1',
      text: '',
      toolArgs,
    } as unknown as TextToolContext);
  return { replies, pendings, run, finance };
}

void test('one match opens a card with only the fields that change', async () => {
  const { pendings, replies, run } = setup([lunch]);
  await run({ query: 'ăn trưa', amount: 50_000, category: 'Ăn uống' });

  assert.equal(replies.length, 0);
  assert.equal(pendings[0].transactionId, lunch.id);
  assert.deepEqual(pendings[0].changes, { amount: 50_000 });
});

void test('several matches are listed with ids and nothing changes', async () => {
  const { pendings, replies, run } = setup([lunch, lunchToo]);
  await run({ query: 'ăn trưa', amount: 50_000 });

  assert.equal(pendings.length, 0);
  assert.ok(replies[0].includes(lunch.id));
  assert.ok(replies[0].includes(lunchToo.id));
});

void test('an id resolves the choice between several matches', async () => {
  const { pendings, run } = setup([lunch, lunchToo]);
  await run({ transactionId: lunchToo.id, query: 'ăn trưa', amount: 50_000 });

  assert.equal(pendings[0].transactionId, lunchToo.id);
});

void test('no match and no change are both said out loud', async () => {
  const none = setup([]);
  await none.run({ query: 'ăn trưa', amount: 50_000 });
  assert.match(none.replies[0], /Không tìm thấy/);

  const same = setup([lunch]);
  await same.run({ query: 'ăn trưa', amount: 45_000 });
  assert.equal(same.pendings.length, 0);
  assert.match(same.replies[0], /bạn muốn sửa gì/);
});

void test('a non-uuid id falls through to the query instead of reaching the database', async () => {
  const { finance } = setup([lunch]);
  const rows = await findTransactionTargets(finance, {
    args: { transactionId: 'abc', query: 'ăn trưa' },
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    [lunch.id],
  );
});

void test('invalid values never become changes', () => {
  assert.deepEqual(
    pickTransactionChanges({ amount: -5, occurredAt: 'hôm qua', type: 'gift' }, lunch),
    {},
  );
});

void test('the card shows old and new values', () => {
  const parts = describeTransactionChanges({
    transactionId: lunch.id,
    type: 'expense',
    amount: 45_000,
    currency: 'VND',
    category: 'Ăn uống',
    note: 'ăn trưa',
    changes: { amount: 50_000, category: 'Đi lại' },
  });
  assert.equal(parts.length, 2);
  assert.match(parts[0], /45\.000.*→.*50\.000/);
  assert.match(parts[1], /Ăn uống → Đi lại/);
});

void test('an amend sees the card as tool args, keeping the target', () => {
  assert.deepEqual(
    pendingToolArgs('EDIT_TRANSACTION', {
      transactionId: lunch.id,
      changes: { amount: 50_000 },
    }),
    { transactionId: lunch.id, amount: 50_000 },
  );
});

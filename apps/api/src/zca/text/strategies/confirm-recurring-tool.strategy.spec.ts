import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { RecurringOccurrenceEntity } from '../../../database/entities/recurring-occurrence.entity';
import type { RecurringTransactionService } from '../../../finance/recurring/recurring-transaction.service';
import type { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import type { ConfirmRecurringPayload } from '../../confirmation/dto-descriptor.util';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import { recurringNotice } from '../../recurring/recurring-scan.processor';
import type { TextToolContext } from '../text-tool.interface';
import { ConfirmRecurringToolStrategy } from './confirm-recurring-tool.strategy';

const occurrence = (note: string, amount: number | null) =>
  ({
    id: `o-${note}`,
    status: 'due',
    amount,
    dueAt: new Date('2026-11-05T01:00:00Z'),
    rule: { note, type: 'expense', category: 'Nhà cửa' },
  }) as RecurringOccurrenceEntity;

function setup(rows: RecurringOccurrenceEntity[]) {
  const replies: string[] = [];
  const pendings: ConfirmRecurringPayload[] = [];
  const strategy = new ConfirmRecurringToolStrategy(
    {
      sendMessage: (_id: string, text: string) => {
        replies.push(text);
        return Promise.resolve(true);
      },
    } as unknown as ZcaMessengerService,
    { findDue: () => Promise.resolve(rows) } as unknown as RecurringTransactionService,
    {
      createPendingRecurring: (params: { payload: ConfirmRecurringPayload }) => {
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
  return { replies, pendings, run };
}

void test('the amount of the message overrides the expected one', async () => {
  const { pendings, run } = setup([occurrence('tiền điện', 1_000_000)]);
  await run({ query: 'tiền điện', amount: 1_200_000 });
  assert.equal(pendings[0].amount, 1_200_000);
  assert.equal(pendings[0].skip, false);
});

void test('a period with no amount asks instead of guessing', async () => {
  const { pendings, replies, run } = setup([occurrence('tiền điện', null)]);
  await run({ query: 'tiền điện' });
  assert.equal(pendings.length, 0);
  assert.match(replies[0], /bao nhiêu tiền/);
});

void test('skipping needs no amount', async () => {
  const { pendings, run } = setup([occurrence('tiền điện', null)]);
  await run({ query: 'tiền điện', skip: true });
  assert.equal(pendings[0].skip, true);
});

void test('several waiting periods are listed, none is picked', async () => {
  const { pendings, replies, run } = setup([occurrence('điện', 1), occurrence('nước', 2)]);
  await run({ query: '' });
  assert.equal(pendings.length, 0);
  assert.match(replies[0], /Có 2 khoản/);
});

void test('the notice tells how to answer a waiting period', () => {
  assert.match(recurringNotice(occurrence('tiền điện', null)), /đã đóng tiền điện/);
  assert.match(
    recurringNotice({ ...occurrence('tiền nhà', 5_000_000), status: 'recorded' }),
    /Đã tự ghi tiền nhà 5\.000\.000đ/,
  );
});

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  draftToRequest,
  emptyRecurringDraft,
  isRecurringDraftValid,
  parseAmountInput,
} from './recurring-form';

void test('amounts accept dots and reject zero', () => {
  assert.equal(parseAmountInput('1.200.000'), 1_200_000);
  assert.equal(parseAmountInput('0'), null);
  assert.equal(parseAmountInput(''), null);
});

void test('a self-recording rule needs an amount, a waiting one does not', () => {
  const draft = { ...emptyRecurringDraft(), note: 'Tiền điện' };
  assert.equal(isRecurringDraftValid(draft), false);
  assert.equal(isRecurringDraftValid({ ...draft, mode: 'confirm' }), true);
  assert.equal(isRecurringDraftValid({ ...draft, amount: '500000' }), true);
});

void test('a rule needs a name', () => {
  assert.equal(isRecurringDraftValid({ ...emptyRecurringDraft(), amount: '1' }), false);
});

void test('the request sends null for no amount and no chat', () => {
  const request = draftToRequest({ ...emptyRecurringDraft(), note: ' Điện ', mode: 'confirm' });
  assert.equal(request.note, 'Điện');
  assert.equal(request.amount, null);
  assert.equal(request.notifyChatId, null);
});

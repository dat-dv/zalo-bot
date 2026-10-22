import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCreateDebtRequest, matchContact, type DebtCreateDraft } from './debt-create-form';

const contacts = [
  { id: 'c1', displayName: 'Trí', alias: 'Trí Đen' },
  { id: 'c2', displayName: 'Nam' },
];

const draft = (patch: Partial<DebtCreateDraft> = {}): DebtCreateDraft => ({
  direction: 'receivable',
  counterparty: 'Nam',
  counterpartyAlias: '',
  createNewContact: false,
  amount: '200000',
  occurredAt: '',
  dueAt: '',
  note: '',
  ...patch,
});

test('matchContact matches display name or nickname, ignoring case and spaces', () => {
  assert.equal(matchContact(contacts, '  nam ')?.id, 'c2');
  assert.equal(matchContact(contacts, 'trí đen')?.id, 'c1');
  assert.equal(matchContact(contacts, 'Na'), undefined);
  assert.equal(matchContact(contacts, '   '), undefined);
});

test('a matched person is sent by contactId with the stored name and nickname', () => {
  const result = buildCreateDebtRequest(
    draft({ counterparty: 'TRÍ ĐEN', note: ' ăn trưa ' }),
    contacts,
  );
  assert.deepEqual(result, {
    ok: true,
    request: {
      direction: 'receivable',
      amount: 200000,
      note: 'ăn trưa',
      occurredAt: undefined,
      dueAt: undefined,
      contactId: 'c1',
      counterparty: 'Trí',
      counterpartyAlias: 'Trí Đen',
    },
  });
});

test('an unknown name needs explicit consent before creating a new person', () => {
  assert.deepEqual(buildCreateDebtRequest(draft({ counterparty: 'Hùng' }), contacts), {
    ok: false,
    error: 'newContactRequired',
  });
  const result = buildCreateDebtRequest(
    draft({ counterparty: ' Hùng ', counterpartyAlias: ' Hùng béo ', createNewContact: true }),
    contacts,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.request.createNewContact, true);
    assert.equal(result.request.contactId, undefined);
    assert.equal(result.request.counterparty, 'Hùng');
    assert.equal(result.request.counterpartyAlias, 'Hùng béo');
  }
});

test('rejects a missing name and a non-positive amount', () => {
  assert.deepEqual(buildCreateDebtRequest(draft({ counterparty: ' ' }), contacts), {
    ok: false,
    error: 'counterpartyRequired',
  });
  for (const amount of ['', '0', '-5', 'abc']) {
    assert.deepEqual(buildCreateDebtRequest(draft({ amount }), contacts), {
      ok: false,
      error: 'amountInvalid',
    });
  }
});

test('the due date is stored at the end of that day (UTC)', () => {
  const result = buildCreateDebtRequest(draft({ dueAt: '2026-11-01' }), contacts);
  assert.equal(result.ok && result.request.dueAt, '2026-11-01T23:59:59.000Z');
});

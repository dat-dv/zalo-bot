import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContactProfileUpdate } from '@zalobot/contracts';
import type { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { mergeContactProfileFields, summarizeContactProfile } from './contact-profile';

function contact(overrides: Partial<DebtContactEntity>): DebtContactEntity {
  return {
    id: 'c-x',
    displayName: 'X',
    normalizedName: 'x',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

void test('summary counts only open root debts and totals transactions by type', () => {
  const summary = summarizeContactProfile(
    [
      { direction: 'receivable', remainingAmount: 300_000, status: 'active' },
      { direction: 'receivable', remainingAmount: 0, status: 'settled' },
      { direction: 'payable', remainingAmount: 50_000, status: 'active' },
    ],
    [
      { type: 'income', count: '2', total: '1000000' },
      { type: 'expense', count: 3, total: 450_000 },
    ],
  );
  assert.deepEqual(summary, {
    receivableRemaining: 300_000,
    payableRemaining: 50_000,
    openDebtCount: 2,
    debtCount: 3,
    incomeTotal: 1_000_000,
    expenseTotal: 450_000,
    transactionCount: 5,
  });
});

void test('merge fills empty single fields without overwriting the lead', () => {
  const merged = mergeContactProfileFields(contact({ address: 'Hà Nội', relationship: null }), [
    contact({ displayName: 'B', address: 'HCM', relationship: 'friend', birthday: '1990-02-03' }),
  ]);
  assert.equal(merged.address, 'Hà Nội');
  assert.equal(merged.relationship, 'friend');
  assert.equal(merged.birthday, '1990-02-03');
});

void test('merge appends source notes with their origin', () => {
  const merged = mergeContactProfileFields(contact({ notes: 'Hay trả trễ' }), [
    contact({ displayName: 'Trí Đen', notes: 'Làm ở chợ' }),
    contact({ displayName: 'Trống', notes: '   ' }),
  ]);
  assert.equal(merged.notes, 'Hay trả trễ\n\n— Gộp từ Trí Đen:\nLàm ở chợ');
});

void test('merge keeps every source phone/account that is not the lead primary', () => {
  const merged = mergeContactProfileFields(
    contact({
      phoneNumber: '0901 234 567',
      bankAccountNumber: '111111',
      extraPhones: [{ value: '0911111111', label: 'Nhà' }],
    }),
    [
      contact({
        displayName: 'B',
        phoneNumber: '0901234567',
        bankAccountNumber: '222 222',
        bankName: 'MB',
        extraPhones: [{ value: '0922222222' }, { value: '0911 111 111' }],
      }),
      contact({ displayName: 'C', phoneNumber: '0933333333', bankAccountNumber: '111111' }),
    ],
  );
  assert.deepEqual(merged.extraPhones, [
    { value: '0911111111', label: 'Nhà' },
    { value: '0922222222' },
    { value: '0933333333' },
  ]);
  assert.deepEqual(merged.extraBankAccounts, [{ accountNumber: '222222', bankName: 'MB' }]);
});

void test('validate trims, clears empty values and drops blank or duplicate rows', () => {
  const result = validateContactProfileUpdate(
    {
      notes: '  ',
      address: ' 12 Lý Thường Kiệt ',
      relationship: '',
      birthday: '1995-07-20',
      extraPhones: [
        { value: ' 0901  234 567 ', label: ' Công ty ' },
        { value: '' },
        { value: '0901234567' },
      ],
      extraBankAccounts: [{ accountNumber: '0123 4567 89', bankCode: 'vcb' }],
    },
    '2026-10-22',
  );
  assert.deepEqual(result, {
    ok: true,
    value: {
      notes: null,
      address: '12 Lý Thường Kiệt',
      relationship: null,
      birthday: '1995-07-20',
      extraPhones: [{ value: '0901 234 567', label: 'Công ty' }],
      extraBankAccounts: [{ accountNumber: '0123456789', bankCode: 'VCB' }],
    },
  });
});

void test('validate leaves omitted fields out of the update', () => {
  assert.deepEqual(validateContactProfileUpdate({ workplace: 'Shopee' }, '2026-10-22'), {
    ok: true,
    value: { workplace: 'Shopee' },
  });
});

void test('validate reports field errors with the failing row', () => {
  const result = validateContactProfileUpdate(
    {
      birthday: '2030-01-01',
      relationship: 'boss',
      extraPhones: [{ value: '0901234567' }, { value: '12ab' }],
      extraBankAccounts: [{ accountNumber: '12' }],
    },
    '2026-10-22',
  );
  assert.deepEqual(result, {
    ok: false,
    errors: {
      birthday: { code: 'birthday_future' },
      relationship: { code: 'relationship_invalid' },
      extraPhones: { code: 'phone_invalid', index: 1 },
      extraBankAccounts: { code: 'bank_account_invalid', index: 0 },
    },
  });
});

void test('validate rejects impossible dates and non-list values', () => {
  const result = validateContactProfileUpdate(
    { birthday: '2026-02-30', extraPhones: 'x' },
    '2026-10-22',
  );
  assert.deepEqual(result, {
    ok: false,
    errors: { birthday: { code: 'birthday_invalid' }, extraPhones: { code: 'list_invalid' } },
  });
});

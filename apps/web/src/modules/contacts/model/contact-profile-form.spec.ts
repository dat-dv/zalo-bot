import test from 'node:test';
import assert from 'node:assert/strict';
import type { IContactProfile } from '@zalobot/contracts';
import {
  toBaseContactUpdate,
  toContactProfileForm,
  validateContactProfileForm,
} from './contact-profile-form';

const CONTACT: IContactProfile = {
  id: 'c-1',
  displayName: 'Trí',
  alias: 'Trí Đen',
  phoneNumber: '0901234567',
  notes: null,
  birthday: '1990-01-02',
  address: null,
  workplace: null,
  relationship: 'friend',
  extraPhones: [{ value: '0911111111', label: 'Nhà' }],
  extraBankAccounts: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

void test('an untouched form sends no base contact update', () => {
  assert.equal(toBaseContactUpdate(CONTACT, toContactProfileForm(CONTACT)), undefined);
});

void test('an empty primary phone keeps the current value, so it is not a change', () => {
  const form = { ...toContactProfileForm(CONTACT), phoneNumber: '' };
  assert.equal(toBaseContactUpdate(CONTACT, form), undefined);
});

void test('renaming sends the whole base contact body', () => {
  const form = { ...toContactProfileForm(CONTACT), displayName: ' Trí Trắng ' };
  assert.deepEqual(toBaseContactUpdate(CONTACT, form), {
    displayName: 'Trí Trắng',
    alias: 'Trí Đen',
    descriptor: undefined,
    phoneNumber: '0901234567',
    bankAccountNumber: undefined,
    bankName: undefined,
  });
});

void test('form validation normalizes profile fields and drops blank rows', () => {
  const form = {
    ...toContactProfileForm(CONTACT),
    notes: ' Hay quên ',
    relationship: '' as const,
    extraPhones: [
      { value: '0911111111', label: 'Nhà' },
      { value: '', label: '' },
    ],
  };
  assert.deepEqual(validateContactProfileForm(form, '2026-10-22'), {
    ok: true,
    profile: {
      notes: 'Hay quên',
      birthday: '1990-01-02',
      address: null,
      workplace: null,
      relationship: null,
      extraPhones: [{ value: '0911111111', label: 'Nhà' }],
      extraBankAccounts: [],
    },
  });
});

void test('form validation requires a name and reports the bad phone row', () => {
  const form = {
    ...toContactProfileForm(CONTACT),
    displayName: '  ',
    extraPhones: [{ value: 'abc', label: '' }],
  };
  assert.deepEqual(validateContactProfileForm(form, '2026-10-22'), {
    ok: false,
    errors: { displayName: 'required', extraPhones: { code: 'phone_invalid', index: 0 } },
  });
});

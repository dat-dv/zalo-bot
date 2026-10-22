import {
  CONTACT_PROFILE_LIMITS,
  validateContactProfileUpdate,
  type ContactProfileUpdateError,
  type ContactProfileUpdateErrors,
  type ContactRelationship,
  type IContactProfile,
  type IUpdateContactProfileRequest,
  type IUpdateContactRequest,
} from '@zalobot/contracts';

export interface PhoneRow {
  value: string;
  label: string;
}

export interface BankAccountRow {
  accountNumber: string;
  bankName: string;
  label: string;
}

/** Everything editable on the profile page, as plain strings for the inputs. */
export interface ContactProfileForm {
  displayName: string;
  alias: string;
  descriptor: string;
  phoneNumber: string;
  bankAccountNumber: string;
  bankName: string;
  notes: string;
  birthday: string;
  address: string;
  workplace: string;
  relationship: ContactRelationship | '';
  extraPhones: PhoneRow[];
  extraBankAccounts: BankAccountRow[];
}

export type ContactProfileFormErrors = ContactProfileUpdateErrors & { displayName?: 'required' };

export function toContactProfileForm(contact: IContactProfile): ContactProfileForm {
  return {
    displayName: contact.displayName,
    alias: contact.alias ?? '',
    descriptor: contact.descriptor ?? '',
    phoneNumber: contact.phoneNumber ?? '',
    bankAccountNumber: contact.bankAccountNumber ?? '',
    bankName: contact.bankName ?? '',
    notes: contact.notes ?? '',
    birthday: contact.birthday ?? '',
    address: contact.address ?? '',
    workplace: contact.workplace ?? '',
    relationship: contact.relationship ?? '',
    extraPhones: contact.extraPhones.map((phone) => ({
      value: phone.value,
      label: phone.label ?? '',
    })),
    extraBankAccounts: contact.extraBankAccounts.map((account) => ({
      accountNumber: account.accountNumber,
      bankName: account.bankName ?? '',
      label: account.label ?? '',
    })),
  };
}

/**
 * Same body as the contacts table inline edit: empty optional fields are sent as `undefined`
 * (the API clears alias/descriptor but keeps phone/bank). `undefined` result = nothing changed.
 */
export function toBaseContactUpdate(
  contact: IContactProfile,
  form: ContactProfileForm,
): IUpdateContactRequest | undefined {
  const next: IUpdateContactRequest = {
    displayName: form.displayName.trim(),
    alias: form.alias.trim() || undefined,
    descriptor: form.descriptor.trim() || undefined,
    phoneNumber: form.phoneNumber.trim() || undefined,
    bankAccountNumber: form.bankAccountNumber.trim() || undefined,
    bankName: form.bankName.trim() || undefined,
  };
  const unchanged =
    next.displayName === contact.displayName &&
    next.alias === (contact.alias || undefined) &&
    next.descriptor === (contact.descriptor || undefined) &&
    (next.phoneNumber ?? contact.phoneNumber) === contact.phoneNumber &&
    (next.bankAccountNumber ?? contact.bankAccountNumber) === contact.bankAccountNumber &&
    (next.bankName ?? contact.bankName) === contact.bankName;
  return unchanged ? undefined : next;
}

export function toProfileUpdate(form: ContactProfileForm): IUpdateContactProfileRequest {
  return {
    notes: form.notes,
    birthday: form.birthday,
    address: form.address,
    workplace: form.workplace,
    relationship: form.relationship || null,
    extraPhones: form.extraPhones.map((row) => ({ value: row.value, label: row.label })),
    extraBankAccounts: form.extraBankAccounts.map((row) => ({
      accountNumber: row.accountNumber,
      bankName: row.bankName,
      label: row.label,
    })),
  };
}

/** Validates the whole form with the rules the API applies, so most errors never reach it. */
export function validateContactProfileForm(
  form: ContactProfileForm,
  today?: string,
):
  | { ok: true; profile: IUpdateContactProfileRequest }
  | { ok: false; errors: ContactProfileFormErrors } {
  const result = validateContactProfileUpdate(toProfileUpdate(form), today);
  const errors: ContactProfileFormErrors = result.ok ? {} : { ...result.errors };
  if (!form.displayName.trim()) errors.displayName = 'required';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return result.ok ? { ok: true, profile: result.value } : { ok: false, errors };
}

/** Values for the `{min}` / `{max}` placeholders of `contacts.profile.errors.*`. */
export function profileErrorValues(error: ContactProfileUpdateError): Record<string, number> {
  switch (error.code) {
    case 'notes_too_long':
      return { max: CONTACT_PROFILE_LIMITS.NOTES_MAX_LENGTH };
    case 'text_too_long':
      return { max: CONTACT_PROFILE_LIMITS.TEXT_MAX_LENGTH };
    case 'label_too_long':
      return { max: CONTACT_PROFILE_LIMITS.LABEL_MAX_LENGTH };
    case 'too_many_items':
      return { max: CONTACT_PROFILE_LIMITS.MAX_EXTRA_ITEMS };
    case 'phone_invalid':
      return {
        min: CONTACT_PROFILE_LIMITS.PHONE_MIN_DIGITS,
        max: CONTACT_PROFILE_LIMITS.PHONE_MAX_DIGITS,
      };
    case 'bank_account_invalid':
      return {
        min: CONTACT_PROFILE_LIMITS.BANK_ACCOUNT_MIN_DIGITS,
        max: CONTACT_PROFILE_LIMITS.BANK_ACCOUNT_MAX_DIGITS,
      };
    default:
      return {};
  }
}

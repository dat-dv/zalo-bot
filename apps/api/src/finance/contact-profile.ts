import {
  contactDigits,
  isContactRelationship,
  type IContactBankAccountEntry,
  type IContactPhoneEntry,
  type IContactProfile,
  type IContactProfileSummary,
  type IDebtListItem,
} from '@zalobot/contracts';
import type { DebtContactEntity } from '../database/entities/debt-contact.entity';
import type { DebtEntity } from '../database/entities/debt.entity';

function toIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** `role` / `grantAccess` of the linked user are admin-only data. */
export function toContactProfile(
  contact: DebtContactEntity,
  includeAccess: boolean,
): IContactProfile {
  const user = contact.linkedUser;
  return {
    id: contact.id,
    displayName: contact.displayName,
    alias: contact.alias || undefined,
    descriptor: contact.descriptor || undefined,
    phoneNumber: contact.phoneNumber || undefined,
    bankAccountNumber: contact.bankAccountNumber || undefined,
    bankCode: contact.bankCode || undefined,
    bankName: contact.bankName || undefined,
    avatarUrl: contact.avatarUrl || undefined,
    linkedUserId: contact.linkedUserId || undefined,
    linkedUser: user
      ? {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          avatarUrl: user.avatarUrl,
          phoneNumber: user.phoneNumber,
          ...(includeAccess ? { role: user.role, grantAccess: user.grantAccess } : {}),
        }
      : undefined,
    notes: contact.notes || null,
    birthday: contact.birthday || null,
    address: contact.address || null,
    workplace: contact.workplace || null,
    relationship: isContactRelationship(contact.relationship) ? contact.relationship : null,
    extraPhones: contact.extraPhones ?? [],
    extraBankAccounts: contact.extraBankAccounts ?? [],
    createdAt: toIso(contact.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(contact.updatedAt),
  };
}

export function toProfileDebtItem(debt: DebtEntity): IDebtListItem {
  return {
    id: debt.id,
    direction: debt.direction,
    counterparty: debt.counterparty,
    counterpartyAlias: debt.counterpartyAlias,
    contactId: debt.contactId,
    parentDebtId: debt.parentDebtId ?? null,
    originalAmount: debt.originalAmount,
    remainingAmount: debt.remainingAmount,
    status: debt.status || (debt.remainingAmount === 0 ? 'settled' : 'active'),
    currency: debt.currency,
    note: debt.note || undefined,
    occurredAt: toIso(debt.occurredAt ?? debt.createdAt) ?? new Date(0).toISOString(),
    dueAt: toIso(debt.dueAt),
    settledAt: toIso(debt.settledAt),
    createdAt: toIso(debt.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(debt.updatedAt),
    childCount: debt.children?.length ?? 0,
  };
}

/** One row per transaction type, as returned by the grouped SQL query. */
export interface TransactionTypeTotal {
  type: string;
  count: string | number;
  total: string | number;
}

/**
 * Debts must be root debts only (`parent_debt_id IS NULL`): a combined debt already carries
 * the remaining amount of its children, so counting both would double it.
 */
export function summarizeContactProfile(
  rootDebts: Pick<DebtEntity, 'direction' | 'remainingAmount' | 'status'>[],
  transactionTotals: TransactionTypeTotal[],
): IContactProfileSummary {
  const summary: IContactProfileSummary = {
    receivableRemaining: 0,
    payableRemaining: 0,
    openDebtCount: 0,
    debtCount: rootDebts.length,
    incomeTotal: 0,
    expenseTotal: 0,
    transactionCount: 0,
  };
  for (const debt of rootDebts) {
    const remaining = Number(debt.remainingAmount) || 0;
    if (debt.status === 'settled' || remaining <= 0) continue;
    summary.openDebtCount += 1;
    if (debt.direction === 'receivable') summary.receivableRemaining += remaining;
    else summary.payableRemaining += remaining;
  }
  for (const row of transactionTotals) {
    const count = Number(row.count) || 0;
    const total = Number(row.total) || 0;
    summary.transactionCount += count;
    if (row.type === 'income') summary.incomeTotal += total;
    else if (row.type === 'expense') summary.expenseTotal += total;
  }
  return summary;
}

type ProfileMergeTarget = Pick<
  DebtContactEntity,
  | 'phoneNumber'
  | 'bankAccountNumber'
  | 'notes'
  | 'birthday'
  | 'address'
  | 'workplace'
  | 'relationship'
  | 'extraPhones'
  | 'extraBankAccounts'
>;

type ProfileMergeSource = ProfileMergeTarget &
  Pick<DebtContactEntity, 'displayName' | 'bankCode' | 'bankName'>;

/**
 * Profile part of combining contacts, run after the lead inherited its primary phone/account.
 * Single fields fill only when empty (never overwrite), notes are appended with their origin,
 * and every phone/account of the sources that is not the lead's primary ends up in the extra
 * lists, so combining never loses profile data.
 */
export function mergeContactProfileFields(
  target: ProfileMergeTarget,
  sources: ProfileMergeSource[],
): Pick<
  DebtContactEntity,
  | 'notes'
  | 'birthday'
  | 'address'
  | 'workplace'
  | 'relationship'
  | 'extraPhones'
  | 'extraBankAccounts'
> {
  const firstValue = <K extends 'birthday' | 'address' | 'workplace' | 'relationship'>(
    key: K,
  ): ProfileMergeTarget[K] => target[key] || sources.find((source) => source[key])?.[key] || null;

  const notes = [
    target.notes?.trim(),
    ...sources
      .filter((source) => source.notes?.trim())
      .map((source) => `— Gộp từ ${source.displayName}:\n${source.notes?.trim()}`),
  ].filter(Boolean);

  const primaryPhone = contactDigits(target.phoneNumber ?? '');
  const seenPhones = new Set(primaryPhone ? [primaryPhone] : []);
  const extraPhones: IContactPhoneEntry[] = [];
  const addPhone = (entry: IContactPhoneEntry) => {
    const digits = contactDigits(entry.value);
    if (!digits || seenPhones.has(digits)) return;
    seenPhones.add(digits);
    extraPhones.push(entry);
  };

  const primaryAccount = contactDigits(target.bankAccountNumber ?? '');
  const seenAccounts = new Set(primaryAccount ? [primaryAccount] : []);
  const extraBankAccounts: IContactBankAccountEntry[] = [];
  const addAccount = (entry: IContactBankAccountEntry) => {
    const digits = contactDigits(entry.accountNumber);
    if (!digits || seenAccounts.has(digits)) return;
    seenAccounts.add(digits);
    extraBankAccounts.push({ ...entry, accountNumber: digits });
  };

  (target.extraPhones ?? []).forEach(addPhone);
  (target.extraBankAccounts ?? []).forEach(addAccount);
  for (const source of sources) {
    if (source.phoneNumber) addPhone({ value: source.phoneNumber });
    (source.extraPhones ?? []).forEach(addPhone);
    if (source.bankAccountNumber) {
      addAccount({
        accountNumber: source.bankAccountNumber,
        ...(source.bankName ? { bankName: source.bankName } : {}),
        ...(source.bankCode ? { bankCode: source.bankCode } : {}),
      });
    }
    (source.extraBankAccounts ?? []).forEach(addAccount);
  }

  return {
    notes: notes.length > 0 ? notes.join('\n\n') : null,
    birthday: firstValue('birthday'),
    address: firstValue('address'),
    workplace: firstValue('workplace'),
    relationship: firstValue('relationship'),
    extraPhones,
    extraBankAccounts,
  };
}

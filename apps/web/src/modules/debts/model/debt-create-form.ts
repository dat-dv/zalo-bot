import type { ICreateDebtRequest, IContactListItem } from '@zalobot/contracts';
import { dueDateToIso } from '@/shared/lib/local-date-input';

type ContactKey = Pick<IContactListItem, 'id' | 'displayName' | 'alias'>;

export interface DebtCreateDraft {
  direction: 'receivable' | 'payable';
  counterparty: string;
  counterpartyAlias: string;
  /** Explicit consent to add a new person when the name matches nobody in the shared contacts. */
  createNewContact: boolean;
  amount: string;
  /** `datetime-local` value. */
  occurredAt: string;
  /** `date` value. */
  dueAt: string;
  note: string;
}

export type DebtCreateError = 'counterpartyRequired' | 'amountInvalid' | 'newContactRequired';

export type DebtCreateResult =
  { ok: true; request: ICreateDebtRequest } | { ok: false; error: DebtCreateError };

/** Exact, case-insensitive match on the display name or the nickname, as the inline edit does. */
export function matchContact<T extends ContactKey>(
  contacts: readonly T[],
  value: string,
): T | undefined {
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  return contacts.find(
    (c) => c.displayName.toLowerCase() === key || (c.alias && c.alias.toLowerCase() === key),
  );
}

export function buildCreateDebtRequest(
  draft: DebtCreateDraft,
  contacts: readonly ContactKey[],
): DebtCreateResult {
  const name = draft.counterparty.trim();
  if (!name) return { ok: false, error: 'counterpartyRequired' };

  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'amountInvalid' };
  }

  const common = {
    direction: draft.direction,
    amount,
    note: draft.note.trim() || undefined,
    occurredAt: draft.occurredAt ? new Date(draft.occurredAt).toISOString() : undefined,
    dueAt: dueDateToIso(draft.dueAt),
  };

  const matched = matchContact(contacts, name);
  if (matched) {
    return {
      ok: true,
      request: {
        ...common,
        contactId: matched.id,
        counterparty: matched.displayName,
        counterpartyAlias: matched.alias || undefined,
      },
    };
  }

  // The API refuses a debt without a contact or an explicit "create new person".
  if (!draft.createNewContact) return { ok: false, error: 'newContactRequired' };
  return {
    ok: true,
    request: {
      ...common,
      createNewContact: true,
      counterparty: name,
      counterpartyAlias: draft.counterpartyAlias.trim() || undefined,
    },
  };
}

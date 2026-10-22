'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { IContactListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  FORM_ERROR_TEXT,
  FORM_FIELD,
  FORM_HINT,
  FORM_LABEL,
  FormDialog,
} from '@/shared/ui/form-dialog';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';
import { useCreateDebtMutation } from '../../api/debts-query';
import {
  buildCreateDebtRequest,
  matchContact,
  type DebtCreateDraft,
} from '../../model/debt-create-form';

interface CreateDebtDialogProps {
  open: boolean;
  contacts: readonly IContactListItem[];
  /** `id` of the contacts `<datalist>` rendered by the debts screen. */
  contactsListId: string;
  onClose: () => void;
  onCreated: () => void;
}

const emptyDraft = (): DebtCreateDraft => ({
  direction: 'receivable',
  counterparty: '',
  counterpartyAlias: '',
  createNewContact: false,
  amount: '',
  occurredAt: toLocalDateTimeInput(new Date()),
  dueAt: '',
  note: '',
});

const CHIP =
  'inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[3px] border px-2 text-xs font-medium transition-colors max-[640px]:h-10';
const CHIP_ON =
  'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300';
const CHIP_OFF =
  'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';

export function CreateDebtDialog({
  open,
  contacts,
  contactsListId,
  onClose,
  onCreated,
}: CreateDebtDialogProps) {
  const { t } = useLocale();
  const ids = useId();
  const createMutation = useCreateDebtMutation();
  const [draft, setDraft] = useState<DebtCreateDraft>(emptyDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Every open starts from a clean form dated "now".
  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft());
    setErrorMessage(null);
  }, [open]);

  const matched = useMemo(
    () => matchContact(contacts, draft.counterparty),
    [contacts, draft.counterparty],
  );
  const result = useMemo(() => buildCreateDebtRequest(draft, contacts), [draft, contacts]);
  const name = draft.counterparty.trim();
  const showAmountError =
    draft.amount.trim() !== '' && !result.ok && result.error === 'amountInvalid';

  const update = (patch: Partial<DebtCreateDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    if (!result.ok) return;
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(result.request);
      onCreated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error && err.message ? err.message : t('debts.create.error'));
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('debts.create.title')}
      description={t('debts.create.description')}
      submitLabel={t('debts.create.submit')}
      submitDisabled={!result.ok}
      isPending={createMutation.isPending}
      errorMessage={errorMessage}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-1" role="radiogroup" aria-label={t('dashboard.columns.direction')}>
        <span className={FORM_LABEL}>{t('dashboard.columns.direction')}</span>
        <div className="flex gap-1.5">
          {(['receivable', 'payable'] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              role="radio"
              aria-checked={draft.direction === direction}
              className={`${CHIP} ${draft.direction === direction ? CHIP_ON : CHIP_OFF}`}
              onClick={() => update({ direction })}
              disabled={createMutation.isPending}
            >
              {t(`table.filter.${direction}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>
          {t('dashboard.columns.counterparty')} <span className="text-rose-500">*</span>
        </span>
        <input
          type="text"
          className={FORM_FIELD}
          list={contactsListId}
          value={draft.counterparty}
          onChange={(e) => update({ counterparty: e.target.value, createNewContact: false })}
          placeholder={t('debts.placeholder.counterparty')}
          autoComplete="off"
          maxLength={200}
          required
          disabled={createMutation.isPending}
        />
        {matched && (
          <span className={FORM_HINT}>
            {t('debts.create.matchedContact', {
              name: matched.alias
                ? `${matched.displayName} (${matched.alias})`
                : matched.displayName,
            })}
          </span>
        )}
      </label>

      {name && !matched && (
        <div className="grid gap-2 rounded-[3px] border border-amber-200 bg-amber-50/70 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer"
              checked={draft.createNewContact}
              onChange={(e) => update({ createNewContact: e.target.checked })}
              disabled={createMutation.isPending}
            />
            <span>{t('debts.create.newContact', { name })}</span>
          </label>
          {draft.createNewContact ? (
            <label className="grid gap-1">
              <span className={FORM_LABEL}>{t('debts.create.alias')}</span>
              <input
                type="text"
                className={FORM_FIELD}
                value={draft.counterpartyAlias}
                onChange={(e) => update({ counterpartyAlias: e.target.value })}
                maxLength={200}
                disabled={createMutation.isPending}
              />
            </label>
          ) : (
            <span className={FORM_HINT}>{t('debts.create.newContactRequired')}</span>
          )}
        </div>
      )}

      <label className="grid gap-1">
        <span className={FORM_LABEL}>
          {t('dashboard.columns.amount')} <span className="text-rose-500">*</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step="any"
          className={`${FORM_FIELD} tabular-nums`}
          value={draft.amount}
          onChange={(e) => update({ amount: e.target.value })}
          placeholder={t('debts.placeholder.originalAmount')}
          aria-invalid={showAmountError}
          aria-describedby={showAmountError ? `${ids}-amount-error` : undefined}
          required
          disabled={createMutation.isPending}
        />
        {showAmountError && (
          <span id={`${ids}-amount-error`} className={FORM_ERROR_TEXT}>
            {t('debts.create.amountInvalid')}
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-2 max-[400px]:grid-cols-1">
        <label className="grid gap-1">
          <span className={FORM_LABEL}>{t('debts.create.occurredAt')}</span>
          <input
            type="datetime-local"
            className={FORM_FIELD}
            value={draft.occurredAt}
            onChange={(e) => update({ occurredAt: e.target.value })}
            disabled={createMutation.isPending}
          />
        </label>
        <label className="grid gap-1">
          <span className={FORM_LABEL}>{t('dashboard.columns.dueDate')}</span>
          <input
            type="date"
            className={FORM_FIELD}
            value={draft.dueAt}
            onChange={(e) => update({ dueAt: e.target.value })}
            disabled={createMutation.isPending}
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('dashboard.columns.note')}</span>
        <input
          type="text"
          className={FORM_FIELD}
          value={draft.note}
          onChange={(e) => update({ note: e.target.value })}
          placeholder={t('debts.placeholder.note')}
          maxLength={500}
          disabled={createMutation.isPending}
        />
      </label>
    </FormDialog>
  );
}

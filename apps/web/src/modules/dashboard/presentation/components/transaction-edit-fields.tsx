'use client';

import type { TransactionType } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { CategoryAutocomplete } from '@/shared/ui/category-autocomplete';
import { useTransactionEditStore } from '../../store/transaction-edit-store';

// Inline-edit controls of the transactions table. Each one reads a single field of the draft
// store, so typing re-renders that control alone (see `useTransactionEditStore`).

const FIELD_CLASS =
  'h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100';
const SELECT_CLASS =
  'h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100';
const ACTION_BUTTON_CLASS =
  'inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] items-center rounded-[2px] border px-1.5 text-[11px] whitespace-nowrap';

export function DraftTypeSelect({
  ariaLabel,
  incomeLabel,
  expenseLabel,
}: {
  ariaLabel: string;
  incomeLabel: string;
  expenseLabel: string;
}) {
  const value = useTransactionEditStore((state) => state.draft.type);
  const setField = useTransactionEditStore((state) => state.setField);
  return (
    <select
      className={SELECT_CLASS}
      value={value}
      onChange={(event) => setField('type', event.target.value as TransactionType)}
      aria-label={ariaLabel}
    >
      <option value="income">{incomeLabel}</option>
      <option value="expense">{expenseLabel}</option>
    </select>
  );
}

export function DraftTextInput({
  field,
  type,
  ariaLabel,
  placeholder,
  min,
  required,
  alignRight,
  onConfirm,
  onCancel,
}: {
  field: 'note' | 'amount' | 'occurredAt';
  type: 'text' | 'number' | 'datetime-local';
  ariaLabel: string;
  placeholder?: string;
  min?: string;
  required?: boolean;
  alignRight?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const value = useTransactionEditStore((state) => state.draft[field]);
  const setField = useTransactionEditStore((state) => state.setField);
  return (
    <input
      type={type}
      className={alignRight ? `${FIELD_CLASS} text-right` : FIELD_CLASS}
      value={value}
      onChange={(event) => setField(field, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onConfirm();
        if (event.key === 'Escape') onCancel();
      }}
      placeholder={placeholder}
      min={min}
      required={required}
      aria-label={ariaLabel}
    />
  );
}

export function DraftAutocomplete({
  field,
  ariaLabel,
  placeholder,
  options,
  autoFocus,
  onConfirm,
  onCancel,
}: {
  field: 'category' | 'placeName';
  ariaLabel: string;
  placeholder: string;
  options: string[];
  autoFocus?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const value = useTransactionEditStore((state) => state.draft[field]);
  const setField = useTransactionEditStore((state) => state.setField);
  return (
    <CategoryAutocomplete
      ariaLabel={ariaLabel}
      autoFocus={autoFocus}
      value={value}
      onChange={(next: string) => setField(field, next)}
      onConfirm={onConfirm}
      onCancel={onCancel}
      options={options}
      placeholder={placeholder}
    />
  );
}

/** Save and cancel of the row being edited; disabled while the draft is not valid for the row. */
export function TransactionEditActions({
  item,
  isPending,
  money,
  onSave,
  onCancel,
  onOpenAllocate,
}: {
  item: { type: TransactionType; allocations?: Array<{ amount: number }> };
  isPending: boolean;
  money: (value: number) => string;
  onSave: () => void;
  onCancel: () => void;
  onOpenAllocate?: () => void;
}) {
  const { t } = useLocale();
  const draft = useTransactionEditStore((state) => state.draft);
  const itemAllocatedSum = (item.allocations || []).reduce(
    (sum: number, a: { amount: number }) => sum + Number(a.amount || 0),
    0,
  );
  const enteredAmount = Number(draft.amount) || 0;
  const isTypeChangedWithAllocations = itemAllocatedSum > 0 && draft.type !== item.type;
  const isAmountBelowAllocations = itemAllocatedSum > 0 && enteredAmount < itemAllocatedSum;
  const isSaveDisabled =
    isPending ||
    !draft.category.trim() ||
    !draft.note.trim() ||
    enteredAmount <= 0 ||
    isTypeChangedWithAllocations ||
    isAmountBelowAllocations;

  const saveButtonTitle = isTypeChangedWithAllocations
    ? t('transactions.allocation.cannotChangeTypeWithAllocations')
    : isAmountBelowAllocations
      ? t('transactions.allocation.cannotReduceBelowAllocated', {
          amount: money(itemAllocatedSum),
        })
      : t('transactions.actions.save');

  return (
    <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
      {onOpenAllocate && (
        <button
          type="button"
          className={`${ACTION_BUTTON_CLASS} gap-1 font-medium ${BUTTON_TONE.secondary}`}
          onClick={onOpenAllocate}
          title={t('transactions.actions.allocateDebts')}
          aria-label={t('transactions.actions.allocateDebts')}
        >
          <span aria-hidden="true">🔗</span>
        </button>
      )}
      <button
        type="button"
        className={`${ACTION_BUTTON_CLASS} font-semibold ${BUTTON_TONE.primary}`}
        onClick={onSave}
        disabled={isSaveDisabled}
        title={saveButtonTitle}
      >
        ✓ {t('transactions.actions.save')}
      </button>
      <button
        type="button"
        className={`${ACTION_BUTTON_CLASS} font-medium ${BUTTON_TONE.secondary}`}
        onClick={onCancel}
        disabled={isPending}
        title={t('transactions.actions.cancel')}
      >
        ✕
      </button>
    </div>
  );
}

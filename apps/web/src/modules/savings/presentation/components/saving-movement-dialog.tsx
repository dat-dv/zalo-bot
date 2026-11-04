'use client';

import { useState } from 'react';
import type { ISavingGroup, SavingMovementType } from '@zalobot/contracts';
import { apiErrorText } from '@/modules/zca/model/channel-memory';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import {
  FORM_ERROR_TEXT,
  FORM_FIELD,
  FORM_HINT,
  FORM_LABEL,
  FormDialog,
} from '@/shared/ui/form-dialog';
import { useAddSavingMovementMutation } from '../../api/savings-query';

/** `yyyy-MM-ddTHH:mm` in the viewer's time zone, as `datetime-local` expects. */
function localDateTimeValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface SavingMovementDialogProps {
  group: ISavingGroup;
  type: SavingMovementType;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function SavingMovementDialog({ group, type, onClose, onSaved }: SavingMovementDialogProps) {
  const { t } = useLocale();
  const { money } = useMoneyVisibility();
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => localDateTimeValue(new Date()));
  const [note, setNote] = useState('');
  const mutation = useAddSavingMovementMutation();

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isInteger(parsedAmount) && parsedAmount > 0;
  const isOverBalance = type === 'withdrawal' && parsedAmount > group.balance;

  const handleSubmit = () => {
    mutation.mutate(
      {
        groupId: group.id,
        data: {
          type,
          amount: parsedAmount,
          occurredAt: new Date(occurredAt).toISOString(),
          note: note.trim() || undefined,
        },
      },
      { onSuccess: () => onSaved(t('savings.toast.movementAdded')) },
    );
  };

  return (
    <FormDialog
      open
      title={t(`savings.movement.title.${type}`, { name: group.name })}
      description={t(`savings.movement.hint.${type}`)}
      submitLabel={t('savings.movement.save')}
      submitDisabled={!isValidAmount || isOverBalance || !occurredAt}
      isPending={mutation.isPending}
      errorMessage={
        mutation.error ? apiErrorText(mutation.error, t('savings.error.generic')) : null
      }
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('savings.movement.amount')}</span>
        <input
          className={FORM_FIELD}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={isOverBalance}
          autoFocus
          required
        />
        {type === 'withdrawal' && (
          <span className={isOverBalance ? FORM_ERROR_TEXT : FORM_HINT}>
            {t('savings.movement.overBalance', { amount: money(group.balance) })}
          </span>
        )}
      </label>
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('savings.movement.occurredAt')}</span>
        <input
          className={FORM_FIELD}
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('savings.movement.note')}</span>
        <input className={FORM_FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </FormDialog>
  );
}

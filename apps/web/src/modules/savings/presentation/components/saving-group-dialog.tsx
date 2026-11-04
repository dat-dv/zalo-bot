'use client';

import { useState } from 'react';
import type { ISavingGroup } from '@zalobot/contracts';
import { apiErrorText } from '@/modules/zca/model/channel-memory';
import { useLocale } from '@/shared/providers/locale-provider';
import { FORM_FIELD, FORM_LABEL, FormDialog } from '@/shared/ui/form-dialog';
import {
  useCreateSavingGroupMutation,
  useUpdateSavingGroupMutation,
} from '../../api/savings-query';

interface SavingGroupDialogProps {
  /** The group being edited; none to create one. */
  group?: ISavingGroup;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function SavingGroupDialog({ group, onClose, onSaved }: SavingGroupDialogProps) {
  const { t } = useLocale();
  const [name, setName] = useState(group?.name ?? '');
  const [note, setNote] = useState(group?.note ?? '');
  const createMutation = useCreateSavingGroupMutation();
  const updateMutation = useUpdateSavingGroupMutation();
  const mutation = group ? updateMutation : createMutation;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedNote = note.trim();
    if (group) {
      updateMutation.mutate(
        { id: group.id, data: { name: trimmedName, note: trimmedNote || null } },
        { onSuccess: () => onSaved(t('savings.toast.updated')) },
      );
      return;
    }
    createMutation.mutate(
      { name: trimmedName, note: trimmedNote || undefined },
      { onSuccess: () => onSaved(t('savings.toast.created')) },
    );
  };

  return (
    <FormDialog
      open
      title={t(group ? 'savings.form.editTitle' : 'savings.form.createTitle')}
      submitLabel={t('savings.form.save')}
      submitDisabled={!name.trim()}
      isPending={mutation.isPending}
      errorMessage={
        mutation.error ? apiErrorText(mutation.error, t('savings.error.generic')) : null
      }
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('savings.form.name')}</span>
        <input
          className={FORM_FIELD}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('savings.form.namePlaceholder')}
          autoFocus
          required
        />
      </label>
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('savings.form.note')}</span>
        <input className={FORM_FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </FormDialog>
  );
}

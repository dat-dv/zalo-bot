'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { FORM_ERROR_TEXT, FORM_FIELD, FORM_LABEL, FormDialog } from '@/shared/ui/form-dialog';
import { useCreateReminderMutation } from '@/modules/reminders/api/reminders-query';
import {
  REMINDER_NOTIFY_TYPES,
  REMINDER_REPEAT_TYPES,
  buildCreateReminderRequest,
  createReminderDraft,
  type ReminderCreateDraft,
} from '@/modules/reminders/model/reminder-create-form';

interface CreateReminderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateReminderDialog({ open, onClose, onCreated }: CreateReminderDialogProps) {
  const { t } = useLocale();
  const createMutation = useCreateReminderMutation();
  const [draft, setDraft] = useState<ReminderCreateDraft>(() => createReminderDraft());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(createReminderDraft());
    setErrorMessage(null);
  }, [open]);

  const result = useMemo(() => buildCreateReminderRequest(draft), [draft]);
  const isPastTime = !result.ok && result.error === 'pastTime';
  const update = (patch: Partial<ReminderCreateDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    // Re-check against the clock at submit time: the form may have sat open for a while.
    const latest = buildCreateReminderRequest(draft);
    if (!latest.ok) return;
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(latest.request);
      onCreated();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error && err.message ? err.message : t('reminders.create.error'),
      );
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('reminders.create.title')}
      description={t('reminders.create.description')}
      submitLabel={t('reminders.create.submit')}
      submitDisabled={!result.ok}
      isPending={createMutation.isPending}
      errorMessage={errorMessage}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <label className="grid gap-1">
        <span className={FORM_LABEL}>
          {t('dashboard.columns.title')} <span className="text-rose-500">*</span>
        </span>
        <input
          type="text"
          className={FORM_FIELD}
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={t('reminders.placeholder.title')}
          maxLength={500}
          required
          disabled={createMutation.isPending}
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>
          {t('reminders.create.remindAt')} <span className="text-rose-500">*</span>
        </span>
        <input
          type="datetime-local"
          className={FORM_FIELD}
          value={draft.remindAt}
          onChange={(e) => update({ remindAt: e.target.value })}
          aria-invalid={isPastTime}
          required
          disabled={createMutation.isPending}
        />
        {isPastTime && <span className={FORM_ERROR_TEXT}>{t('reminders.create.pastTime')}</span>}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className={FORM_LABEL}>{t('reminders.columns.notifyType')}</span>
          <select
            className={FORM_FIELD}
            value={draft.notifyType}
            onChange={(e) => {
              const value = REMINDER_NOTIFY_TYPES.find((type) => type === e.target.value);
              if (value) update({ notifyType: value });
            }}
            disabled={createMutation.isPending}
          >
            {REMINDER_NOTIFY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`reminders.notifyType.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className={FORM_LABEL}>{t('reminders.columns.repeatType')}</span>
          <select
            className={FORM_FIELD}
            value={draft.repeatType}
            onChange={(e) => {
              const value = REMINDER_REPEAT_TYPES.find((type) => type === e.target.value);
              if (value) update({ repeatType: value });
            }}
            disabled={createMutation.isPending}
          >
            {REMINDER_REPEAT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`reminders.repeatType.${type}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </FormDialog>
  );
}

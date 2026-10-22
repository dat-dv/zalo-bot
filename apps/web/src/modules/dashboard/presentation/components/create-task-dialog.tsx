'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  FORM_ERROR_TEXT,
  FORM_FIELD,
  FORM_HINT,
  FORM_LABEL,
  FormDialog,
} from '@/shared/ui/form-dialog';
import {
  useCreateTaskMutation,
  useTaskReminderChannelsQuery,
} from '@/modules/tasks/api/tasks-query';
import { taskApiErrorMessage } from '@/modules/tasks/api/tasks-api';
import {
  buildCreateTaskRequest,
  defaultReminderChannelId,
  emptyTaskDraft,
  type TaskCreateDraft,
} from '@/modules/tasks/model/task-create-form';
import { TaskReminderChannelOptions } from './task-reminder-channel-options';

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const { t } = useLocale();
  const createMutation = useCreateTaskMutation();
  const [draft, setDraft] = useState<TaskCreateDraft>(emptyTaskDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyTaskDraft());
    setErrorMessage(null);
  }, [open]);

  const channelsQuery = useTaskReminderChannelsQuery(open);
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const defaultChannelId = defaultReminderChannelId(channels);
  const result = useMemo(() => buildCreateTaskRequest(draft, channels), [draft, channels]);
  const remindError = result.ok ? null : result.error;
  const update = (patch: Partial<TaskCreateDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    // Re-check against the clock at submit time: the form may have sat open for a while.
    const latest = buildCreateTaskRequest(draft, channels);
    if (!latest.ok) return;
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(latest.request);
      onCreated();
    } catch (err: unknown) {
      setErrorMessage(taskApiErrorMessage(err, t('tasks.create.error')));
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('tasks.create.title')}
      description={t('tasks.create.description')}
      submitLabel={t('tasks.create.submit')}
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
          placeholder={t('tasks.placeholder.title')}
          maxLength={1024}
          required
          disabled={createMutation.isPending}
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('tasks.columns.notes')}</span>
        <textarea
          className={`${FORM_FIELD} h-auto min-h-16 py-1.5 max-[640px]:h-auto`}
          rows={3}
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t('tasks.placeholder.notes')}
          maxLength={8192}
          disabled={createMutation.isPending}
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('dashboard.columns.dueDate')}</span>
        <input
          type="date"
          className={FORM_FIELD}
          value={draft.due}
          onChange={(e) => update({ due: e.target.value })}
          disabled={createMutation.isPending}
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('tasks.columns.remindAt')}</span>
        <input
          type="datetime-local"
          className={FORM_FIELD}
          value={draft.remindAt}
          onChange={(e) => update({ remindAt: e.target.value })}
          aria-invalid={remindError === 'remindPastTime'}
          disabled={createMutation.isPending}
        />
        {remindError === 'remindPastTime' && (
          <span className={FORM_ERROR_TEXT}>{t('tasks.remind.pastTime')}</span>
        )}
      </label>

      {draft.remindAt && (
        <label className="grid gap-1">
          <span className={FORM_LABEL}>
            {t('tasks.remind.channel')}
            {!defaultChannelId && <span className="text-rose-500"> *</span>}
          </span>
          <select
            className={FORM_FIELD}
            value={draft.remindChatId || defaultChannelId || ''}
            onChange={(e) => update({ remindChatId: e.target.value })}
            aria-invalid={remindError === 'remindChannelRequired'}
            disabled={createMutation.isPending || channelsQuery.isLoading}
          >
            <TaskReminderChannelOptions channels={channels} showPlaceholder={!defaultChannelId} />
          </select>
          {channelsQuery.isSuccess && channels.length === 0 ? (
            <span className={FORM_HINT}>{t('tasks.remind.noChannels')}</span>
          ) : (
            remindError === 'remindChannelRequired' && (
              <span className={FORM_ERROR_TEXT}>{t('tasks.remind.channelRequired')}</span>
            )
          )}
        </label>
      )}
    </FormDialog>
  );
}

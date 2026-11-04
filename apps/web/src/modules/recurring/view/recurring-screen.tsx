'use client';

import { useMemo, useState } from 'react';
import type {
  IRecurringOccurrenceItem,
  IRecurringTransactionItem,
  TranslationKey,
} from '@zalobot/contracts';
import { useReminderTargetChannelsQuery } from '@/modules/reminders/api/reminder-targets-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DataPanel } from '@/shared/ui/data-table';
import { FORM_FIELD, FORM_HINT, FORM_LABEL, FormDialog } from '@/shared/ui/form-dialog';
import { TAP_CONTROL } from '@/shared/ui/touch';
import {
  useDeleteRecurringMutation,
  useRecordOccurrenceMutation,
  useRecurringQuery,
  useSaveRecurringMutation,
  useSkipOccurrenceMutation,
  useToggleRecurringMutation,
} from '../api/recurring-query';
import {
  RECURRING_REPEAT_OPTIONS,
  type RecurringDraft,
  draftFromRecurring,
  draftToRequest,
  emptyRecurringDraft,
  isRecurringDraftValid,
  parseAmountInput,
} from '../model/recurring-form';

const ACTION = `inline-flex h-7 min-h-7 items-center justify-center rounded-[3px] border px-2 text-[11px] font-medium ${TAP_CONTROL}`;
const REPEAT_LABEL_KEYS: Record<RecurringDraft['repeatType'], TranslationKey> = {
  daily: 'recurring.repeat.daily',
  weekdays: 'recurring.repeat.weekdays',
  weekly: 'recurring.repeat.weekly',
  monthly: 'recurring.repeat.monthly',
  yearly: 'recurring.repeat.yearly',
};

function PendingRow({ item }: { item: IRecurringOccurrenceItem }) {
  const { t, locale } = useLocale();
  const { money } = useMoneyVisibility();
  const record = useRecordOccurrenceMutation();
  const skip = useSkipOccurrenceMutation();
  const [amount, setAmount] = useState(item.amount === null ? '' : String(item.amount));
  const parsed = parseAmountInput(amount);
  const busy = record.isPending || skip.isPending;

  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-2 last:border-0 dark:border-slate-800">
      <div className="min-w-40 flex-1 max-[640px]:basis-full">
        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{item.note}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {new Date(item.dueAt).toLocaleDateString(locale)}
          {item.amount !== null && ` · ${money(item.amount)}`}
        </p>
      </div>
      <input
        aria-label={t('recurring.pending.amountPlaceholder')}
        className={`${FORM_FIELD} w-36 max-[640px]:w-auto max-[640px]:min-w-0 max-[640px]:flex-1`}
        inputMode="numeric"
        onChange={(event) => setAmount(event.target.value)}
        placeholder={t('recurring.pending.amountPlaceholder')}
        value={amount}
      />
      <button
        className={`${ACTION} ${BUTTON_TONE.primary}`}
        disabled={busy || parsed === null}
        onClick={() => parsed !== null && record.mutate({ id: item.id, data: { amount: parsed } })}
        title={parsed === null ? t('recurring.pending.amountRequired') : undefined}
        type="button"
      >
        {t('recurring.pending.record')}
      </button>
      <button
        className={`${ACTION} ${BUTTON_TONE.secondary}`}
        disabled={busy}
        onClick={() => skip.mutate(item.id)}
        type="button"
      >
        {t('recurring.pending.skip')}
      </button>
    </li>
  );
}

function RuleRow({
  item,
  onEdit,
  onDelete,
}: {
  item: IRecurringTransactionItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useLocale();
  const { money } = useMoneyVisibility();
  const toggle = useToggleRecurringMutation();
  const sign = item.type === 'income' ? '+' : '-';

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-slate-200 py-2 last:border-0 dark:border-slate-800">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
          {item.note}
          {!item.isActive && (
            <span className="ml-2 rounded-[3px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {t('recurring.status.paused')}
            </span>
          )}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {[
            item.category,
            t(REPEAT_LABEL_KEYS[item.repeatType]),
            t(item.mode === 'auto' ? 'recurring.mode.auto' : 'recurring.mode.confirm'),
            `${t('recurring.column.next')}: ${new Date(item.nextDueAt).toLocaleDateString(locale)}`,
            item.notifyChatName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <p className="text-right text-[13px] font-semibold text-slate-900 tabular-nums dark:text-slate-100">
        {item.amount === null ? t('recurring.amountVaries') : `${sign}${money(item.amount)}`}
      </p>
      <div className="col-span-2 flex flex-wrap gap-1.5">
        <button className={`${ACTION} ${BUTTON_TONE.secondary}`} onClick={onEdit} type="button">
          {t('recurring.action.edit')}
        </button>
        <button
          className={`${ACTION} ${BUTTON_TONE.secondary}`}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ id: item.id, data: { isActive: !item.isActive } })}
          type="button"
        >
          {t(item.isActive ? 'recurring.action.pause' : 'recurring.action.resume')}
        </button>
        <button className={`${ACTION} ${BUTTON_TONE.secondary}`} onClick={onDelete} type="button">
          {t('recurring.action.delete')}
        </button>
      </div>
    </li>
  );
}

function RecurringFormDialog({
  editing,
  onClose,
}: {
  editing: IRecurringTransactionItem | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const save = useSaveRecurringMutation();
  const channels = useReminderTargetChannelsQuery(true);
  const [draft, setDraft] = useState<RecurringDraft>(() =>
    editing ? draftFromRecurring(editing) : emptyRecurringDraft(),
  );
  const patch = (next: Partial<RecurringDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  // An untouched date stays out of the update: resending it would move the schedule's anchor, and a
  // monthly 31st shown as the 30th would then stay on the 30th.
  const [initialStartAt] = useState(draft.startAt);
  // The bot's private chat with a person is not a listened channel, so it cannot be picked here.
  const chatOptions = useMemo(
    () => (channels.data ?? []).filter((channel) => !channel.isSelf),
    [channels.data],
  );

  return (
    <FormDialog
      errorMessage={save.error?.message ?? null}
      isPending={save.isPending}
      onClose={onClose}
      onSubmit={() =>
        save.mutate(
          {
            id: editing?.id,
            data:
              editing && draft.startAt === initialStartAt
                ? { ...draftToRequest(draft), startAt: undefined }
                : draftToRequest(draft),
          },
          { onSuccess: onClose },
        )
      }
      open
      submitDisabled={!isRecurringDraftValid(draft)}
      submitLabel={t('recurring.form.save')}
      title={t(editing ? 'recurring.form.editTitle' : 'recurring.form.createTitle')}
    >
      <label className={FORM_LABEL}>
        {t('recurring.form.name')}
        <input
          className={FORM_FIELD}
          onChange={(event) => patch({ note: event.target.value })}
          value={draft.note}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={FORM_LABEL}>
          {t('recurring.form.type')}
          <select
            className={FORM_FIELD}
            onChange={(event) =>
              patch({ type: event.target.value === 'income' ? 'income' : 'expense' })
            }
            value={draft.type}
          >
            <option value="expense">{t('table.filter.expense')}</option>
            <option value="income">{t('table.filter.income')}</option>
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t('recurring.form.category')}
          <input
            className={FORM_FIELD}
            onChange={(event) => patch({ category: event.target.value })}
            value={draft.category}
          />
        </label>
      </div>
      <label className={FORM_LABEL}>
        {t('recurring.column.mode')}
        <select
          className={FORM_FIELD}
          onChange={(event) =>
            patch({ mode: event.target.value === 'confirm' ? 'confirm' : 'auto' })
          }
          value={draft.mode}
        >
          <option value="auto">{t('recurring.mode.auto')}</option>
          <option value="confirm">{t('recurring.mode.confirm')}</option>
        </select>
        <span className={FORM_HINT}>
          {t(draft.mode === 'auto' ? 'recurring.mode.autoHint' : 'recurring.mode.confirmHint')}
        </span>
      </label>
      <label className={FORM_LABEL}>
        {t(draft.mode === 'auto' ? 'recurring.form.amount' : 'recurring.form.amountOptional')}
        <input
          className={FORM_FIELD}
          inputMode="numeric"
          onChange={(event) => patch({ amount: event.target.value })}
          value={draft.amount}
        />
      </label>
      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
        <label className={FORM_LABEL}>
          {t('recurring.column.repeat')}
          <select
            className={FORM_FIELD}
            onChange={(event) => {
              const repeatType = RECURRING_REPEAT_OPTIONS.find((o) => o === event.target.value);
              if (repeatType) patch({ repeatType });
            }}
            value={draft.repeatType}
          >
            {RECURRING_REPEAT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(REPEAT_LABEL_KEYS[option])}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t('recurring.form.start')}
          <input
            className={FORM_FIELD}
            onChange={(event) => patch({ startAt: event.target.value })}
            type="datetime-local"
            value={draft.startAt}
          />
        </label>
      </div>
      <label className={FORM_LABEL}>
        {t('recurring.form.chat')}
        <select
          className={FORM_FIELD}
          onChange={(event) => patch({ notifyChatId: event.target.value })}
          value={draft.notifyChatId}
        >
          <option value="">{t('recurring.form.noChat')}</option>
          {chatOptions.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </label>
    </FormDialog>
  );
}

export function RecurringScreen() {
  const { t } = useLocale();
  const recurring = useRecurringQuery();
  const remove = useDeleteRecurringMutation();
  const [form, setForm] = useState<{ editing: IRecurringTransactionItem | null } | null>(null);
  const [deleting, setDeleting] = useState<IRecurringTransactionItem | null>(null);

  const rules = recurring.data?.rules ?? [];
  const pending = recurring.data?.pending ?? [];
  const message = (text: string) => (
    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{text}</p>
  );

  return (
    <section className="flex flex-col gap-3" aria-label={t('recurring.title')}>
      {pending.length > 0 && (
        <DataPanel
          title={t('recurring.pending.title')}
          counter={t('table.rowsCount', { count: pending.length })}
        >
          <ul className="px-3">
            {pending.map((item) => (
              <PendingRow item={item} key={item.id} />
            ))}
          </ul>
        </DataPanel>
      )}

      <DataPanel
        title={t('recurring.title')}
        counter={t('table.rowsCount', { count: rules.length })}
        toolbar={
          <button
            className={`${ACTION} font-semibold ${BUTTON_TONE.primary}`}
            onClick={() => setForm({ editing: null })}
            type="button"
          >
            + {t('recurring.add')}
          </button>
        }
      >
        {recurring.isLoading && message(t('recurring.loading'))}
        {recurring.isError && message(t('recurring.loadFailed'))}
        {recurring.isSuccess && rules.length === 0 && message(t('recurring.empty'))}
        {rules.length > 0 && (
          <ul className="px-3">
            {rules.map((item) => (
              <RuleRow
                item={item}
                key={item.id}
                onDelete={() => setDeleting(item)}
                onEdit={() => setForm({ editing: item })}
              />
            ))}
          </ul>
        )}
      </DataPanel>

      {form && <RecurringFormDialog editing={form.editing} onClose={() => setForm(null)} />}
      <ConfirmDialog
        confirmLabel={t('recurring.action.delete')}
        isPending={remove.isPending}
        message={t('recurring.delete.message', { name: deleting?.note ?? '' })}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        open={deleting !== null}
        title={t('recurring.delete.title')}
      />
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { ICalendarEventItem } from '@zalobot/contracts';
import { useIsPhone } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
  Modal,
} from '@/shared/ui/modal';
import {
  useCreateCalendarEventMutation,
  useDeleteCalendarEventMutation,
  useResyncCalendarEventMutation,
  useUpdateCalendarEventMutation,
} from '../../api/calendar-query';
import {
  type CalendarEventDraft,
  createEmptyDraft,
  draftFromEvent,
  draftToRequest,
} from '../../model/calendar-date-utils';
import { CalendarEventForm } from './calendar-event-form';
import { SYNC_TONE_CLASS, useCalendarFormat } from './use-calendar-format';

/** What the sheet shows: an existing event (details, then edit) or a new event on a day. */
export type CalendarSheetTarget =
  { kind: 'event'; event: ICalendarEventItem } | { kind: 'create'; day: Date };

interface CalendarEventSheetProps {
  target: CalendarSheetTarget | null;
  onClose: () => void;
  onNotify: (message: string) => void;
}

const FOOTER_BUTTON = `inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[3px] border px-3 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${MODAL_FOOTER_TAP}`;
const PRIMARY = `${FOOTER_BUTTON} border-slate-900 bg-slate-900 font-semibold text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`;
const SECONDARY = `${FOOTER_BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const DANGER = `${FOOTER_BUTTON} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70`;

/**
 * Details, edit and create in one sheet: a centered card on desktop, a bottom sheet on
 * phones (full screen while editing, so the form stays above the keyboard).
 */
export function CalendarEventSheet({ target, onClose, onNotify }: CalendarEventSheetProps) {
  const { t } = useLocale();
  const format = useCalendarFormat();
  const isPhone = useIsPhone();
  const createMutation = useCreateCalendarEventMutation();
  const updateMutation = useUpdateCalendarEventMutation();
  const deleteMutation = useDeleteCalendarEventMutation();
  const resyncMutation = useResyncCalendarEventMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CalendarEventDraft | null>(null);
  const [showRangeError, setShowRangeError] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // A new target resets the sheet: create opens straight in the form, an event in details.
  useEffect(() => {
    setErrorMessage(null);
    setShowRangeError(false);
    setIsConfirmingDelete(false);
    if (target?.kind === 'create') {
      setDraft(createEmptyDraft(target.day));
      setIsEditing(true);
    } else {
      setDraft(null);
      setIsEditing(false);
    }
  }, [target]);

  const event = target?.kind === 'event' ? target.event : undefined;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isBusy = isSaving || deleteMutation.isPending || resyncMutation.isPending;
  const request = draft ? draftToRequest(draft) : null;
  const rangeError = showRangeError && Boolean(draft?.summary.trim()) && request === null;

  const fail = (err: unknown) =>
    setErrorMessage(err instanceof Error && err.message ? err.message : t('dashboard.error.title'));

  const startEdit = () => {
    if (!event) return;
    setDraft(draftFromEvent(event));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (target?.kind === 'create') {
      onClose();
      return;
    }
    setIsEditing(false);
    setShowRangeError(false);
  };

  const save = async () => {
    setShowRangeError(true);
    if (!request) return;
    setErrorMessage(null);
    try {
      if (event) {
        await updateMutation.mutateAsync({ id: event.id, data: request });
        onNotify(t('calendar.inlineEdit.saved'));
      } else {
        await createMutation.mutateAsync(request);
        onNotify(t('calendar.create.success'));
      }
      onClose();
    } catch (err: unknown) {
      fail(err);
    }
  };

  const confirmDelete = async () => {
    if (!event) return;
    try {
      await deleteMutation.mutateAsync(event.id);
      setIsConfirmingDelete(false);
      onNotify(t('calendar.delete.success'));
      onClose();
    } catch (err: unknown) {
      setIsConfirmingDelete(false);
      fail(err);
    }
  };

  const resync = async () => {
    if (!event) return;
    setErrorMessage(null);
    try {
      const updated = await resyncMutation.mutateAsync(event.id);
      if (updated.sync?.status !== 'synced') {
        fail(new Error(t('calendar.sync.failed')));
        return;
      }
      onNotify(t('calendar.sync.resynced'));
      onClose();
    } catch (err: unknown) {
      fail(err);
    }
  };

  const title = isEditing
    ? event
      ? t('calendar.edit.title')
      : t('calendar.create.title')
    : (event?.title ?? t('calendar.details.title'));
  const sync = event ? format.sync(event) : null;
  const canResync = Boolean(event && sync && sync.tone !== 'ok');

  return (
    <>
      <Modal
        open={target !== null}
        onDismiss={isBusy ? undefined : onClose}
        dismissOnBackdrop={!isEditing}
        ariaLabel={title}
        phoneLayout={isEditing ? 'fullscreen' : 'sheet'}
        panelClassName="max-w-lg rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <header
          className={`${MODAL_STICKY_HEADER} flex items-center gap-2 border-b border-slate-200 bg-white py-1 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900 max-sm:pt-3`}
        >
          <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            className={`inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 !bg-transparent text-lg text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:!bg-slate-800 dark:hover:text-slate-100 ${MODAL_CLOSE_TAP}`}
            onClick={onClose}
            disabled={isBusy}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </header>

        {errorMessage && (
          <p
            role="alert"
            className="m-3 mb-0 rounded-[3px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          >
            {errorMessage}
          </p>
        )}

        {isEditing && draft ? (
          <form
            id="calendar-event-form"
            className="px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <CalendarEventForm
              draft={draft}
              onChange={(updater) => setDraft((prev) => (prev ? updater(prev) : prev))}
              rangeError={rangeError}
              autoFocusTitle={!isPhone && !event}
            />
          </form>
        ) : (
          event && <EventDetails event={event} />
        )}

        {event && !isEditing && sync && (
          <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-[3px] border border-slate-200 px-2.5 py-2 text-xs dark:border-slate-800">
            <span
              className={`rounded-[2px] border px-1.5 py-px text-[11px] font-medium ${SYNC_TONE_CLASS[sync.tone]}`}
            >
              {sync.label}
            </span>
            {event.sync?.accountEmail && (
              <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">
                {t('calendar.sync.account', { email: event.sync.accountEmail })}
              </span>
            )}
            {canResync && (
              <button
                type="button"
                className="ml-auto inline-flex h-7 cursor-pointer items-center rounded-[3px] border border-sky-300 bg-sky-50 px-2 text-[11.5px] font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 max-[640px]:h-9"
                onClick={() => void resync()}
                disabled={isBusy}
              >
                {t('calendar.sync.resync')}
              </button>
            )}
          </div>
        )}

        <footer
          className={`${MODAL_STICKY_FOOTER} flex justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900`}
        >
          {isEditing ? (
            <>
              <button type="button" className={SECONDARY} onClick={cancelEdit} disabled={isSaving}>
                {t('calendar.actions.cancel')}
              </button>
              <button
                type="submit"
                form="calendar-event-form"
                className={PRIMARY}
                disabled={isSaving || !draft?.summary.trim()}
              >
                {t('calendar.actions.save')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${DANGER} mr-auto max-sm:mr-0`}
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isBusy}
              >
                {t('calendar.actions.delete')}
              </button>
              <button type="button" className={PRIMARY} onClick={startEdit} disabled={isBusy}>
                {t('calendar.actions.edit')}
              </button>
            </>
          )}
        </footer>
      </Modal>

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t('calendar.delete.title')}
        message={t('calendar.delete.message')}
        confirmLabel={t('calendar.actions.delete')}
        isPending={deleteMutation.isPending}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function EventDetails({ event }: { event: ICalendarEventItem }) {
  const { t } = useLocale();
  const format = useCalendarFormat();
  const start = event.startAt ? new Date(event.startAt) : undefined;
  const duration = format.duration(event);
  const reminders = event.reminderMinutes ?? [];

  const rows: Array<{ id: string; label: string; value: string | undefined }> = [
    {
      id: 'when',
      label: t('calendar.details.when'),
      value: start
        ? `${format.fullDate(start)}\n${format.range(event)}${duration ? ` · ${duration}` : ''}`
        : undefined,
    },
    { id: 'location', label: t('calendar.form.location'), value: event.location },
    { id: 'description', label: t('calendar.form.description'), value: event.description },
    {
      id: 'reminders',
      label: t('calendar.reminders.label'),
      value: reminders.length
        ? reminders.map((minutes) => format.reminder(minutes)).join(', ')
        : t('calendar.reminders.none'),
    },
    {
      id: 'origin',
      label: t('calendar.details.origin'),
      value: [
        format.origin(event) || format.source(event),
        event.createdAt
          ? t('calendar.details.created', { date: format.dateTime(new Date(event.createdAt)) })
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  return (
    <dl className="m-0 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 px-3 py-1 text-xs">
      {rows.map((row) => (
        <div
          key={row.id}
          className="col-span-2 grid grid-cols-subgrid items-start border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800"
        >
          <dt className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {row.label}
          </dt>
          <dd className="m-0 min-w-0 whitespace-pre-wrap text-slate-800 first-letter:uppercase dark:text-slate-200">
            {row.value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

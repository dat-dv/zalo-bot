'use client';

import { useMemo, useState } from 'react';
import { API_ROUTES, type IWebhookRecipient, type TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { PHONE_CHIP, PHONE_TOOLBAR_INPUT, TAP_CONTROL } from '@/shared/ui/touch';
import { useZcaThreadsQuery } from '@/modules/zca/api/zca-query';
import {
  useUpdateWebhookRecipientsMutation,
  useWebhookRecipientsQuery,
} from '../../api/webhook-recipients-query';
import {
  buildWebhookRecipientRows,
  filterWebhookRecipientRows,
  isSameRecipientSet,
  toggleWebhookRecipient,
  type WebhookRecipientFilter,
  type WebhookRecipientRow,
} from '../../model/webhook-recipients';

const FILTERS: { id: WebhookRecipientFilter; label: TranslationKey }[] = [
  { id: 'all', label: 'settings.webhook.filterAll' },
  { id: 'selected', label: 'settings.webhook.filterSelected' },
  { id: 'group', label: 'settings.webhook.filterGroup' },
  { id: 'user', label: 'settings.webhook.filterUser' },
];

/** Settings → Webhook: the only chats the webhook may list (`/targets`) and message (`/send`). */
export function WebhookRecipientsPanel({ onToast }: { onToast: (message: string) => void }) {
  const { t } = useLocale();
  const threadsQuery = useZcaThreadsQuery();
  const recipientsQuery = useWebhookRecipientsQuery();
  const saveMutation = useUpdateWebhookRecipientsMutation();

  const [filter, setFilter] = useState<WebhookRecipientFilter>('all');
  const [search, setSearch] = useState('');
  // Null until the admin changes something; until then the saved list is the draft.
  const [edited, setEdited] = useState<Map<string, IWebhookRecipient> | null>(null);

  const saved = useMemo(() => recipientsQuery.data ?? [], [recipientsQuery.data]);
  const draft = useMemo(
    () => edited ?? new Map(saved.map((recipient) => [recipient.threadId, recipient])),
    [edited, saved],
  );
  const isDirty = edited !== null && !isSameRecipientSet(edited, saved);

  const rows = useMemo(
    () => buildWebhookRecipientRows(threadsQuery.data ?? [], draft),
    [threadsQuery.data, draft],
  );
  const visibleRows = useMemo(
    () => filterWebhookRecipientRows(rows, filter, search),
    [rows, filter, search],
  );

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ recipients: [...draft.values()] });
      setEdited(null);
      onToast(t('settings.webhook.saved'));
    } catch {
      onToast(t('settings.webhook.saveFailed'));
    }
  };

  const handleCopy = (id: string) => {
    void navigator.clipboard?.writeText(id).then(() => onToast(t('settings.webhook.copied')));
  };

  const typeLabel = (row: WebhookRecipientRow) =>
    row.type === 'group' ? t('settings.webhook.filterGroup') : t('settings.webhook.filterUser');

  const columns: DataTableColumn<WebhookRecipientRow>[] = [
    {
      id: 'selected',
      header: '',
      width: '36px',
      hideable: false,
      mobileSlot: 'trailing',
      cell: (row) => (
        <input
          type="checkbox"
          className={`h-4 w-4 cursor-pointer accent-sky-600 ${TAP_CONTROL}`}
          checked={row.selected}
          onChange={() => setEdited(toggleWebhookRecipient(draft, row))}
          aria-label={row.name}
        />
      ),
    },
    {
      id: 'name',
      header: t('settings.webhook.name'),
      minWidth: '200px',
      mobileSlot: 'primary',
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.avatar ? (
            <img src={row.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {row.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span
              className="truncate font-semibold text-slate-900 dark:text-slate-100"
              title={row.name}
            >
              {row.name}
            </span>
            {row.missing && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                {t('settings.webhook.missing')}
              </span>
            )}
          </span>
        </span>
      ),
      mobileCell: (row) => row.name,
    },
    {
      id: 'type',
      header: t('settings.webhook.type'),
      minWidth: '80px',
      mobileSlot: 'secondary',
      mobileCell: typeLabel,
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
            row.type === 'group'
              ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {typeLabel(row)}
        </span>
      ),
    },
    {
      id: 'id',
      header: t('settings.webhook.id'),
      minWidth: '200px',
      cell: (row) => (
        <button
          type="button"
          className={`inline-flex h-[22px] items-center rounded-[2px] border px-1.5 font-mono text-[11px] ${BUTTON_TONE.ghost}`}
          onClick={() => handleCopy(row.id)}
          title={t('settings.webhook.copyId')}
        >
          {row.id}
        </button>
      ),
    },
  ];

  const isError = threadsQuery.isError || recipientsQuery.isError;

  return (
    <section className="grid gap-3">
      <DataPanel
        title={t('settings.webhook.title')}
        description={t('settings.webhook.description')}
        counter={t('settings.webhook.selectedCount', { count: draft.size })}
        toolbar={
          <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full">
            {isDirty && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                {t('settings.webhook.unsaved')}
              </span>
            )}
            <button
              type="button"
              className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border px-2 text-[11px] font-medium ${BUTTON_TONE.secondary} ${TAP_CONTROL}`}
              onClick={() => setEdited(null)}
              disabled={!isDirty || saveMutation.isPending}
            >
              {t('settings.webhook.reset')}
            </button>
            <button
              type="button"
              className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.primary} ${TAP_CONTROL}`}
              onClick={() => void handleSave()}
              disabled={!isDirty || saveMutation.isPending}
            >
              {t('settings.webhook.save')}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 text-[11.5px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <p className="m-0 flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {t('settings.webhook.endpoint')}
            </span>
            <code className="rounded-[2px] bg-slate-100 px-1 py-0.5 font-mono break-all dark:bg-slate-800">
              GET {origin}
              {API_ROUTES.webhookTargets}
            </code>
            <code className="rounded-[2px] bg-slate-100 px-1 py-0.5 font-mono break-all dark:bg-slate-800">
              POST {origin}
              {API_ROUTES.webhookSendMessage}
            </code>
          </p>
          <p className="m-0">{t('settings.webhook.howItWorks')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              className={`h-6 min-h-6 w-56 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 max-[640px]:w-full dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${PHONE_TOOLBAR_INPUT}`}
              placeholder={t('settings.webhook.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                className={`inline-flex h-6 min-h-6 shrink-0 items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap ${PHONE_CHIP} ${
                  filter === option.id ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
                }`}
                onClick={() => setFilter(option.id)}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>
        {isError ? (
          <p className="m-0 px-3 py-3 text-xs text-rose-700 dark:text-rose-300" role="alert">
            {t('settings.webhook.loadFailed')}
          </p>
        ) : (
          <DataTable
            ariaLabel={t('settings.webhook.title')}
            rows={visibleRows}
            columns={columns}
            emptyMessage={t('settings.webhook.empty')}
            loading={threadsQuery.isLoading || recipientsQuery.isLoading}
            disableSorting
            allowColumnToggle={false}
          />
        )}
      </DataPanel>
    </section>
  );
}

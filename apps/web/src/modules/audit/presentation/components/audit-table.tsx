'use client';

import { localeTag, type IAuditLogListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { TAP_CONTROL } from '@/shared/ui/touch';
import {
  AUDIT_ACTION_LABEL_KEYS,
  AUDIT_SOURCE_LABEL_KEYS,
  auditSourceOf,
  describeAuditActor,
  describeAuditChange,
  describeAuditChannel,
  describeAuditTable,
} from '../../model/audit-labels';

const MAX_FIELD_CHIPS = 4;

/** Text colour of each action, shared with the home page's activity panel. */
export const AUDIT_ACTION_TONE = {
  insert: 'text-emerald-700 dark:text-emerald-400',
  update: 'text-sky-700 dark:text-sky-400',
  remove: 'text-red-700 dark:text-red-400',
} as const;

const BADGE = 'rounded-[3px] px-1 py-px text-[10.5px] font-medium';

interface AuditTableProps {
  rows: IAuditLogListItem[];
  loading: boolean;
  emptyMessage: string;
  onOpen: (item: IAuditLogListItem) => void;
}

export function AuditTable({ rows, loading, emptyMessage, onOpen }: AuditTableProps) {
  const { locale, t } = useLocale();
  const time = (value: string) =>
    new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short', timeStyle: 'medium' }).format(
      new Date(value),
    );
  const actorLine = (item: IAuditLogListItem) =>
    [
      describeAuditActor(item, t),
      t(AUDIT_SOURCE_LABEL_KEYS[auditSourceOf(item)]),
      describeAuditChannel(item, t),
    ]
      .filter(Boolean)
      .join(' · ');
  const recordLine = (item: IAuditLogListItem) =>
    describeAuditChange(item.action, item.tableName, t);

  const columns: DataTableColumn<IAuditLogListItem>[] = [
    {
      id: 'createdAt',
      header: t('audit.columns.time'),
      minWidth: '130px',
      hideable: false,
      mobileSlot: 'trailing',
      cell: (item) => (
        <span className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
          {time(item.createdAt)}
        </span>
      ),
    },
    {
      id: 'actor',
      header: t('audit.columns.actor'),
      minWidth: '180px',
      mobileSlot: 'secondary',
      mobileCell: actorLine,
      cell: (item) => (
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {describeAuditActor(item, t)}
          </span>
          {item.actorSource ? (
            <span
              className={`${BADGE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}
            >
              {t(AUDIT_SOURCE_LABEL_KEYS[item.actorSource])}
            </span>
          ) : (
            <span
              className={`${BADGE} bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300`}
              title={t('audit.legacyHint')}
            >
              {t('audit.source.legacy')}
            </span>
          )}
          {item.channelId && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {describeAuditChannel(item, t)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'record',
      header: t('audit.columns.record'),
      minWidth: '200px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: recordLine,
      // The way into the details that always stays on screen: the ID column is wide, so the
      // trailing "View" button can scroll out of view on a 1280px screen.
      cell: (item) => (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="group inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-[3px] text-left"
            title={t('audit.viewTitle')}
            aria-label={`${t('audit.view')}: ${recordLine(item)}`}
            onClick={() => onOpen(item)}
          >
            <span className={`font-semibold ${AUDIT_ACTION_TONE[item.action]}`}>
              {t(AUDIT_ACTION_LABEL_KEYS[item.action])}
            </span>
            <span className="text-sky-700 group-hover:underline dark:text-sky-400">
              {describeAuditTable(item.tableName, t)}
            </span>
          </button>
          {item.recordId ? (
            <span
              className="font-mono text-[11px] text-slate-500 dark:text-slate-400"
              title={item.recordId}
            >
              …{item.recordId.slice(-8)}
            </span>
          ) : (
            <span
              className={`${BADGE} bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300`}
              title={t('audit.bulkHint')}
            >
              {t('audit.bulk')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'changes',
      header: t('audit.columns.changes'),
      minWidth: '160px',
      cell: (item) =>
        item.changedFields.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {item.changedFields.slice(0, MAX_FIELD_CHIPS).map((field) => (
              <code
                key={field}
                className="rounded-[3px] bg-slate-100 px-1 text-[10.5px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {field}
              </code>
            ))}
            {item.changedFields.length > MAX_FIELD_CHIPS && (
              <span className="text-[10.5px] text-slate-500">
                {t('audit.moreFields', { count: item.changedFields.length - MAX_FIELD_CHIPS })}
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      hideable: false,
      cell: (item) => (
        <button
          type="button"
          className={`rounded-[3px] border px-2 py-0.5 text-[11.5px] font-medium ${BUTTON_TONE.secondary} ${TAP_CONTROL}`}
          title={t('audit.viewTitle')}
          onClick={() => onOpen(item)}
        >
          {t('audit.view')}
        </button>
      ),
    },
  ];

  return (
    <DataTable
      id="audit-logs"
      ariaLabel={t('audit.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      emptyMessage={emptyMessage}
      getRowKey={(item) => item.id}
      // The API already orders newest first across all pages.
      disableSorting
    />
  );
}

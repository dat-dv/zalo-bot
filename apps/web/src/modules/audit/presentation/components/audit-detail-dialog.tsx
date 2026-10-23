'use client';

import { useId } from 'react';
import {
  isAuditTableName,
  localeTag,
  type AuditTableName,
  type IAuditLogListItem,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';
import { useAuditLogQuery } from '../../api/audit-query';
import {
  AUDIT_ACTION_LABEL_KEYS,
  AUDIT_SOURCE_LABEL_KEYS,
  auditSourceOf,
  buildAuditDiffRows,
  describeAuditActor,
  describeAuditChannel,
  describeAuditTable,
} from '../../model/audit-labels';

interface AuditDetailDialogProps {
  /** The list row, shown at once while the before/after data loads. */
  item: IAuditLogListItem;
  onClose: () => void;
  onShowRecordHistory: (table: AuditTableName, recordId: string) => void;
}

const CELL = 'px-2 py-1 align-top break-all';

export function AuditDetailDialog({ item, onClose, onShowRecordHistory }: AuditDetailDialogProps) {
  const { locale, t } = useLocale();
  const titleId = useId();
  const detail = useAuditLogQuery(item.id);
  const rows = detail.data ? buildAuditDiffRows(detail.data) : [];
  // An insert only has the new row and a removal only the old one: show a single column.
  const single = item.action === 'insert' ? 'after' : item.action === 'remove' ? 'before' : null;
  const time = new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(item.createdAt));
  const channel = describeAuditChannel(item, t);
  const meta: Array<[string, string]> = [
    [t('audit.columns.time'), time],
    [
      t('audit.columns.actor'),
      `${describeAuditActor(item, t)} · ${t(AUDIT_SOURCE_LABEL_KEYS[auditSourceOf(item)])}`,
    ],
    ...(channel ? [[t('audit.detail.channel'), channel] as [string, string]] : []),
    [
      t('audit.columns.record'),
      `${t(AUDIT_ACTION_LABEL_KEYS[item.action])} · ${describeAuditTable(item.tableName, t)}`,
    ],
    [t('audit.detail.recordId'), item.recordId ?? t('audit.bulk')],
  ];
  const recordTable = isAuditTableName(item.tableName) ? item.tableName : null;

  return (
    <Modal
      open
      onDismiss={onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-3xl rounded-[3px] border border-slate-200 bg-white px-6 max-sm:px-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-6 pb-3 dark:bg-slate-900`}
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('audit.detail.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className={`rounded-[3px] p-1 ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {meta.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="min-w-0 break-all font-medium text-slate-800 dark:text-slate-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {!item.actorSource && (
        <p className="mt-2 rounded-[3px] bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('audit.legacyHint')}
        </p>
      )}
      {!item.recordId && (
        <p className="mt-2 rounded-[3px] bg-violet-50 p-2 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
          {t('audit.bulkHint')}
        </p>
      )}

      <section className="mt-3" aria-live="polite">
        {detail.isLoading && (
          <p className="text-xs text-slate-500" aria-busy="true">
            {t('audit.detail.loading')}
          </p>
        )}
        {detail.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-[3px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <span>{t('audit.detail.error')}</span>
            <button
              type="button"
              onClick={() => void detail.refetch()}
              className="shrink-0 font-semibold underline max-sm:min-h-10 max-sm:px-2"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        {detail.isSuccess && rows.length === 0 && (
          <p className="text-xs text-slate-500">{t('audit.detail.noData')}</p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-[3px] border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-2 py-1 font-semibold">
                    {t('audit.detail.field')}
                  </th>
                  {single ? (
                    <th scope="col" className="px-2 py-1 font-semibold">
                      {t('audit.detail.value')}
                    </th>
                  ) : (
                    <>
                      <th scope="col" className="px-2 py-1 font-semibold">
                        {t('audit.detail.before')}
                      </th>
                      <th scope="col" className="px-2 py-1 font-semibold">
                        {t('audit.detail.after')}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.field}
                    className={row.changed ? 'bg-amber-50/70 dark:bg-amber-950/20' : undefined}
                  >
                    <th
                      scope="row"
                      className={`${CELL} whitespace-nowrap font-mono font-medium text-slate-700 dark:text-slate-300`}
                    >
                      {row.field}
                    </th>
                    {single ? (
                      <td className={`${CELL} text-slate-800 dark:text-slate-200`}>
                        {row[single]}
                      </td>
                    ) : (
                      <>
                        <td className={`${CELL} text-slate-500 dark:text-slate-400`}>
                          {row.before}
                        </td>
                        <td
                          className={`${CELL} ${row.changed ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-800 dark:text-slate-200'}`}
                        >
                          {row.after}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        className={`${MODAL_STICKY_FOOTER} mt-4 flex justify-end gap-2 bg-white pt-3 pb-6 dark:bg-slate-900`}
      >
        {recordTable && item.recordId && (
          <button
            type="button"
            onClick={() => item.recordId && onShowRecordHistory(recordTable, item.recordId)}
            className={`inline-flex items-center rounded-[3px] border px-3 py-1.5 text-sm font-medium max-sm:justify-center ${BUTTON_TONE.secondary} ${MODAL_FOOTER_TAP}`}
          >
            {t('audit.detail.recordHistory')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`rounded-[3px] px-3 py-1.5 text-sm font-semibold ${BUTTON_TONE.primary} ${MODAL_FOOTER_TAP}`}
        >
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}

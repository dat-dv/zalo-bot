'use client';

import { useMemo, useState } from 'react';
import type { IAuditLogListItem } from '@zalobot/contracts';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { ZcaAdminOnlyNotice } from '@/modules/zca/presentation/components/zca-admin-only-notice';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import { PHONE_CHIP } from '@/shared/ui/touch';
import { isForbiddenError, isUnauthorizedError, useAuditLogsQuery } from '../api/audit-query';
import { toAuditListQuery } from '../model/audit-url-state';
import { AuditDetailDialog } from '../presentation/components/audit-detail-dialog';
import { AuditFilters } from '../presentation/components/audit-filters';
import { AuditTable } from '../presentation/components/audit-table';
import { useAuditFilterUrlState } from './use-audit-filter-url-state';

const PAGE_BUTTON = `h-7 rounded-[3px] border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${PHONE_CHIP}`;

/** `/activity`: who added, changed or deleted data (admins only). */
export function ActivityScreen() {
  const { t } = useLocale();
  const { state, update, setPage } = useAuditFilterUrlState();
  const query = useMemo(() => toAuditListQuery(state), [state]);
  const logs = useAuditLogsQuery(query);
  const [opened, setOpened] = useState<IAuditLogListItem | null>(null);

  if (isForbiddenError(logs.error)) return <ZcaAdminOnlyNotice />;
  // Same sign-in screen as the other dashboard pages; other errors keep the inline retry.
  if (isUnauthorizedError(logs.error)) {
    return <SessionStateScreen reason="expired" onRetry={() => void logs.refetch()} />;
  }

  const data = logs.data;
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (query.offset ?? 0) + 1;
  const to = Math.min((query.offset ?? 0) + (data?.items.length ?? 0), total);
  const hasNext = to < total;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 p-1">
      <DataPanel
        title={t('audit.title')}
        toolbar={
          <AuditFilters state={state} actors={data?.facets.actors ?? []} onChange={update} />
        }
      >
        {logs.isError ? (
          <div
            role="alert"
            className="m-3 flex items-center justify-between gap-3 rounded-[3px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <span>{t('audit.error')}</span>
            <button
              type="button"
              onClick={() => void logs.refetch()}
              className="shrink-0 font-semibold underline max-sm:min-h-10 max-sm:px-2"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <AuditTable
            rows={data?.items ?? []}
            loading={logs.isLoading}
            emptyMessage={t('audit.empty')}
            onOpen={setOpened}
          />
        )}
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="tabular-nums" aria-live="polite">
            {t('audit.range', { from, to, total })}
          </span>
          <span className="flex gap-1.5">
            <button
              type="button"
              className={PAGE_BUTTON}
              aria-label={t('audit.prev')}
              disabled={state.page <= 1 || logs.isFetching}
              onClick={() => setPage(state.page - 1)}
            >
              ←
            </button>
            <button
              type="button"
              className={PAGE_BUTTON}
              aria-label={t('audit.next')}
              disabled={!hasNext || logs.isFetching}
              onClick={() => setPage(state.page + 1)}
            >
              →
            </button>
          </span>
        </footer>
      </DataPanel>

      {opened && (
        <AuditDetailDialog
          item={opened}
          onClose={() => setOpened(null)}
          onShowRecordHistory={(table, recordId) => {
            setOpened(null);
            update({ tables: [table], recordId, actions: [], sources: [], actorIds: [] });
          }}
        />
      )}
    </div>
  );
}

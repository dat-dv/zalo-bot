'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { TAP_CONTROL, TAP_INPUT } from '@/shared/ui/touch';
import { useUsersQuery } from '@/modules/users/api/users-query';
import {
  useRefreshZcaThreadMembersMutation,
  useZcaThreadMembersQuery,
} from '../../../api/zca-query';
import {
  buildGroupMemberRows,
  filterGroupMemberRows,
  setMemberSelected,
  type GroupMemberFilter,
  type GroupMemberRow,
} from '../../../model/group-members';
import { ConfigSwitch } from './config-switch';

interface GroupMemberPickerProps {
  threadId: string;
  memberIds: string[];
  onChange: (memberIds: string[]) => void;
}

const CHIP =
  'inline-flex h-7 items-center rounded-[3px] border px-2.5 text-xs font-medium transition-colors';
const CHIP_ACTIVE = 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500';
const CHIP_IDLE =
  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';

function MemberAvatar({ row }: { row: GroupMemberRow }) {
  const [imgError, setImgError] = useState(false);
  if (row.avatar && !imgError) {
    return (
      <img
        alt=""
        className="size-8 shrink-0 rounded-[3px] object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={row.avatar}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      {row.displayName.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export function GroupMemberPicker({ threadId, memberIds, onChange }: GroupMemberPickerProps) {
  const { t } = useLocale();
  const membersQuery = useZcaThreadMembersQuery(threadId);
  const usersQuery = useUsersQuery();
  const refreshMutation = useRefreshZcaThreadMembersMutation(threadId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<GroupMemberFilter>('all');

  const rows = useMemo(
    () => buildGroupMemberRows(membersQuery.data?.members ?? [], usersQuery.data ?? [], memberIds),
    [membersQuery.data, usersQuery.data, memberIds],
  );
  const visibleRows = useMemo(
    () => filterGroupMemberRows(rows, search, filter),
    [rows, search, filter],
  );
  const selectedCount = rows.filter((row) => row.isSelected).length;
  const total = membersQuery.data?.members.length ?? 0;

  if (membersQuery.isPending) {
    return (
      <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        {t('zca.memberAccess.loading')}
      </p>
    );
  }

  if (membersQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {t('zca.memberAccess.loadError')}
        </p>
        <button
          className={`${CHIP} ${CHIP_IDLE} ${TAP_CONTROL}`}
          onClick={() => void membersQuery.refetch()}
          type="button"
        >
          {t('zca.memberAccess.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={t('zca.memberAccess.searchPlaceholder')}
          className={`h-8 min-w-0 flex-1 rounded-[3px] border border-slate-200 bg-white px-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${TAP_INPUT}`}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('zca.memberAccess.searchPlaceholder')}
          type="search"
          value={search}
        />
        <div className="flex items-center gap-1.5">
          {(['all', 'selected'] as const).map((key) => (
            <button
              aria-pressed={filter === key}
              className={`${CHIP} ${filter === key ? CHIP_ACTIVE : CHIP_IDLE} ${TAP_CONTROL}`}
              key={key}
              onClick={() => setFilter(key)}
              type="button"
            >
              {t(
                key === 'all' ? 'zca.memberAccess.filter.all' : 'zca.memberAccess.filter.selected',
              )}
            </button>
          ))}
          <button
            className={`${CHIP} ${CHIP_IDLE} ${TAP_CONTROL} disabled:opacity-60`}
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
            type="button"
          >
            {t('zca.memberAccess.refresh')}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('zca.memberAccess.selectedCount', { count: selectedCount, total })}
      </p>

      {visibleRows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {t('zca.memberAccess.empty')}
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-[3px] border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {visibleRows.map((row) => {
            const alwaysAllowed = row.globalAccess !== 'none';
            return (
              <li className="flex min-h-12 items-center gap-2.5 px-3 py-2" key={row.id}>
                <MemberAvatar row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {row.displayName}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {row.zaloName && <span className="truncate">{row.zaloName}</span>}
                    <span className="font-mono">{row.id}</span>
                    {row.globalAccess === 'admin' && (
                      <span className="text-purple-700 dark:text-purple-300">
                        {t('zca.memberAccess.badge.admin')}
                      </span>
                    )}
                    {row.globalAccess === 'granted' && (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {t('zca.memberAccess.badge.global')}
                      </span>
                    )}
                    {row.hasLeft && (
                      <span className="text-amber-700 dark:text-amber-400">
                        {t('zca.memberAccess.badge.left')}
                      </span>
                    )}
                  </p>
                </div>
                {alwaysAllowed ? (
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    {t('zca.memberAccess.alwaysAllowed')}
                  </span>
                ) : (
                  <ConfigSwitch
                    checked={row.isSelected}
                    label={t('zca.memberAccess.toggleMember', { name: row.displayName })}
                    onChange={(selected) =>
                      onChange(setMemberSelected(memberIds, row.id, selected))
                    }
                    size="sm"
                    tone="emerald"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

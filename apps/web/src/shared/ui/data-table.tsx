'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo, Fragment, type ReactNode } from 'react';
import type { TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

type DataTableRow = { id: string };

export type DataTableColumn<T extends DataTableRow> = {
  id: string;
  header: ReactNode;
  label?: string;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  minWidth?: number | string;
  width?: number | string;
  hideable?: boolean;
  defaultHidden?: boolean;
};

export type TableEntityInfo = {
  tableName: string;
  entityName: string;
  entityKey: TranslationKey;
};

export function resolveTableEntityInfo(
  tableId?: string,
  customTableName?: string,
  customEntityName?: string,
): TableEntityInfo {
  if (customTableName) {
    return {
      tableName: customTableName,
      entityName: customEntityName ?? customTableName,
      entityKey: 'table.entity.general',
    };
  }

  const normalized = (tableId ?? '').toLowerCase();

  if (normalized.includes('transaction') || normalized.includes('expense')) {
    return {
      tableName: 'finance_transactions',
      entityName: 'finance_transactions',
      entityKey: 'table.entity.transactions',
    };
  }
  if (normalized.includes('debt')) {
    return {
      tableName: 'debts',
      entityName: 'debts',
      entityKey: 'table.entity.debts',
    };
  }
  if (normalized.includes('task')) {
    return {
      tableName: 'tasks',
      entityName: 'tasks',
      entityKey: 'table.entity.tasks',
    };
  }
  if (normalized.includes('reminder')) {
    return {
      tableName: 'reminders',
      entityName: 'reminders',
      entityKey: 'table.entity.reminders',
    };
  }
  if (normalized.includes('calendar')) {
    return {
      tableName: 'calendar_events',
      entityName: 'calendar_events',
      entityKey: 'table.entity.calendar',
    };
  }
  if (normalized.includes('contact')) {
    return {
      tableName: 'debt_contacts',
      entityName: 'debt_contacts',
      entityKey: 'table.entity.contacts',
    };
  }
  if (normalized.includes('place')) {
    return {
      tableName: 'finance_places',
      entityName: 'finance_places',
      entityKey: 'table.entity.places',
    };
  }
  if (normalized.includes('categor')) {
    return {
      tableName: 'categories',
      entityName: 'categories',
      entityKey: 'table.entity.categories',
    };
  }
  if (normalized.includes('budget')) {
    return {
      tableName: 'budgets',
      entityName: 'budgets',
      entityKey: 'table.entity.budgets',
    };
  }
  if (normalized.includes('cashflow')) {
    return {
      tableName: 'cashflow',
      entityName: 'cashflow',
      entityKey: 'table.entity.cashflow',
    };
  }

  return {
    tableName: tableId || 'records',
    entityName: tableId || 'records',
    entityKey: 'table.entity.general',
  };
}

export function IdExplainerDialog({
  isOpen,
  rowId,
  tableInfo,
  onClose,
}: {
  isOpen: boolean;
  rowId: string;
  tableInfo: TableEntityInfo;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, key: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const entityLabel = t(tableInfo.entityKey);

  const prompts = [
    {
      key: 'update',
      title: t('table.idModal.promptUpdate'),
      text: t('table.idModal.promptUpdateTemplate', {
        entity: entityLabel,
        id: rowId,
      }),
      actionIcon: '✏️',
    },
    {
      key: 'delete',
      title: t('table.idModal.promptDelete'),
      text: t('table.idModal.promptDeleteTemplate', {
        entity: entityLabel,
        id: rowId,
      }),
      actionIcon: '🗑️',
    },
    {
      key: 'detail',
      title: t('table.idModal.promptDetail'),
      text: t('table.idModal.promptDetailTemplate', {
        entity: entityLabel,
        id: rowId,
      }),
      actionIcon: '🔍',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[950] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[520px] rounded-md border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label={t('table.idModal.title')}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h3 className="m-0 flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              <span aria-hidden="true">🆔</span>
              <span>{t('table.idModal.title')}</span>
            </h3>
            <p className="m-0 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              {t('table.idModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            className="flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </header>

        <div className="flex max-h-[calc(85vh-120px)] flex-col gap-3.5 overflow-y-auto px-5 py-4">
          {/* Metadata: Table & Entity */}
          <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <span className="mb-0.5 block text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                {t('table.idModal.tableName')}
              </span>
              <code className="font-mono text-[11px] font-bold text-sky-700 dark:text-sky-400">
                {tableInfo.tableName}
              </code>
            </div>
            <div>
              <span className="mb-0.5 block text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                {t('table.idModal.entityName')}
              </span>
              <strong className="block truncate text-[11.5px] text-slate-800 dark:text-slate-200">
                {entityLabel}
              </strong>
            </div>
          </div>

          {/* Full ID Card with Copy */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
              {t('table.idModal.fullId')}
            </label>
            <div className="flex items-center gap-2 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950">
              <code className="flex-1 select-all break-all font-mono text-[11.5px] text-slate-800 dark:text-slate-200">
                {rowId}
              </code>
              <button
                type="button"
                className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-[3px] border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => void handleCopy(rowId, 'id')}
              >
                {copiedKey === 'id' ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ {t('table.idModal.copied')}
                  </span>
                ) : (
                  <>
                    <svg
                      className="size-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>{t('table.idModal.copyId')}</span>
                  </>
                )}
              </button>
            </div>
            <p className="m-0 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              {t('table.idModal.explanation', { table: tableInfo.tableName })}
            </p>
          </div>

          {/* AI Agent Prompt Section */}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <div>
              <strong className="flex items-center gap-1 text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                <span aria-hidden="true">🤖</span>
                <span>{t('table.idModal.agentPromptTitle')}</span>
              </strong>
              <p className="m-0 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {t('table.idModal.agentPromptDesc')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {prompts.map((p) => (
                <div
                  key={p.key}
                  className="flex flex-col gap-1 rounded border border-slate-200 bg-white p-2 text-xs transition-colors hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      {p.actionIcon} {p.title}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-5 cursor-pointer items-center gap-1 rounded-[2px] border border-sky-200 bg-sky-50 px-1.5 text-[10.5px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/80"
                      onClick={() => void handleCopy(p.text, p.key)}
                    >
                      {copiedKey === p.key ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ {t('table.idModal.copied')}
                        </span>
                      ) : (
                        <span>{t('table.idModal.copyPrompt')}</span>
                      )}
                    </button>
                  </div>
                  <code className="select-all break-all rounded border border-slate-100 bg-slate-50 p-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/80 dark:text-slate-400">
                    {p.text}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            type="button"
            className="inline-flex min-h-7 items-center justify-center rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}

type DataTableProps<T extends DataTableRow> = {
  id?: string;
  tableName?: string;
  entityName?: string;
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage: string;
  getRowKey?: (row: T, index: number) => string | number;
  getRowClassName?: (row: T, index: number) => string | undefined;
  renderExpandedRow?: (row: T, index: number) => ReactNode;
  isRowExpanded?: (row: T, index: number) => boolean;
  disableSorting?: boolean;
  loading?: boolean;
  allowColumnToggle?: boolean;
  allowColumnResize?: boolean;
};

const occurrenceTimeFields = [
  'occurredAt',
  'paymentDate',
  'remindAt',
  'startAt',
  'dueAt',
  'createdAt',
] as const;

const upcomingTimeFields = new Set(['remindAt', 'startAt', 'dueAt']);

function getOccurrenceTime(row: DataTableRow): { timestamp: number; ascending: boolean } | null {
  const values = row as Record<string, unknown>;
  for (const field of occurrenceTimeFields) {
    const value = values[field];
    if (typeof value !== 'string' || !value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) return { timestamp, ascending: upcomingTimeFields.has(field) };
  }
  return null;
}

export function DataPanel({
  title,
  titleHref,
  description,
  toolbar,
  counter,
  children,
}: {
  title: string;
  titleHref?: string;
  description?: string;
  toolbar?: ReactNode;
  counter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      aria-label={title}
    >
      <header className="flex min-h-10 flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950/60 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="m-0 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            {titleHref ? (
              <Link
                href={titleHref}
                className="group inline-flex items-center gap-1.5 transition-colors hover:text-sky-600 dark:hover:text-sky-400"
              >
                <span>{title}</span>
                <span
                  className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              </Link>
            ) : (
              title
            )}
          </h2>
          {description && (
            <p className="m-0 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {(toolbar || counter) && (
          <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:justify-between">
            {toolbar}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

export function TableColumnSettings<T extends DataTableRow>({
  columns,
  visibleColumnIds,
  onToggleColumn,
  onResetColumns,
  onShowAllColumns,
}: {
  columns: DataTableColumn<T>[];
  visibleColumnIds: string[];
  onToggleColumn: (id: string) => void;
  onResetColumns: () => void;
  onShowAllColumns: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

  const hiddenCount = columns.length - visibleColumnIds.length;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        className={`inline-flex h-6 min-h-6 items-center gap-1.5 rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
          hiddenCount > 0
            ? 'border-sky-500 text-sky-600 hover:bg-sky-50 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-950/50'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('table.columnSettings')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={t('table.columnSettings')}
      >
        <svg
          className="size-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{t('table.columnVisibility')}</span>
        {hiddenCount > 0 && (
          <span className="rounded-[2px] bg-sky-100 px-1 text-[10px] font-semibold leading-3.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            {t('table.columnsHiddenBadge', { count: hiddenCount })}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 flex min-w-[200px] max-w-[calc(100vw-32px)] flex-col rounded border border-slate-300 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-2.5 pb-1.5 text-[11px] dark:border-slate-800">
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {t('table.columnVisibility')}
            </strong>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {t('table.columnsCount', {
                visible: visibleColumnIds.length,
                total: columns.length,
              })}
            </span>
          </header>

          <ul className="m-0 flex max-h-[220px] list-none flex-col overflow-y-auto p-1">
            {columns.map((column) => {
              const isChecked = visibleColumnIds.includes(column.id);
              const isRequired = column.hideable === false;
              const isLastVisible = isChecked && visibleColumnIds.length === 1;
              const isDisabled = isRequired || isLastVisible;

              return (
                <li key={column.id} className="flex">
                  <label className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-[11.5px] text-slate-700 transition-colors hover:bg-slate-50 select-none dark:text-slate-300 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      className="cursor-pointer accent-slate-900 dark:accent-sky-500 disabled:cursor-not-allowed"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => onToggleColumn(column.id)}
                    />
                    <span className="flex-1 text-slate-700 dark:text-slate-300">
                      {column.label ??
                        (typeof column.header === 'string' ? column.header : column.id)}
                    </span>
                    {isRequired && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {t('table.columnRequired')}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <footer className="flex items-center justify-between gap-1.5 border-t border-slate-100 px-2.5 pt-1.5 pb-0.5 text-[10.5px] dark:border-slate-800">
            <button
              type="button"
              className="cursor-pointer rounded-[2px] border-0 bg-transparent px-1 py-0.5 text-[10.5px] font-medium text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
              onClick={onShowAllColumns}
            >
              {t('table.showAllColumns')}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-[2px] border-0 bg-transparent px-1 py-0.5 text-[10.5px] font-medium text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
              onClick={onResetColumns}
            >
              {t('table.resetColumns')}
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

export function DataTable<T extends DataTableRow>({
  id,
  tableName,
  entityName,
  ariaLabel,
  columns,
  rows,
  emptyMessage,
  getRowKey = (row) => row.id,
  getRowClassName,
  renderExpandedRow,
  isRowExpanded,
  disableSorting = false,
  loading = false,
  allowColumnToggle,
  allowColumnResize = Boolean(id),
}: DataTableProps<T>) {
  const { t } = useLocale();
  const isToggleAllowed = allowColumnToggle ?? (Boolean(id) || columns.length > 2);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [inspectedRowId, setInspectedRowId] = useState<string | null>(null);
  const hasLoadedColumnWidths = useRef(false);
  const hasChangedColumnWidths = useRef(false);

  const tableInfo = useMemo(
    () => resolveTableEntityInfo(id, tableName, entityName),
    [id, tableName, entityName],
  );

  const systemColumns = useMemo<DataTableColumn<T>[]>(
    () => [
      {
        id: 'stt',
        header: t('table.ordinal'),
        align: 'right',
        minWidth: 56,
        width: 56,
        hideable: false,
        cell: (_, index) => (
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{index + 1}</span>
        ),
      },
      {
        id: 'id',
        header: t('table.id'),
        minWidth: 160,
        width: 220,
        hideable: false,
        cell: (row) => (
          <button
            type="button"
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] border border-transparent px-1.5 py-0.5 font-mono text-[11px] text-slate-600 transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:ring-1 focus:ring-sky-500 focus:outline-none dark:text-slate-400 dark:hover:border-sky-800 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
            onClick={(e) => {
              e.stopPropagation();
              setInspectedRowId(row.id);
            }}
            title={t('table.idClickToInspect')}
            aria-label={`${t('table.id')}: ${row.id}`}
          >
            <span className="truncate">{row.id}</span>
            <svg
              className="size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
        ),
      },
    ],
    [t],
  );

  const allColumns = useMemo(() => [...systemColumns, ...columns], [columns, systemColumns]);
  const allColumnsKey = useMemo(
    () => allColumns.map((column) => column.id).join(','),
    [allColumns],
  );

  const initialColumnIds = useMemo(() => {
    return allColumns.filter((column) => !column.defaultHidden).map((column) => column.id);
  }, [allColumns]);

  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(initialColumnIds);

  useEffect(() => {
    if (!allowColumnResize || !id || typeof window === 'undefined') {
      hasLoadedColumnWidths.current = true;
      return;
    }

    try {
      const stored = localStorage.getItem(`zalobot:table-widths:${id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        if (parsed && typeof parsed === 'object') {
          const nextWidths = Object.fromEntries(
            Object.entries(parsed).filter(
              ([columnId, width]) =>
                allColumns.some((column) => column.id === columnId) &&
                typeof width === 'number' &&
                Number.isFinite(width) &&
                width > 0,
            ),
          );
          setColumnWidths((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(nextWidths);
            if (
              prevKeys.length === nextKeys.length &&
              nextKeys.every((k) => prev[k] === nextWidths[k])
            ) {
              return prev;
            }
            return nextWidths;
          });
        }
      }
    } catch {
      // Gracefully ignore storage access errors
    } finally {
      hasLoadedColumnWidths.current = true;
    }
  }, [allColumnsKey, allColumns, allowColumnResize, id]);

  useEffect(() => {
    if (
      !allowColumnResize ||
      !id ||
      typeof window === 'undefined' ||
      !hasLoadedColumnWidths.current ||
      !hasChangedColumnWidths.current
    ) {
      return;
    }

    try {
      localStorage.setItem(`zalobot:table-widths:${id}`, JSON.stringify(columnWidths));
    } catch {
      // Gracefully ignore storage access errors
    }
  }, [allowColumnResize, columnWidths, id]);

  // Synchronize with localStorage
  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(`zalobot:table-columns:${id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = parsed.filter((columnId) =>
            allColumns.some((column) => column.id === columnId),
          );
          const nonHideableIds = allColumns
            .filter((column) => column.hideable === false)
            .map((column) => column.id);
          const merged = Array.from(new Set([...validIds, ...nonHideableIds]));
          if (merged.length > 0) {
            setVisibleColumnIds((prev) => {
              if (prev.length === merged.length && prev.every((val, idx) => val === merged[idx])) {
                return prev;
              }
              return merged;
            });
          }
        }
      }
    } catch {
      // Gracefully ignore storage access errors
    }
  }, [allColumnsKey, allColumns, id]);

  const saveVisibleColumnIds = (newIds: string[]) => {
    setVisibleColumnIds(newIds);
    if (id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`zalobot:table-columns:${id}`, JSON.stringify(newIds));
      } catch {
        // Gracefully ignore storage write errors
      }
    }
  };

  const handleToggleColumn = (columnId: string) => {
    const isVisible = visibleColumnIds.includes(columnId);
    if (isVisible) {
      const col = allColumns.find((column) => column.id === columnId);
      if (col?.hideable === false) return;
      if (visibleColumnIds.length <= 1) return;
      saveVisibleColumnIds(visibleColumnIds.filter((cid) => cid !== columnId));
    } else {
      saveVisibleColumnIds([...visibleColumnIds, columnId]);
    }
  };

  const handleResetColumns = () => {
    saveVisibleColumnIds(initialColumnIds);
  };

  const handleShowAllColumns = () => {
    saveVisibleColumnIds(allColumns.map((column) => column.id));
  };

  const visibleColumns = useMemo(() => {
    const visibleSet = new Set(visibleColumnIds);
    const filtered = allColumns.filter((column) => visibleSet.has(column.id));
    return filtered.length > 0 ? filtered : allColumns;
  }, [allColumns, visibleColumnIds]);

  const sortedRows = useMemo(() => {
    if (disableSorting) return rows;
    return rows
      .map((row, index) => ({ row, index, occurrence: getOccurrenceTime(row) }))
      .sort((left, right) => {
        if (!left.occurrence && !right.occurrence) return left.index - right.index;
        if (!left.occurrence) return 1;
        if (!right.occurrence) return -1;
        const direction = left.occurrence.ascending ? 1 : -1;
        return (
          (left.occurrence.timestamp - right.occurrence.timestamp) * direction ||
          left.index - right.index
        );
      })
      .map(({ row }) => row);
  }, [rows, disableSorting]);

  const getColumnWidth = (column: DataTableColumn<T>) => columnWidths[column.id] ?? column.width;

  const getMinimumColumnWidth = (column: DataTableColumn<T>) => {
    if (typeof column.minWidth === 'number') return column.minWidth;
    if (typeof column.minWidth === 'string') {
      const parsed = Number.parseFloat(column.minWidth);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 80;
  };

  const handleResizeStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    column: DataTableColumn<T>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const header = event.currentTarget.parenzaloment;
    if (!header) return;

    const startX = event.clientX;
    const startWidth = header.getBoundingClientRect().width;
    const minWidth = getMinimumColumnWidth(column);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      hasChangedColumnWidths.current = true;
      setColumnWidths((current) => ({
        ...current,
        [column.id]: Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX)),
      }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  return (
    <div className="relative flex w-full flex-col">
      {isToggleAllowed && (
        <div className="flex items-center justify-end border-b border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-950/40">
          <TableColumnSettings
            columns={allColumns}
            visibleColumnIds={visibleColumnIds}
            onToggleColumn={handleToggleColumn}
            onResetColumns={handleResetColumns}
            onShowAllColumns={handleShowAllColumns}
          />
        </div>
      )}

      <div className="relative max-h-[520px] w-full min-w-0 overflow-auto" aria-busy={loading}>
        <table
          className="w-full min-w-full border-collapse text-left text-xs max-[640px]:min-w-max"
          aria-label={ariaLabel}
        >
          <colgroup>
            {visibleColumns.map((column) => (
              <col
                key={column.id}
                style={{
                  width: getColumnWidth(column),
                  minWidth: column.minWidth,
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`sticky top-0 z-[2] h-7 border-r border-b border-r-slate-200 border-b-slate-300 bg-slate-100 px-2 text-[10.5px] font-bold tracking-wider text-slate-600 uppercase whitespace-nowrap last:border-r-0 dark:border-r-slate-800 dark:border-b-slate-700 dark:bg-slate-900 dark:text-slate-400 ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  } ${allowColumnResize ? 'relative' : ''}`.trim()}
                  style={{
                    minWidth: column.minWidth,
                    width: getColumnWidth(column),
                  }}
                >
                  {column.header}
                  {allowColumnResize && (
                    <button
                      type="button"
                      className="group absolute top-0 -right-1 z-[3] h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 after:absolute after:top-1.5 after:left-[3px] after:h-3.5 after:w-0.5 after:bg-sky-600 after:opacity-0 hover:after:opacity-100 focus-visible:after:opacity-100"
                      aria-label={`Resize ${typeof column.header === 'string' ? column.header : column.id} column`}
                      onPointerDown={(event) => handleResizeStart(event, column)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={`h-8 border-r border-b border-r-slate-50 border-b-slate-100 px-2 py-1 align-middle text-xs tabular-nums text-slate-700 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800 dark:text-slate-300 ${
                        column.align === 'right' ? 'text-right' : 'text-left'
                      } ${column.className ?? ''}`.trim()}
                      style={{
                        minWidth: column.minWidth,
                        width: getColumnWidth(column),
                      }}
                    >
                      <span
                        className={`block h-2.5 w-3/4 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800 ${
                          column.align === 'right' ? 'ml-auto' : ''
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedRows.length > 0 ? (
              sortedRows.map((row, index) => {
                const customClassName = getRowClassName ? getRowClassName(row, index) : '';
                const rowKey = getRowKey(row, index);
                const isExpanded = isRowExpanded ? isRowExpanded(row, index) : false;
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${customClassName || ''}`.trim()}
                    >
                      {visibleColumns.map((column) => (
                        <td
                          key={column.id}
                          className={`h-8 border-r border-b border-r-slate-50 border-b-slate-100 px-2 py-1 align-middle text-xs tabular-nums text-slate-700 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800 dark:text-slate-300 ${
                            column.align === 'right' ? 'text-right' : 'text-left'
                          } ${column.className ?? ''}`.trim()}
                          style={{
                            minWidth: column.minWidth,
                            width: getColumnWidth(column),
                          }}
                        >
                          {column.cell(row, index)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpandedRow && (
                      <tr className="bg-slate-50/70 transition-colors dark:bg-slate-900/50">
                        <td
                          colSpan={visibleColumns.length}
                          className="border-b border-slate-200 p-0 dark:border-slate-800"
                        >
                          {renderExpandedRow(row, index)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <tr className="h-20 text-center text-slate-400 italic">
                <td colSpan={visibleColumns.length}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inspectedRowId && (
        <IdExplainerDialog
          isOpen={Boolean(inspectedRowId)}
          rowId={inspectedRowId}
          tableInfo={tableInfo}
          onClose={() => setInspectedRowId(null)}
        />
      )}
    </div>
  );
}

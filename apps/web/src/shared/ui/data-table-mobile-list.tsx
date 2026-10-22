'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import type { DataTableColumn } from './data-table';
import { partitionMobileColumns } from './data-table-mobile';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from './modal';

type DataTableRow = { id: string };

type DataTableMobileListProps<T extends DataTableRow> = {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage: string;
  loading: boolean;
  getRowKey: (row: T, index: number) => string | number;
  renderExpandedRow?: (row: T, index: number) => ReactNode;
  onInspectId: (rowId: string) => void;
};

const isBlank = (node: ReactNode) =>
  node === null || node === undefined || node === false || node === '';

const columnLabel = <T extends DataTableRow>(column: DataTableColumn<T>) =>
  column.label ?? (typeof column.header === 'string' ? column.header : column.id);

/**
 * Phone-width rendering of a DataTable: one flat two-line row per record
 * (primary + trailing, then secondary metadata), and a bottom sheet holding
 * every column, the expanded detail and the row actions. Sheet cells reuse
 * `column.cell`, so inline editing works there unchanged.
 */
export function DataTableMobileList<T extends DataTableRow>({
  ariaLabel,
  columns,
  rows,
  emptyMessage,
  loading,
  getRowKey,
  renderExpandedRow,
  onInspectId,
}: DataTableMobileListProps<T>) {
  const { t } = useLocale();
  const layout = useMemo(() => partitionMobileColumns(columns), [columns]);
  const [selectedKey, setSelectedKey] = useState<string | number | null>(null);

  const selectedIndex =
    selectedKey === null
      ? -1
      : rows.findIndex((row, index) => getRowKey(row, index) === selectedKey);
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : undefined;

  // Close the sheet once its record leaves the list (deleted, filtered out).
  useEffect(() => {
    if (selectedKey !== null && !selectedRow) setSelectedKey(null);
  }, [selectedKey, selectedRow]);

  const slotContent = (column: DataTableColumn<T> | undefined, row: T, index: number) =>
    column ? (column.mobileCell ?? column.cell)(row, index) : null;

  return (
    <div className="flex w-full flex-col" aria-busy={loading}>
      {layout.headers.length > 0 && (
        <div
          className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950/40"
          role="toolbar"
          aria-label={ariaLabel}
        >
          {layout.headers.map((column) => (
            <div
              key={column.id}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[3px] border border-slate-200 bg-white pl-2.5 text-[10.5px] font-bold tracking-wider whitespace-nowrap text-slate-600 uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            >
              {column.header}
            </div>
          ))}
        </div>
      )}

      <ul className="m-0 list-none p-0" aria-label={ariaLabel}>
        {loading ? (
          Array.from({ length: 4 }, (_, index) => (
            <li
              key={index}
              className="flex min-h-[52px] flex-col justify-center gap-1.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800"
            >
              <span className="flex items-center gap-3">
                <span className="block h-3 flex-1 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
                <span className="block h-3 w-16 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
              </span>
              <span className="block h-2.5 w-1/2 animate-pulse rounded-[2px] bg-slate-100 dark:bg-slate-800/70" />
            </li>
          ))
        ) : rows.length > 0 ? (
          rows.map((row, index) => {
            const secondary = layout.secondary
              .map((column) => ({ id: column.id, node: slotContent(column, row, index) }))
              .filter((item) => !isBlank(item.node));
            return (
              <li
                key={getRowKey(row, index)}
                className="border-b border-slate-100 dark:border-slate-800"
              >
                <button
                  type="button"
                  className="flex min-h-[52px] w-full cursor-pointer flex-col justify-center gap-0.5 border-0 !bg-transparent px-3 py-2.5 text-left transition-colors hover:!bg-slate-50 dark:hover:!bg-slate-800/60"
                  onClick={() => setSelectedKey(getRowKey(row, index))}
                >
                  <span className="flex w-full min-w-0 items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                      {slotContent(layout.primary, row, index)}
                    </span>
                    {layout.trailing && (
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                        {slotContent(layout.trailing, row, index)}
                      </span>
                    )}
                  </span>
                  {secondary.length > 0 && (
                    <span className="block w-full truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                      {secondary.map((item, itemIndex) => (
                        <span key={item.id}>
                          {itemIndex > 0 && <span aria-hidden="true"> · </span>}
                          {item.node}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        ) : (
          <li className="flex h-20 items-center justify-center text-xs text-slate-400 italic">
            {emptyMessage}
          </li>
        )}
      </ul>

      {selectedRow && (
        <Modal
          open
          onDismiss={() => setSelectedKey(null)}
          dismissOnBackdrop
          ariaLabel={t('table.rowDetails')}
          panelClassName="max-w-lg rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <header
            className={`${MODAL_STICKY_HEADER} flex items-center gap-2 border-b border-slate-200 bg-white py-1 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900`}
          >
            <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {slotContent(layout.primary, selectedRow, selectedIndex) ?? t('table.rowDetails')}
            </h2>
            <button
              type="button"
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 !bg-transparent text-lg text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:!bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setSelectedKey(null)}
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </header>

          {/* Desktop-sized inline-edit fields (22–28px) become 40px touch targets inside the sheet. */}
          <dl className="m-0 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 px-3 py-1 text-xs [&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:min-h-10 [&_dd_button]:min-h-10">
            {layout.detail.map((column) => (
              <div
                key={column.id}
                className="col-span-2 grid grid-cols-subgrid items-center border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800"
              >
                <dt className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  {columnLabel(column)}
                </dt>
                <dd className="m-0 min-w-0 text-slate-800 tabular-nums dark:text-slate-200">
                  {column.cell(selectedRow, selectedIndex)}
                </dd>
              </div>
            ))}
            <div className="col-span-2 grid grid-cols-subgrid items-center py-1">
              <dt className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('table.id')}
              </dt>
              <dd className="m-0 min-w-0">
                <button
                  type="button"
                  className="inline-flex min-h-10 max-w-full cursor-pointer items-center rounded-[2px] border border-transparent !bg-transparent px-0 font-mono text-[11px] text-slate-600 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300"
                  onClick={() => onInspectId(selectedRow.id)}
                  title={t('table.idClickToInspect')}
                >
                  <span className="truncate">{selectedRow.id}</span>
                </button>
              </dd>
            </div>
          </dl>

          {renderExpandedRow && (
            <div className="border-t border-slate-200 dark:border-slate-800">
              {renderExpandedRow(selectedRow, selectedIndex)}
            </div>
          )}

          {layout.actions && (
            <footer
              // Row action buttons/links are 22px on desktop; give them 40px targets in the sheet footer.
              className={`${MODAL_STICKY_FOOTER} flex justify-end border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 [&_:is(a,button)]:inline-flex [&_:is(a,button)]:min-h-10 [&_:is(a,button)]:min-w-10 [&_:is(a,button)]:items-center [&_:is(a,button)]:justify-center [&_:is(a,button)]:px-3`}
            >
              {layout.actions.cell(selectedRow, selectedIndex)}
            </footer>
          )}
        </Modal>
      )}
    </div>
  );
}

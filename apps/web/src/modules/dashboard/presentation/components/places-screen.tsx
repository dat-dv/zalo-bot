'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localeTag, type IFinancePlace } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import {
  placesQueryKeys,
  usePlacesQuery,
  useCreatePlaceMutation,
  useUpdatePlaceMutation,
  useDeletePlaceMutation,
} from '../../api/places-query';
import { CombinePlacesDialog } from './combine-places-dialog';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import {
  MOBILE_TOOLBAR_ROW,
  PHONE_CHIP,
  PHONE_TOOLBAR_INPUT,
  TOAST_POSITION,
} from '@/shared/ui/touch';
import { useIsCompact } from '@/shared/hooks/use-media-query';

export function PlacesScreen() {
  const queryClient = useQueryClient();
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string }>({ name: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  // Compact list rows open a detail sheet on tap, so picking places to combine needs its own mode.
  const [isSelectMode, setIsSelectMode] = useState(false);
  const isCompact = useIsCompact();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const places = usePlacesQuery();
  const createMutation = useCreatePlaceMutation();
  const updateMutation = useUpdatePlaceMutation();
  const deleteMutation = useDeletePlaceMutation();

  const refresh = () => void queryClient.invalidateQueries({ queryKey: placesQueryKeys.list() });

  const rawList = useMemo(() => places.data ?? [], [places.data]);

  const filteredPlaces = useMemo(() => {
    if (!search.trim()) return rawList;
    const query = search.toLowerCase();
    return rawList.filter((item) => item.name.toLowerCase().includes(query));
  }, [rawList, search]);

  const selectedPlaces = useMemo(() => {
    return rawList.filter((p) => selectedIds.has(p.id));
  }, [rawList, selectedIds]);

  const isSelectListShown = isCompact && isSelectMode;
  const showSelectionChips = !isCompact || isSelectMode;

  const formatDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value))
      : t('common.notSet');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPlaces.length && filteredPlaces.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlaces.map((p) => p.id)));
    }
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleStartEdit = (place: IFinancePlace) => {
    setEditingId(place.id);
    setEditDraft({ name: place.name });
    setDeleteConfirmId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: '' });
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedName = editDraft.name.trim();
    if (!trimmedName) return;

    try {
      await updateMutation.mutateAsync({
        id,
        data: { name: trimmedName },
      });
      setEditingId(null);
      showToast(t('places.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaceName.trim();
    if (!trimmed) return;

    try {
      await createMutation.mutateAsync({ name: trimmed });
      setNewPlaceName('');
      setIsCreating(false);
      showToast(t('places.create.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeletePlace = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast(t('places.delete.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const placeColumns: DataTableColumn<IFinancePlace>[] = [
    {
      id: 'select',
      header: (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="cursor-pointer accent-slate-900 dark:accent-sky-500"
            checked={filteredPlaces.length > 0 && selectedIds.size === filteredPlaces.length}
            onChange={handleToggleSelectAll}
            aria-label={t('places.selectAll')}
          />
        </label>
      ),
      label: t('places.selectAll'),
      minWidth: '44px',
      width: '44px',
      hideable: false,
      cell: (item) => (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="cursor-pointer accent-slate-900 dark:accent-sky-500"
            checked={selectedIds.has(item.id)}
            onChange={() => handleToggleRow(item.id)}
            aria-label={item.name}
          />
        </label>
      ),
    },
    {
      id: 'name',
      header: t('places.columns.name'),
      minWidth: '220px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: (item) => item.name,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.name}
              onChange={(e) => setEditDraft({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('places.placeholder.name')}
              autoFocus
              required
              aria-label={t('places.columns.name')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer font-semibold text-slate-900 select-none hover:text-sky-600 dark:text-slate-100 dark:hover:text-sky-400"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.name}
          >
            {item.name}
          </span>
        );
      },
    },
    {
      id: 'transactionCount',
      header: t('places.columns.transactionCount'),
      minWidth: '110px',
      align: 'right',
      mobileSlot: 'trailing',
      mobileCell: (item) => String(item.transactionCount ?? 0),
      cell: (item) => (
        <span className="font-mono text-[11.5px] text-slate-600 dark:text-slate-400">
          {item.transactionCount ?? 0}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: t('dashboard.columns.date'),
      minWidth: '140px',
      align: 'right',
      mobileSlot: 'secondary',
      mobileCell: (item) => formatDate(item.createdAt),
      cell: (item) => (
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('dashboard.columns.action'),
      minWidth: '140px',
      align: 'right',
      hideable: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-emerald-600 bg-emerald-600 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                onClick={() => void handleSaveEdit(item.id)}
                disabled={updateMutation.isPending}
                title={t('places.actions.save')}
              >
                ✓ {t('places.actions.save')}
              </button>
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
                title={t('places.actions.cancel')}
              >
                ✕
              </button>
            </div>
          );
        }

        if (deleteConfirmId === item.id) {
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-rose-600 bg-rose-600 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-rose-700 dark:border-rose-500 dark:bg-rose-500 dark:hover:bg-rose-600"
                onClick={() => void handleDeletePlace(item.id)}
                disabled={deleteMutation.isPending}
                title={t('places.actions.delete')}
              >
                ✓ {t('places.actions.delete')}
              </button>
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
                title={t('places.actions.cancel')}
              >
                ✕
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
            <button
              type="button"
              className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              onClick={() => handleStartEdit(item)}
              title={t('places.actions.edit')}
            >
              ✎ {t('places.actions.edit')}
            </button>
            <button
              type="button"
              className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-medium text-rose-700 whitespace-nowrap transition-colors hover:bg-rose-100 hover:text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 dark:hover:text-rose-100"
              onClick={() => {
                setDeleteConfirmId(item.id);
                setEditingId(null);
              }}
              title={t('places.actions.delete')}
              aria-label={t('places.actions.delete')}
            >
              <span aria-hidden="true">🗑️</span>
            </button>
          </div>
        );
      },
    },
  ];

  // The select column would show up as a field in the detail sheet; compact uses select mode instead.
  const visibleColumns = isCompact
    ? placeColumns.filter((column) => column.id !== 'select')
    : placeColumns;

  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredPlaces.length;

  return (
    <>
      {toastMessage && (
        <div
          className={`${TOAST_POSITION} rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      {places.isError ? (
        <section
          className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          role="alert"
        >
          <strong>{t('dashboard.error.title')}</strong>
          <button
            type="button"
            className="cursor-pointer rounded-[2px] bg-rose-600 px-2 py-0.5 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 max-[640px]:h-10 max-[640px]:px-3"
            onClick={refresh}
          >
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <section className="grid gap-3">
          <DataPanel
            title={t('places.title')}
            description={t('places.subtitle')}
            counter={t('table.rowsCount', { count: filteredPlaces.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                {/* Phones: one sideways-scrolling chip row, then the create form and search. */}
                <div
                  className={`flex flex-wrap items-center gap-1.5 empty:hidden ${MOBILE_TOOLBAR_ROW}`}
                >
                  {selectedIds.size >= 2 && (
                    <button
                      type="button"
                      // Compact screens get this action in the MobileActionBar instead.
                      className="inline-flex h-6 min-h-6 items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 max-[960px]:hidden"
                      onClick={() => setIsCombineOpen(true)}
                    >
                      {t('places.actions.combine', { count: selectedIds.size })}
                    </button>
                  )}
                  {isCompact && filteredPlaces.length > 0 && (
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 whitespace-nowrap ${PHONE_CHIP} cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                        isSelectMode
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={handleToggleSelectMode}
                      aria-pressed={isSelectMode}
                    >
                      {isSelectMode ? t('places.selectModeDone') : t('places.selectMode')}
                    </button>
                  )}
                  {showSelectionChips && filteredPlaces.length > 0 && (
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 whitespace-nowrap ${PHONE_CHIP} cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                        selectedIds.size === filteredPlaces.length
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={handleToggleSelectAll}
                    >
                      {selectedIds.size === filteredPlaces.length
                        ? t('places.deselectAll')
                        : t('places.selectAll')}
                    </button>
                  )}
                  {showSelectionChips && isPartiallySelected && (
                    <button
                      type="button"
                      className="inline-flex h-6 min-h-6 shrink-0 whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] cursor-pointer items-center rounded-[3px] border border-sky-500 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50"
                      onClick={() => setSelectedIds(new Set())}
                      title={t('places.deselectAll')}
                    >
                      {t('places.selectedCount', { count: selectedIds.size })} ✕
                    </button>
                  )}
                </div>
                {isCreating ? (
                  <form
                    onSubmit={(e) => void handleCreatePlace(e)}
                    className="flex items-center gap-1 max-[640px]:w-full"
                  >
                    <input
                      type="text"
                      className="h-6 min-h-6 w-48 max-[640px]:h-10 max-[640px]:min-w-0 max-[640px]:flex-1 rounded-[3px] border border-sky-600 bg-white px-2 text-[11.5px] text-slate-900 outline-none dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                      placeholder={t('places.placeholder.name')}
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      autoFocus
                      required
                    />
                    <button
                      type="submit"
                      disabled={createMutation.isPending || !newPlaceName.trim()}
                      className="inline-flex h-6 min-h-6 max-[640px]:h-10 max-[640px]:px-3 cursor-pointer items-center justify-center rounded-[3px] border border-emerald-600 bg-emerald-600 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-500 dark:bg-emerald-500"
                    >
                      ✓ {t('places.actions.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewPlaceName('');
                      }}
                      className="inline-flex h-6 min-h-6 max-[640px]:size-10 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    // Compact screens get this action in the MobileActionBar instead.
                    className="inline-flex h-6 min-h-6 max-[960px]:hidden cursor-pointer items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
                  >
                    + {t('places.actions.create')}
                  </button>
                )}
                <input
                  type="search"
                  className={`h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${PHONE_TOOLBAR_INPUT}`}
                  placeholder={t('table.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
              </div>
            }
          >
            {isSelectListShown && !places.isLoading ? (
              <ul className="m-0 list-none p-0" aria-label={t('places.title')}>
                {filteredPlaces.length > 0 ? (
                  filteredPlaces.map((item) => (
                    <li key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      {/* The whole row is the checkbox's label: a 52px tap target, same checkbox look. */}
                      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          className="shrink-0 cursor-pointer accent-slate-900 dark:accent-sky-500"
                          checked={selectedIds.has(item.id)}
                          onChange={() => handleToggleRow(item.id)}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-baseline gap-3">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                              {item.name}
                            </span>
                            <span className="shrink-0 text-[13px] font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                              {item.transactionCount ?? 0}
                            </span>
                          </span>
                          <span className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                            {formatDate(item.createdAt)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))
                ) : (
                  <li className="flex h-20 items-center justify-center text-xs text-slate-400 italic">
                    {t('places.noData')}
                  </li>
                )}
              </ul>
            ) : (
              <DataTable
                id="places"
                ariaLabel={t('places.title')}
                rows={filteredPlaces}
                loading={places.isLoading}
                emptyMessage={t('places.noData')}
                columns={visibleColumns}
                getRowKey={(item) => item.id}
              />
            )}
          </DataPanel>
        </section>
      )}

      {isSelectListShown
        ? selectedIds.size >= 2 && (
            <MobileActionBar>
              <button
                type="button"
                onClick={() => setIsCombineOpen(true)}
                className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500`}
              >
                {t('places.actions.combine', { count: selectedIds.size })}
              </button>
            </MobileActionBar>
          )
        : !isCreating && (
            <MobileActionBar>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500`}
              >
                + {t('places.actions.create')}
              </button>
            </MobileActionBar>
          )}

      <CombinePlacesDialog
        isOpen={isCombineOpen}
        selectedPlaces={selectedPlaces}
        onClose={() => setIsCombineOpen(false)}
        onSuccess={(count) => {
          setSelectedIds(new Set());
          setIsSelectMode(false);
          showToast(t('places.combine.success', { count }));
        }}
      />
    </>
  );
}

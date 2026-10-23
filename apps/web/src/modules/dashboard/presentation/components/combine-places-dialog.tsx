'use client';

import { useState, useEffect, useId, useMemo } from 'react';
import type { IFinancePlace } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';
import { useCombinePlacesMutation } from '../../api/places-query';

interface CombinePlacesDialogProps {
  isOpen: boolean;
  selectedPlaces: IFinancePlace[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function CombinePlacesDialog({
  isOpen,
  selectedPlaces,
  onClose,
  onSuccess,
}: CombinePlacesDialogProps) {
  const { t } = useLocale();
  const combineMutation = useCombinePlacesMutation();

  const titleId = useId();
  const descId = useId();

  const [leadPlaceId, setLeadPlaceId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sort places: highest transactionCount first, then earliest createdAt
  const sortedCandidates = useMemo(() => {
    return [...selectedPlaces].sort((a, b) => {
      const diff = (b.transactionCount ?? 0) - (a.transactionCount ?? 0);
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [selectedPlaces]);

  // When dialog opens or selected places change, initialize lead place and newName
  useEffect(() => {
    if (!isOpen || sortedCandidates.length === 0) return;

    const defaultLead = sortedCandidates[0];
    setLeadPlaceId(defaultLead.id);
    setNewName(defaultLead.name);
    setErrorMessage(null);
  }, [isOpen, sortedCandidates]);

  // Handle switching lead place
  const handleSelectLead = (place: IFinancePlace) => {
    setLeadPlaceId(place.id);
    setNewName(place.name);
  };

  if (!isOpen || selectedPlaces.length < 2) return null;

  const totalTransactions = selectedPlaces.reduce(
    (sum, p) => sum + (Number(p.transactionCount) || 0),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMessage(t('places.placeholder.name'));
      return;
    }

    try {
      setErrorMessage(null);
      await combineMutation.mutateAsync({
        placeIds: selectedPlaces.map((p) => p.id),
        targetPlaceId: leadPlaceId,
        name: trimmed,
      });
      onSuccess(selectedPlaces.length);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('dashboard.error.title'));
    }
  };

  return (
    <Modal
      open
      onDismiss={combineMutation.isPending ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="bg-slate-900/50 backdrop-blur-xs"
      panelClassName="max-w-[500px] rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <header
        className={`${MODAL_STICKY_HEADER} flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900`}
      >
        <div>
          <h3
            id={titleId}
            className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {t('places.combineModal.title')}
          </h3>
          <p id={descId} className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('places.combineModal.desc')}
          </p>
        </div>
        <button
          type="button"
          className={`flex size-7 items-center justify-center rounded-[3px] border-0 text-lg ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
          onClick={onClose}
          disabled={combineMutation.isPending}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 px-5 py-4">
          {errorMessage && (
            <div
              className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              role="alert"
            >
              <strong>{errorMessage}</strong>
            </div>
          )}

          {/* Top section: Selected places collection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between max-sm:flex-wrap max-sm:gap-x-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('places.combineModal.placesList')} ({selectedPlaces.length})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('places.combineModal.leadHint')}
              </span>
            </div>

            {/* Phones: the sheet scrolls instead of a nested scroll box. */}
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/40 max-sm:max-h-none max-sm:overflow-visible">
              {sortedCandidates.map((place, index) => {
                const isLead = place.id === leadPlaceId;
                const isTopCount = index === 0;

                return (
                  <div
                    key={place.id}
                    onClick={() => handleSelectLead(place)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded border p-2 text-xs transition-colors max-sm:min-h-11 ${
                      isLead
                        ? 'border-sky-500 bg-sky-50/80 shadow-xs dark:border-sky-500/80 dark:bg-sky-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        id={`lead-place-${place.id}`}
                        name="leadPlace"
                        className="size-3.5 accent-sky-600 dark:accent-sky-500"
                        checked={isLead}
                        onChange={() => handleSelectLead(place)}
                        aria-label={t('places.combineModal.setLead', { name: place.name })}
                      />
                      <div className="flex flex-col">
                        <span
                          className={`font-medium ${
                            isLead
                              ? 'font-semibold text-sky-900 dark:text-sky-200'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {place.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {t('places.combineModal.transactionsBadge', {
                          count: place.transactionCount ?? 0,
                        })}
                      </span>
                      {isLead ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          ★ {t('places.combineModal.leadBadge')}
                        </span>
                      ) : isTopCount ? (
                        <span className="rounded bg-slate-200 px-1 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {t('places.combineModal.topBadge')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom section: New place name input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="combine-place-new-name"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('places.combineModal.newNameLabel')} <span className="text-rose-500">*</span>
              </label>
            </div>
            <input
              id="combine-place-new-name"
              type="text"
              className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-sm:h-10"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('places.placeholder.name')}
              disabled={combineMutation.isPending}
              required
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('places.combineModal.newNameHint', {
                transactions: t('places.combineModal.transactionsBadge', {
                  count: totalTransactions,
                }),
              })}
            </span>
          </div>

          {/* Warning callout */}
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="shrink-0" aria-hidden="true">
              ⚠️
            </span>
            <p className="m-0 leading-normal">{t('places.combineModal.warning')}</p>
          </div>
        </div>

        <footer
          className={`${MODAL_STICKY_FOOTER} flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950`}
        >
          <button
            type="button"
            className={`inline-flex min-h-8 items-center justify-center rounded border px-3.5 text-xs font-medium ${BUTTON_TONE.secondary} ${MODAL_FOOTER_TAP}`}
            onClick={onClose}
            disabled={combineMutation.isPending}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className={`inline-flex min-h-8 items-center justify-center rounded border px-3.5 text-xs font-semibold ${BUTTON_TONE.primary} ${MODAL_FOOTER_TAP}`}
            disabled={combineMutation.isPending || !newName.trim()}
          >
            {combineMutation.isPending
              ? t('common.loadingDashboard')
              : t('places.combineModal.confirm')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

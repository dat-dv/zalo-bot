'use client';

import { useState, useEffect, useId } from 'react';
import type { IContactListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useCombineContactsMutation } from '../../api/contacts-query';

interface CombineContactsDialogProps {
  isOpen: boolean;
  selectedContacts: IContactListItem[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function CombineContactsDialog({
  isOpen,
  selectedContacts,
  onClose,
  onSuccess,
}: CombineContactsDialogProps) {
  const { t } = useLocale();
  const combineMutation = useCombineContactsMutation();

  const titleId = useId();
  const descId = useId();

  const [targetId, setTargetId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [alias, setAlias] = useState<string>('');
  const [descriptor, setDescriptor] = useState<string>('');
  const [consolidateDebts, setConsolidateDebts] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form whenever dialog opens or selected contacts change
  useEffect(() => {
    if (!isOpen || selectedContacts.length === 0) return;

    const first = selectedContacts[0];
    const initialTargetId = first.id;
    setTargetId(initialTargetId);
    setDisplayName(first.displayName);
    setAlias(first.alias || '');

    // Combine descriptors from all selected contacts if available
    const combinedDescriptors = Array.from(
      new Set(
        selectedContacts.map((c) => c.descriptor?.trim()).filter((d): d is string => Boolean(d)),
      ),
    ).join(' | ');

    setDescriptor(combinedDescriptors || first.descriptor || '');
    setConsolidateDebts(true);
    setErrorMessage(null);
  }, [isOpen, selectedContacts]);

  // When user switches target contact in dropdown
  const handleTargetChange = (newTargetId: string) => {
    setTargetId(newTargetId);
    const target = selectedContacts.find((c) => c.id === newTargetId);
    if (target) {
      setDisplayName(target.displayName);
      if (target.alias && !alias) {
        setAlias(target.alias);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !combineMutation.isPending) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, combineMutation.isPending, onClose]);

  if (!isOpen || selectedContacts.length < 2) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMessage(t('contacts.placeholder.name'));
      return;
    }

    const sourceContactIds = selectedContacts.map((c) => c.id).filter((id) => id !== targetId);

    try {
      setErrorMessage(null);
      await combineMutation.mutateAsync({
        targetContactId: targetId,
        sourceContactIds,
        displayName: trimmedName,
        alias: alias.trim() || undefined,
        descriptor: descriptor.trim() || undefined,
        consolidateDebts,
      });
      onSuccess(selectedContacts.length);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('dashboard.error.title'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="presentation"
    >
      <div
        className="w-full max-w-[460px] rounded-md border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3
              id={titleId}
              className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('contacts.combineModal.title')}
            </h3>
            <p id={descId} className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('contacts.combineModal.desc')}
            </p>
          </div>
          <button
            type="button"
            className="flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
            disabled={combineMutation.isPending}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3.5 px-5 py-4">
            {errorMessage && (
              <div
                className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
                role="alert"
              >
                <strong>{errorMessage}</strong>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="combine-target-select"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.targetLabel')}
              </label>
              <select
                id="combine-target-select"
                className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500"
                value={targetId}
                onChange={(e) => handleTargetChange(e.target.value)}
                disabled={combineMutation.isPending}
              >
                {selectedContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName}
                    {contact.alias ? ` (${contact.alias})` : ''}
                    {contact.descriptor ? ` · ${contact.descriptor}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="combine-name-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.mergedName')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="combine-name-input"
                type="text"
                className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('contacts.placeholder.name')}
                disabled={combineMutation.isPending}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="combine-alias-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.mergedAlias')}
              </label>
              <input
                id="combine-alias-input"
                type="text"
                className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={t('contacts.placeholder.alias')}
                disabled={combineMutation.isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="combine-desc-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.mergedDescriptor')}
              </label>
              <textarea
                id="combine-desc-input"
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500"
                rows={2}
                value={descriptor}
                onChange={(e) => setDescriptor(e.target.value)}
                placeholder={t('contacts.placeholder.descriptor')}
                disabled={combineMutation.isPending}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="combine-consolidate-debts"
                type="checkbox"
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
                checked={consolidateDebts}
                onChange={(e) => setConsolidateDebts(e.target.checked)}
                disabled={combineMutation.isPending}
              />
              <label
                htmlFor="combine-consolidate-debts"
                className="cursor-pointer text-xs text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.consolidateDebts')}
              </label>
            </div>

            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <span className="shrink-0" aria-hidden="true">
                ⚠️
              </span>
              <p className="m-0 leading-normal">{t('contacts.combineModal.warning')}</p>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
            <button
              type="button"
              className="inline-flex min-h-8 items-center justify-center rounded border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={onClose}
              disabled={combineMutation.isPending}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="inline-flex min-h-8 items-center justify-center rounded border border-slate-900 bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              disabled={combineMutation.isPending || !displayName.trim()}
            >
              {combineMutation.isPending
                ? t('common.loadingDashboard')
                : t('contacts.combineModal.confirm')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

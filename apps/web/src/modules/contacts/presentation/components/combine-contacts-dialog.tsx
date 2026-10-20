'use client';

import { useState, useEffect, useId, useMemo } from 'react';
import type { IContactListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { useCombineContactsMutation } from '../../api/contacts-query';
import { useUsersQuery } from '@/modules/users/api/users-query';

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
  const usersQuery = useUsersQuery({ enabled: isOpen });
  // API danh sách user chỉ dành cho admin; người dùng thường không thấy ô chọn và để server
  // tự kế thừa liên kết từ các liên hệ nguồn.
  const canLinkUsers = usersQuery.isSuccess;

  const titleId = useId();
  const descId = useId();

  const [leadContactId, setLeadContactId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [alias, setAlias] = useState<string>('');
  const [descriptor, setDescriptor] = useState<string>('');
  const [linkedUserId, setLinkedUserId] = useState<string>('');
  const [consolidateDebts, setConsolidateDebts] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Smart candidate sorting:
  // Priority 1: Has linked user account
  // Priority 2: Highest total related resources (debts + transactions)
  // Priority 3: Earliest createdAt
  const sortedCandidates = useMemo(() => {
    return [...selectedContacts].sort((a, b) => {
      const aHasUser = a.linkedUserId || a.linkedUser ? 1 : 0;
      const bHasUser = b.linkedUserId || b.linkedUser ? 1 : 0;
      if (aHasUser !== bHasUser) return bHasUser - aHasUser;

      const aTotal = (Number(a.debtCount) || 0) + (Number(a.transactionCount) || 0);
      const bTotal = (Number(b.debtCount) || 0) + (Number(b.transactionCount) || 0);
      if (aTotal !== bTotal) return bTotal - aTotal;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [selectedContacts]);

  // Initialize or reset form whenever dialog opens or selected contacts change
  useEffect(() => {
    if (!isOpen || sortedCandidates.length === 0) return;

    const lead = sortedCandidates[0];
    setLeadContactId(lead.id);
    setDisplayName(lead.displayName);
    setAlias(lead.alias || '');

    // Combine descriptors from all selected contacts if available
    const combinedDescriptors = Array.from(
      new Set(
        selectedContacts.map((c) => c.descriptor?.trim()).filter((d): d is string => Boolean(d)),
      ),
    ).join(' | ');

    setDescriptor(combinedDescriptors || lead.descriptor || '');

    // Default linked user: lead's linked user, or first candidate that has a linked user
    const defaultUser =
      lead.linkedUserId || selectedContacts.find((c) => c.linkedUserId)?.linkedUserId || '';
    setLinkedUserId(defaultUser);

    setConsolidateDebts(true);
    setErrorMessage(null);
  }, [isOpen, sortedCandidates, selectedContacts]);

  // When user clicks another contact to make it the lead
  const handleSelectLead = (contact: IContactListItem) => {
    setLeadContactId(contact.id);
    setDisplayName(contact.displayName);
    if (contact.alias) {
      setAlias(contact.alias);
    }
    if (contact.linkedUserId) {
      setLinkedUserId(contact.linkedUserId);
    }
  };

  if (!isOpen || selectedContacts.length < 2) return null;

  const totalDebts = selectedContacts.reduce((sum, c) => sum + (Number(c.debtCount) || 0), 0);
  const totalTransactions = selectedContacts.reduce(
    (sum, c) => sum + (Number(c.transactionCount) || 0),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMessage(t('contacts.placeholder.name'));
      return;
    }

    const sourceContactIds = selectedContacts.map((c) => c.id).filter((id) => id !== leadContactId);

    try {
      setErrorMessage(null);
      await combineMutation.mutateAsync({
        targetContactId: leadContactId,
        sourceContactIds,
        contactIds: selectedContacts.map((c) => c.id),
        displayName: trimmedName,
        alias: alias.trim() || undefined,
        descriptor: descriptor.trim() || undefined,
        linkedUserId: canLinkUsers ? linkedUserId || undefined : undefined,
        consolidateDebts,
      });
      onSuccess(selectedContacts.length);
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
      panelClassName="max-w-[520px] rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <header
        className={`${MODAL_STICKY_HEADER} flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900`}
      >
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
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-5 py-4">
          {errorMessage && (
            <div
              className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              role="alert"
            >
              <strong>{errorMessage}</strong>
            </div>
          )}

          {/* Top section: Candidate contacts collection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('contacts.combineModal.contactsList')} ({selectedContacts.length})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('contacts.combineModal.leadHint')}
              </span>
            </div>

            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              {sortedCandidates.map((contact, index) => {
                const isLead = contact.id === leadContactId;
                const isTop = index === 0;
                const hasUser = Boolean(contact.linkedUser || contact.linkedUserId);

                return (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectLead(contact)}
                    className={`flex cursor-pointer items-center justify-between rounded border p-2 text-xs transition-colors ${
                      isLead
                        ? 'border-sky-500 bg-sky-50/80 shadow-xs dark:border-sky-500/80 dark:bg-sky-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        id={`lead-contact-${contact.id}`}
                        name="leadContact"
                        className="size-3.5 accent-sky-600 dark:accent-sky-500"
                        checked={isLead}
                        onChange={() => handleSelectLead(contact)}
                        aria-label={`Chọn ${contact.displayName} làm người liên quan chính`}
                      />
                      <div className="flex flex-col">
                        <span
                          className={`font-medium ${
                            isLead
                              ? 'font-semibold text-sky-900 dark:text-sky-200'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {contact.displayName}
                          {contact.alias ? (
                            <span className="ml-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              ({contact.alias})
                            </span>
                          ) : null}
                        </span>
                        {contact.descriptor ? (
                          <span className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {contact.descriptor}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {hasUser ? (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                          👤{' '}
                          {contact.linkedUser?.username || contact.linkedUser?.firstName || 'User'}
                        </span>
                      ) : null}

                      {(contact.debtCount ?? 0) > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                          {t('contacts.combineModal.debtsBadge', {
                            count: contact.debtCount ?? 0,
                          })}
                        </span>
                      ) : null}

                      {(contact.transactionCount ?? 0) > 0 ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {t('contacts.combineModal.transactionsBadge', {
                            count: contact.transactionCount ?? 0,
                          })}
                        </span>
                      ) : null}

                      {isLead ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          ★ {t('contacts.combineModal.leadBadge')}
                        </span>
                      ) : isTop ? (
                        <span className="rounded bg-slate-200 px-1 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Lead gợi ý
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom section: Editable details */}
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

          {/* Linked User Select */}
          {canLinkUsers && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="combine-user-select"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('contacts.combineModal.linkedUserLabel')}
              </label>
              <select
                id="combine-user-select"
                className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500"
                value={linkedUserId}
                onChange={(e) => setLinkedUserId(e.target.value)}
                disabled={combineMutation.isPending || usersQuery.isLoading}
              >
                <option value="">-- {t('common.notSet')} --</option>
                {usersQuery.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName
                      ? `${user.firstName} (@${user.username || user.id})`
                      : user.username || user.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Consolidate debts checkbox */}
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

          {/* Resources summary hint */}
          <div className="rounded bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {t('contacts.combineModal.resourcesHint', {
              debts: totalDebts,
              transactions: totalTransactions,
            })}
          </div>

          {/* Warning callout */}
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="shrink-0" aria-hidden="true">
              ⚠️
            </span>
            <p className="m-0 leading-normal">{t('contacts.combineModal.warning')}</p>
          </div>
        </div>

        <footer
          className={`${MODAL_STICKY_FOOTER} flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950`}
        >
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
    </Modal>
  );
}

'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  localeTag,
  type IContactListItem,
  type IContactUserSyncSuggestion,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';

import {
  contactsQueryKeys,
  useContactsQuery,
  useSyncUsersIntoContactsMutation,
  useUpdateContactMutation,
} from '../../api/contacts-query';
import { useUsersQuery } from '@/modules/users/api/users-query';
import { CombineContactsDialog } from './combine-contacts-dialog';

/** Lấy thông báo lỗi nghiệp vụ từ API (vd. 409 "đã liên kết với …") thay vì câu chung của axios. */
function apiErrorMessage(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data: unknown = error.response?.data;
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return typeof data.message === 'string' ? data.message : undefined;
  }
  return undefined;
}

export function ContactsScreen() {
  const queryClient = useQueryClient();
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    displayName: string;
    alias: string;
    descriptor: string;
    phoneNumber: string;
    bankAccountNumber: string;
    bankName: string;
    /** '' = không liên kết. */
    linkedUserId: string;
  }>({
    displayName: '',
    alias: '',
    descriptor: '',
    phoneNumber: '',
    bankAccountNumber: '',
    bankName: '',
    linkedUserId: '',
  });
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<IContactUserSyncSuggestion[]>([]);
  const [linkedSuggestions, setLinkedSuggestions] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const contacts = useContactsQuery();
  const updateMutation = useUpdateContactMutation();
  // Chỉ admin tải được danh sách user, nên cũng chỉ admin được gắn/bỏ gắn liên kết.
  const usersQuery = useUsersQuery();
  const canLinkUsers = usersQuery.isSuccess;
  const linkableUsers = usersQuery.data ?? [];
  const syncUsersMutation = useSyncUsersIntoContactsMutation();

  const handleSyncUsers = async () => {
    try {
      const result = await syncUsersMutation.mutateAsync();
      setSuggestions(result.suggestions);
      setLinkedSuggestions(new Set());
      showToast(
        t('contacts.syncUsers.result', {
          created: result.created,
          phoneFilled: result.phoneFilled,
          suggestions: result.suggestions.length,
        }),
      );
    } catch {
      showToast(t('contacts.syncUsers.error'));
    }
  };

  // Gắn theo gợi ý: gửi lại tên/biệt danh/mô tả hiện có vì PATCH xoá alias/descriptor khi bỏ trống.
  const handleLinkSuggestion = async (suggestion: IContactUserSyncSuggestion) => {
    const target = rawList.find((c) => c.id === suggestion.contactId);
    if (!target) return;
    try {
      await updateMutation.mutateAsync({
        id: target.id,
        data: {
          displayName: target.displayName,
          alias: target.alias || undefined,
          descriptor: target.descriptor || undefined,
          linkedUserId: suggestion.userId,
        },
      });
      setLinkedSuggestions((prev) => new Set(prev).add(suggestion.contactId));
    } catch (error: unknown) {
      showToast(apiErrorMessage(error) ?? t('contacts.syncUsers.error'));
    }
  };

  const refresh = () => void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });

  const rawList = useMemo(() => contacts.data ?? [], [contacts.data]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return rawList;
    const query = search.toLowerCase();
    return rawList.filter(
      (item) =>
        item.displayName.toLowerCase().includes(query) ||
        (item.alias && item.alias.toLowerCase().includes(query)) ||
        (item.descriptor && item.descriptor.toLowerCase().includes(query)),
    );
  }, [rawList, search]);

  const selectedContacts = useMemo(() => {
    return rawList.filter((c) => selectedIds.has(c.id));
  }, [rawList, selectedIds]);

  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value))
      : t('common.notSet');

  // Toggle single row selection
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

  // Toggle select all filtered rows
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  // Start inline editing
  const handleStartEdit = (contact: IContactListItem) => {
    setEditingId(contact.id);
    setEditDraft({
      displayName: contact.displayName,
      alias: contact.alias || '',
      descriptor: contact.descriptor || '',
      phoneNumber: contact.phoneNumber || '',
      bankAccountNumber: contact.bankAccountNumber || '',
      bankName: contact.bankName || '',
      linkedUserId: contact.linkedUserId || '',
    });
  };

  // Cancel inline editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      displayName: '',
      alias: '',
      descriptor: '',
      phoneNumber: '',
      bankAccountNumber: '',
      bankName: '',
      linkedUserId: '',
    });
  };

  // Save inline editing
  const handleSaveEdit = async (id: string) => {
    const trimmedName = editDraft.displayName.trim();
    if (!trimmedName) return;
    const original = rawList.find((c) => c.id === id);
    const linkChanged = canLinkUsers && editDraft.linkedUserId !== (original?.linkedUserId || '');

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          displayName: trimmedName,
          alias: editDraft.alias.trim() || undefined,
          descriptor: editDraft.descriptor.trim() || undefined,
          phoneNumber: editDraft.phoneNumber?.trim() || undefined,
          bankAccountNumber: editDraft.bankAccountNumber?.trim() || undefined,
          bankName: editDraft.bankName?.trim() || undefined,
          // Chỉ gửi khi đổi: API từ chối (403) mọi thay đổi liên kết của người không phải admin.
          ...(linkChanged ? { linkedUserId: editDraft.linkedUserId || null } : {}),
        },
      });
      setEditingId(null);
      showToast(t('contacts.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const contactColumns: DataTableColumn<IContactListItem>[] = [
    {
      id: 'select',
      header: (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="cursor-pointer accent-slate-900 dark:accent-sky-500"
            checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
            onChange={handleToggleSelectAll}
            aria-label={t('contacts.selectAll')}
          />
        </label>
      ),
      label: t('contacts.selectAll'),
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
            aria-label={item.displayName}
          />
        </label>
      ),
    },
    {
      id: 'displayName',
      header: t('dashboard.columns.name'),
      minWidth: '180px',
      hideable: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.displayName}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.name')}
              autoFocus
              required
            />
          );
        }
        return (
          <span
            className="cursor-pointer font-semibold text-slate-900 select-none hover:text-sky-600 dark:text-slate-100 dark:hover:text-sky-400"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.displayName}
          >
            {item.displayName}
          </span>
        );
      },
    },
    {
      id: 'alias',
      header: t('dashboard.columns.alias'),
      minWidth: '130px',
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.alias}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, alias: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.alias')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {item.alias || '—'}
          </span>
        );
      },
    },
    {
      id: 'descriptor',
      header: t('dashboard.columns.descriptor'),
      minWidth: '240px',
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.descriptor}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, descriptor: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.descriptor')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.descriptor}
          >
            {item.descriptor || '—'}
          </span>
        );
      },
    },
    {
      id: 'phoneNumber',
      header: t('contacts.columns.phone'),
      minWidth: '130px',
      defaultHidden: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.phoneNumber}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.phone')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {item.phoneNumber || '—'}
            {item.linkedUser?.phoneNumber &&
              item.phoneNumber &&
              item.linkedUser.phoneNumber !== item.phoneNumber && (
                <span
                  className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  title={t('contacts.phone.zaloMismatchTitle')}
                >
                  {t('contacts.phone.zaloMismatch', { phone: item.linkedUser.phoneNumber })}
                </span>
              )}
          </span>
        );
      },
    },
    {
      id: 'bankAccountNumber',
      header: t('contacts.columns.bankAccount'),
      minWidth: '150px',
      defaultHidden: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.bankAccountNumber}
              onChange={(e) =>
                setEditDraft((prev) => ({ ...prev, bankAccountNumber: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.bankAccount')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer font-mono text-[11px] text-slate-600 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {item.bankAccountNumber || '—'}
          </span>
        );
      },
    },
    {
      id: 'bankName',
      header: t('contacts.columns.bankName'),
      minWidth: '120px',
      defaultHidden: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.bankName}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, bankName: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('contacts.placeholder.bankName')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {item.bankName || '—'}
          </span>
        );
      },
    },
    {
      id: 'linkedUser',
      header: t('contacts.columns.linkedUser'),
      minWidth: '140px',
      defaultHidden: false,
      cell: (item) => {
        if (editingId === item.id && canLinkUsers) {
          return (
            <select
              aria-label={t('contacts.inlineEdit.linkedUserLabel')}
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.linkedUserId}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, linkedUserId: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
              }}
            >
              <option value="">{t('contacts.inlineEdit.noLinkedUser')}</option>
              {linkableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName
                    ? `${user.firstName} (@${user.username || user.id})`
                    : user.username || user.id}
                </option>
              ))}
            </select>
          );
        }
        if (item.linkedUser) {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <span aria-hidden="true">👤</span>
              {item.linkedUser.firstName
                ? `${item.linkedUser.firstName} (@${item.linkedUser.username})`
                : `@${item.linkedUser.username}`}
            </span>
          );
        }
        if (item.linkedUserId) {
          return (
            <span className="font-mono text-[10.5px] text-slate-500 dark:text-slate-400">
              #{item.linkedUserId.slice(0, 8)}
            </span>
          );
        }
        return <span className="text-slate-400 select-none dark:text-slate-600">—</span>;
      },
    },
    {
      id: 'resources',
      header: t('contacts.columns.resources'),
      minWidth: '150px',
      defaultHidden: false,
      cell: (item) => {
        const debts = item.debtCount ?? 0;
        const txs = item.transactionCount ?? 0;
        if (debts === 0 && txs === 0) {
          return <span className="text-slate-400 select-none dark:text-slate-600">0</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {debts > 0 ? (
              <span
                className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                title={`${debts} khoản nợ`}
              >
                {t('contacts.combineModal.debtsBadge', { count: debts })}
              </span>
            ) : null}
            {txs > 0 ? (
              <span
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                title={`${txs} giao dịch`}
              >
                {t('contacts.combineModal.transactionsBadge', { count: txs })}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'createdAt',
      header: t('dashboard.columns.date'),
      align: 'right',
      minWidth: '130px',
      cell: (item) => (
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {date(item.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('dashboard.columns.action'),
      align: 'right',
      minWidth: '120px',
      hideable: false,
      cell: (item) => {
        const isEditing = editingId === item.id;
        if (isEditing) {
          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                onClick={() => void handleSaveEdit(item.id)}
                disabled={updateMutation.isPending || !editDraft.displayName.trim()}
                title={t('contacts.actions.save')}
              >
                ✓ {t('contacts.actions.save')}
              </button>
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
                title={t('contacts.actions.cancel')}
              >
                ✕
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
            <button
              type="button"
              className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              onClick={() => handleStartEdit(item)}
              title={t('contacts.actions.edit')}
            >
              ✎ {t('contacts.actions.edit')}
            </button>
          </div>
        );
      },
    },
  ];

  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredContacts.length;

  return (
    <>
      {toastMessage && (
        <div
          className="fixed top-4 left-1/2 z-[1000] -translate-x-1/2 rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      {contacts.isError ? (
        <section
          className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          role="alert"
        >
          <strong>{t('dashboard.error.title')}</strong>
          <button
            type="button"
            className="cursor-pointer rounded-[2px] bg-rose-600 px-2 py-0.5 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
            onClick={refresh}
          >
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <section className="grid gap-3">
          {suggestions.length > 0 && (
            <section
              aria-label={t('contacts.syncUsers.suggestionsTitle')}
              className="rounded border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    {t('contacts.syncUsers.suggestionsTitle')}
                  </h3>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                    {t('contacts.syncUsers.suggestionsHint')}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded px-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
                  onClick={() => setSuggestions([])}
                  aria-label={t('contacts.syncUsers.dismiss')}
                  title={t('contacts.syncUsers.dismiss')}
                >
                  ✕
                </button>
              </div>
              <ul className="mt-2 grid gap-1">
                {suggestions.map((suggestion) => {
                  const isLinked = linkedSuggestions.has(suggestion.contactId);
                  return (
                    <li
                      key={`${suggestion.userId}:${suggestion.contactId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1 dark:bg-slate-900"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        👤 {suggestion.userName}{' '}
                        <span className="font-mono text-[10.5px] text-slate-400">
                          #{suggestion.userId.slice(-6)}
                        </span>{' '}
                        ↔ {suggestion.contactName}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-default disabled:opacity-60 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        onClick={() => void handleLinkSuggestion(suggestion)}
                        disabled={isLinked || updateMutation.isPending}
                      >
                        {isLinked
                          ? `✓ ${t('contacts.syncUsers.linked')}`
                          : t('contacts.syncUsers.link')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <DataPanel
            title={t('contacts.title')}
            description={t('contacts.subtitle')}
            counter={t('table.rowsCount', { count: filteredContacts.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5">
                {canLinkUsers && (
                  <button
                    type="button"
                    className="inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => void handleSyncUsers()}
                    disabled={syncUsersMutation.isPending}
                  >
                    {syncUsersMutation.isPending
                      ? t('contacts.syncUsers.running')
                      : t('contacts.syncUsers.action')}
                  </button>
                )}
                {selectedIds.size >= 2 && (
                  <button
                    type="button"
                    className="inline-flex h-6 min-h-6 items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    onClick={() => setIsCombineOpen(true)}
                  >
                    {t('contacts.actions.combine', { count: selectedIds.size })}
                  </button>
                )}
                {filteredContacts.length > 0 && (
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                      selectedIds.size === filteredContacts.length
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    onClick={handleToggleSelectAll}
                  >
                    {selectedIds.size === filteredContacts.length
                      ? t('contacts.deselectAll')
                      : t('contacts.selectAll')}
                  </button>
                )}
                {isPartiallySelected && (
                  <button
                    type="button"
                    className="inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-sky-500 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50"
                    onClick={() => setSelectedIds(new Set())}
                    title={t('contacts.deselectAll')}
                  >
                    {t('contacts.selectedCount', { count: selectedIds.size })} ✕
                  </button>
                )}
                <input
                  type="search"
                  className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
                  placeholder={t('table.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
              </div>
            }
          >
            <DataTable
              id="contacts"
              ariaLabel={t('contacts.title')}
              rows={filteredContacts}
              loading={contacts.isLoading}
              emptyMessage={t('dashboard.noContacts')}
              columns={contactColumns}
              getRowKey={(item) => item.id}
            />
          </DataPanel>
        </section>
      )}

      <CombineContactsDialog
        isOpen={isCombineOpen}
        selectedContacts={selectedContacts}
        onClose={() => setIsCombineOpen(false)}
        onSuccess={(count) => {
          setSelectedIds(new Set());
          showToast(t('contacts.combine.success', { count }));
        }}
      />
    </>
  );
}

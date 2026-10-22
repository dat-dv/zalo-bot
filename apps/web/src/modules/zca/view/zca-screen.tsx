'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  GrantAccessStatus,
  localeTag,
  type IUserListItem,
  type IUserMergeResult,
} from '@zalobot/contracts';
import {
  useZcaStatusQuery,
  useZcaThreadsQuery,
  useZcaThreadsFetchedAtQuery,
  useRefreshZcaThreadsMutation,
  useLoginZcaQrMutation,
  useLogoutZcaMutation,
  useSetZcaListenedThreadsMutation,
  useToggleZcaListenedThreadMutation,
  useZcaThreadConfigsQuery,
  useGoogleDriveFolderLinkQuery,
  useDeleteZcaThreadConfigMutation,
  zcaQueryKeys,
} from '../api/zca-query';
import { getThreadDriveOpenUrl, getZcaQrImageUrl, type ZcaThread } from '../api/zca-api';
import { isForbiddenError } from '../model/google-storage-account';
import {
  buildChatRows,
  countChatRows,
  matchesChatRowFilter,
  matchesChatRowSearch,
  sortChatRows,
  type ChatRow,
  type ChatRowFilter,
  type ChatRowSort,
} from '../model/chat-rows';
import { ChatListRow } from '../presentation/components/chat-list-row';
import type { ChatRowProps } from '../presentation/components/chat-row-parts';
import { ChatTableRow } from '../presentation/components/chat-table-row';
import { UserFormDialog } from '../presentation/components/user-form-dialog';
import { ZcaAdminOnlyNotice } from '../presentation/components/zca-admin-only-notice';
import {
  ExternalLinkIcon,
  GoogleDriveIcon,
  LogoutIcon,
  QrIcon,
  RefreshIcon,
} from '../presentation/components/zca-icons';
import { SyncMediaModal } from './sync-media-modal';
import { useChatTableUrlState } from './use-chat-table-url-state';
import {
  useDeleteUserMutation,
  useSetGrantAccessMutation,
  useSyncUsersWithZcaMutation,
  useUsersQuery,
} from '@/modules/users/api/users-query';
import { MergeUserDialog } from '@/modules/users/presentation/components/merge-user-dialog';
import { LinkedContactsDialog } from '@/modules/users/presentation/components/linked-contacts-dialog';
import { useIsCompact } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';
import { MOBILE_TOOLBAR_ROW, TAP_CONTROL } from '@/shared/ui/touch';

const FILTER_TABS: { key: ChatRowFilter; label: string; activeClass?: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'listened', label: 'Đang lắng nghe' },
  { key: 'group', label: 'Nhóm chat' },
  { key: 'personal', label: 'Cá nhân' },
  { key: 'pending', label: 'Chờ duyệt', activeClass: 'bg-amber-600 text-white dark:bg-amber-500' },
  {
    key: 'granted',
    label: 'Đã cấp quyền',
    activeClass: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  { key: 'admin', label: 'Admin', activeClass: 'bg-purple-600 text-white dark:bg-purple-500' },
];

const SORT_OPTIONS: { value: ChatRowSort; label: string }[] = [
  { value: 'listened_first', label: 'Đang lắng nghe lên đầu' },
  { value: 'pending_first', label: 'Chờ duyệt lên đầu' },
  { value: 'name_asc', label: 'Tên (A → Z)' },
  { value: 'name_desc', label: 'Tên (Z → A)' },
  { value: 'group_first', label: 'Nhóm chat trước' },
  { value: 'user_first', label: 'Cá nhân trước' },
  { value: 'members_desc', label: 'Nhóm đông thành viên nhất' },
];

const LOADING_ROWS_MESSAGE = 'Đang tải danh sách nhóm, bạn bè và người dùng...';
const NO_ROWS_MESSAGE =
  'Chưa có cuộc trò chuyện hay người dùng nào. Hãy đăng nhập Zalo hoặc thêm thủ công ở trên.';
const NO_MATCH_MESSAGE = 'Không tìm thấy kết quả phù hợp với từ khóa hoặc bộ lọc.';
const QR_LOGIN_LABEL = 'Quét mã QR đăng nhập';
const ADD_USER_LABEL = '+ Thêm người dùng';

function isChatRowSort(value: string): value is ChatRowSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

type UserDialogState =
  | { mode: 'create'; initialId?: string; initialName?: string }
  | { mode: 'edit'; user: IUserListItem };

export function ZcaScreen() {
  const { t, locale } = useLocale();
  const isCompact = useIsCompact();
  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const {
    data: status,
    error: statusError,
    refetch: refetchStatus,
  } = useZcaStatusQuery({
    refetchInterval: pollInterval,
  });
  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    refetch: refetchThreads,
  } = useZcaThreadsQuery({ enabled: Boolean(status?.loggedIn) });
  const { data: threadsFetchedAt } = useZcaThreadsFetchedAtQuery({
    enabled: Boolean(status?.loggedIn),
  });
  const { data: users = [], isLoading: isUsersLoading } = useUsersQuery();
  const { data: threadConfigs = [] } = useZcaThreadConfigsQuery();
  const { data: driveRootData } = useGoogleDriveFolderLinkQuery();
  const queryClient = useQueryClient();

  const refreshThreadsMutation = useRefreshZcaThreadsMutation();
  const loginQrMutation = useLoginZcaQrMutation();
  const logoutMutation = useLogoutZcaMutation();
  const setListenedMutation = useSetZcaListenedThreadsMutation();
  const toggleListenedMutation = useToggleZcaListenedThreadMutation();
  const setGrantAccessMutation = useSetGrantAccessMutation();
  const syncUsersMutation = useSyncUsersWithZcaMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const deleteThreadConfigMutation = useDeleteZcaThreadConfigMutation();

  const isLoggingOut = logoutMutation.isPending;

  const { state: tableState, update: updateTable, setPage } = useChatTableUrlState();
  const { search, filter, sortBy, pageSize } = tableState;
  const setSearch = (value: string) => updateTable({ search: value });
  const setFilter = (value: ChatRowFilter) => updateTable({ filter: value });
  const setSortBy = (value: ChatRowSort) => updateTable({ sortBy: value });
  const setPageSize = (value: number) => updateTable({ pageSize: value });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncThreadTarget, setSyncThreadTarget] = useState<ZcaThread | null>(null);
  const [userDialog, setUserDialog] = useState<UserDialogState | null>(null);
  const [mergingUser, setMergingUser] = useState<IUserListItem | null>(null);
  const [linkedContactsUser, setLinkedContactsUser] = useState<IUserListItem | null>(null);

  // Thông báo kết quả đồng bộ / gộp tài khoản
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const configMap = useMemo(
    () => new Map(threadConfigs.map((c) => [c.threadId, c])),
    [threadConfigs],
  );

  // QR Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTimestamp, setQrTimestamp] = useState<number>(Date.now());
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);

  // Manual Add ID
  const [manualId, setManualId] = useState('');
  const [manualError, setManualError] = useState('');

  // Handle polling when QR modal is open
  useEffect(() => {
    if (isQrModalOpen) {
      setPollInterval(2500);
    } else {
      setPollInterval(false);
    }
  }, [isQrModalOpen]);

  // When logged in while modal is open, auto close modal
  useEffect(() => {
    if (isQrModalOpen && status?.loggedIn) {
      setIsQrModalOpen(false);
      setPollInterval(false);
      void refetchThreads();
    }
  }, [isQrModalOpen, status?.loggedIn, refetchThreads]);

  const showNotice = (type: 'success' | 'error', message: string, durationMs = 5000) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), durationMs);
  };

  const copyToClipboard = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefreshAll = async () => {
    await Promise.all([refetchStatus(), refreshThreadsMutation.mutateAsync()]);
  };

  const handleOpenQrLogin = async (forceNew = false) => {
    setIsQrModalOpen(true);
    setQrTimestamp(Date.now());
    try {
      const res = await loginQrMutation.mutateAsync({ forceNew });
      setQrCodeString(res.code);
      setQrTimestamp(Date.now());
    } catch {
      // If endpoint already generated QR
      setQrTimestamp(Date.now());
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm(t('zca.logoutConfirm'));
    if (!confirmed) return;
    try {
      await logoutMutation.mutateAsync();
      await refetchStatus();
    } catch {
      alert('Đăng xuất thất bại. Vui lòng thử lại.');
    }
  };

  const handleToggleThread = async (threadId: string) => {
    await toggleListenedMutation.mutateAsync(threadId);
    void refetchStatus();
  };

  const handleAddManualId = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = manualId.trim();
    if (!id) {
      setManualError('Vui lòng nhập ID người dùng hoặc nhóm');
      return;
    }
    const currentListened = new Set(threads.filter((t) => t.isListened).map((t) => t.id));
    currentListened.add(id);

    try {
      await setListenedMutation.mutateAsync(Array.from(currentListened));
      setManualId('');
      setManualError('');
      void refetchThreads();
      void refetchStatus();
    } catch {
      setManualError('Không thể thêm ID. Vui lòng thử lại.');
    }
  };

  // Quyền tương tác gắn với người dùng (users.id), độc lập với việc lắng nghe thread.
  const handleToggleAccess = async (row: ChatRow) => {
    const isGranted = row.access === 'granted' || row.access === 'admin';
    if (
      row.access === 'admin' &&
      !confirm(
        'Người dùng này là Quản trị viên (Admin). Bạn có chắc muốn thu hồi quyền truy cập không?',
      )
    ) {
      return;
    }
    try {
      await setGrantAccessMutation.mutateAsync({
        id: row.id,
        grantAccess: isGranted ? GrantAccessStatus.DENIED : GrantAccessStatus.GRANTED,
      });
    } catch {
      showNotice('error', 'Không thể cập nhật quyền tương tác. Vui lòng thử lại.');
    }
  };

  const handleEditUser = (row: ChatRow) => {
    setUserDialog(
      row.user
        ? { mode: 'edit', user: row.user }
        : { mode: 'create', initialId: row.id, initialName: row.name },
    );
  };

  const handleMergeUser = (row: ChatRow) => {
    if (row.user) setMergingUser(row.user);
  };

  const handleViewLinkedContacts = (row: ChatRow) => {
    if (row.user) setLinkedContactsUser(row.user);
  };

  const handleDeleteUser = async (row: ChatRow) => {
    if (!row.user) return;
    if (
      !confirm(`Bạn có chắc chắn muốn xóa người dùng "${row.name || row.id}" khỏi hệ thống không?`)
    ) {
      return;
    }
    try {
      await deleteUserMutation.mutateAsync(row.id);
    } catch {
      showNotice('error', 'Không thể xoá người dùng. Vui lòng thử lại.');
    }
  };

  const handleDeleteThread = async (row: ChatRow) => {
    const name = row.name || row.id;
    if (!window.confirm(t('zca.threadConfig.deleteConfirm', { name }))) return;
    try {
      await deleteThreadConfigMutation.mutateAsync(row.id);
      showNotice('success', t('zca.threadConfig.deleteSuccess', { name }));
    } catch (error: unknown) {
      const stillInZalo = axios.isAxiosError(error) && error.response?.status === 409;
      showNotice(
        'error',
        t(stillInZalo ? 'zca.threadConfig.deleteInDirectory' : 'zca.threadConfig.deleteError'),
      );
    }
  };

  const handleMerged = (result: IUserMergeResult, sourceName: string, targetName: string) => {
    setMergingUser(null);
    const message = t('users.merge.success', { source: sourceName, target: targetName });
    showNotice(
      'success',
      result.sourceWasCurrentSession ? `${message} ${t('users.merge.sessionNotice')}` : message,
      result.sourceWasCurrentSession ? 15000 : 5000,
    );
  };

  const handleSyncUsers = async () => {
    try {
      const res = await syncUsersMutation.mutateAsync();
      // The sync re-fetched the Zalo directory on the server; pick up the new thread list too.
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.threads() });
      showNotice(
        'success',
        `Đồng bộ thành công! Đã cập nhật ${res.syncedCount} / ${res.totalUsers} người dùng từ danh bạ Zalo.`,
      );
    } catch {
      showNotice('error', 'Không thể đồng bộ từ ZCA. Hãy đảm bảo bạn đã đăng nhập ZCA.');
    }
  };

  const handleDriveOpened = () => {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.configs() });
    }, 2000);
  };

  const chatRows = useMemo(() => buildChatRows(threads, users), [threads, users]);
  const rowCounts = useMemo(() => countChatRows(chatRows), [chatRows]);

  const filteredRows = useMemo(
    () =>
      chatRows.filter(
        (row) => matchesChatRowSearch(row, search) && matchesChatRowFilter(row, filter),
      ),
    [chatRows, search, filter],
  );
  const sortedRows = useMemo(() => sortChatRows(filteredRows, sortBy), [filteredRows, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  // A page restored from the URL may exceed the rows loaded so far; clamp for display only so it
  // still applies once the list finishes loading.
  const currentPage = Math.min(tableState.page, totalPages);
  const paginatedRows = useMemo(() => {
    if (pageSize >= sortedRows.length) return sortedRows;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const listenedCount = status?.listenedCount ?? threads.filter((t) => t.isListened).length;
  const isRefreshing = refreshThreadsMutation.isPending;
  const threadsFetchedAtLabel = threadsFetchedAt
    ? t('zca.directory.fetchedAt', {
        time: new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(threadsFetchedAt)),
      })
    : null;
  const isTableLoading = isUsersLoading || (Boolean(status?.loggedIn) && isThreadsLoading);
  const emptyRowsMessage = chatRows.length === 0 ? NO_ROWS_MESSAGE : NO_MATCH_MESSAGE;
  const rowKey = (row: ChatRow) => `${row.kind}:${row.id}`;
  const rowProps = (row: ChatRow): ChatRowProps => ({
    row,
    config: configMap.get(row.id),
    isCopied: copiedId === row.id,
    onCopyId: copyToClipboard,
    onDeleteThread: (r) => void handleDeleteThread(r),
    onDeleteUser: (r) => void handleDeleteUser(r),
    onDriveOpened: handleDriveOpened,
    onEditUser: handleEditUser,
    onMergeUser: handleMergeUser,
    onViewLinkedContacts: handleViewLinkedContacts,
    onSyncMedia: setSyncThreadTarget,
    onToggleAccess: (r) => void handleToggleAccess(r),
    onToggleListen: (threadId) => void handleToggleThread(threadId),
  });

  // Every /api/zca route is admin-only; without this a non-admin sees an empty page and no reason.
  if (isForbiddenError(statusError)) return <ZcaAdminOnlyNotice />;

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Compact screens: the topbar already shows the route title. */}
        <div className="max-[960px]:hidden">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Zalo & Người dùng
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kết nối Zalo cá nhân (ZCA), chọn cuộc trò chuyện bot lắng nghe và cấp quyền tương tác
            cho từng người.
          </p>
        </div>
        {/* Phones: one row that never wraps — label truncates, buttons stay 40px. */}
        <div className="flex items-center gap-2 max-[640px]:w-full max-[640px]:flex-nowrap">
          {threadsFetchedAtLabel && (
            <span
              className="text-xs text-slate-500 max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:truncate max-[640px]:text-[11px] dark:text-slate-400"
              title={t('zca.directory.fetchedAtHint')}
            >
              {threadsFetchedAtLabel}
            </span>
          )}
          <button
            aria-label={t('zca.refreshDirectory')}
            className={`inline-flex items-center gap-1.5 rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 max-[640px]:ml-auto max-[640px]:w-10 max-[640px]:shrink-0 max-[640px]:justify-center max-[640px]:px-0 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${TAP_CONTROL}`}
            disabled={isRefreshing}
            onClick={() => void handleRefreshAll()}
            title="Làm mới trạng thái và cập nhật lại danh bạ, nhóm từ Zalo"
            type="button"
          >
            <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
            {/* Icon-only on phones; aria-label names the action. */}
            <span className="max-[640px]:sr-only">
              {isRefreshing ? 'Đang tải lại...' : 'Làm mới'}
            </span>
          </button>
          {status?.loggedIn ? (
            <button
              className={`inline-flex items-center gap-1.5 rounded-[4px] border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900 max-[640px]:shrink-0 max-[640px]:whitespace-nowrap max-[640px]:px-3 ${TAP_CONTROL}`}
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogoutIcon />
              {isLoggingOut ? (
                'Đang đăng xuất...'
              ) : (
                <>
                  <span className="max-[640px]:hidden">{t('zca.logout')}</span>
                  <span className="hidden max-[640px]:inline">{t('common.logout')}</span>
                </>
              )}
            </button>
          ) : (
            <button
              // Compact screens get this action in the MobileActionBar instead.
              className="inline-flex items-center gap-1.5 rounded-[4px] bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none max-[960px]:hidden"
              onClick={() => void handleOpenQrLogin(false)}
              type="button"
            >
              <QrIcon />
              {QR_LOGIN_LABEL}
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Trạng thái kết nối */}
        <div className="rounded-[3px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Trạng thái kết nối
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex size-2.5 rounded-full ${
                status?.loggedIn ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {status?.loggedIn ? 'Đã kết nối ZCA' : 'Chưa đăng nhập'}
            </span>
            {status?.loggedIn && (
              <span
                className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  status.isListening
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title="Trình lắng nghe tin nhắn & sự kiện"
              >
                {status.isListening ? 'Đang nghe' : 'Tạm dừng'}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            {status?.loggedIn
              ? `ID tài khoản: ${status.ownId || 'Đang cập nhật'}`
              : 'Hãy quét mã QR để bắt đầu'}
          </p>
        </div>

        {/* Card 2: Danh sách lắng nghe (Whitelist) */}
        <div className="rounded-[3px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Đang lắng nghe</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {listenedCount}
            </span>
            <span className="text-xs text-slate-500">cuộc trò chuyện</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {listenedCount > 0
              ? 'Chỉ xử lý trong danh sách này'
              : 'Chưa giới hạn (lắng nghe tất cả)'}
          </p>
        </div>

        {/* Card 3: Quyền tương tác */}
        <button
          className="rounded-[3px] border border-amber-200 bg-amber-50/50 p-3.5 text-left shadow-sm transition hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/20"
          onClick={() => setFilter('pending')}
          title="Xem những người đang chờ cấp quyền"
          type="button"
        >
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Quyền tương tác</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {rowCounts.pending}
            </span>
            <span className="text-xs text-amber-700/80 dark:text-amber-400">chờ duyệt</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {rowCounts.granted} người đã được cấp quyền ({rowCounts.admin} admin)
          </p>
        </button>

        {/* Card 4: Tổng số phát hiện */}
        <div className="rounded-[3px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng danh bạ & người dùng
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {chatRows.length}
            </span>
            <span className="text-xs text-slate-500">
              ({rowCounts.group} nhóm, {rowCounts.personal} cá nhân)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {status?.proxyEnabled ? 'HTTP Proxy đã bật' : 'Kết nối trực tiếp'}
          </p>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-[3px] border p-3 text-sm font-medium max-[640px]:py-1 max-[640px]:pr-1 ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
          role="status"
        >
          <span>
            {notice.type === 'success' ? '✅' : '⚠️'} {notice.message}
          </span>
          <button
            aria-label="Đóng thông báo"
            className="text-xs text-slate-400 hover:text-slate-600 max-[640px]:inline-flex max-[640px]:size-10 max-[640px]:shrink-0 max-[640px]:items-center max-[640px]:justify-center dark:hover:text-slate-200"
            onClick={() => setNotice(null)}
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Section: Danh sách cuộc trò chuyện & người dùng */}
      <div className="rounded-[3px] border border-slate-200 bg-white p-4 shadow-sm max-[640px]:p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cuộc trò chuyện & Người dùng
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong>Lắng nghe</strong>: bot có nhận tin nhắn từ cuộc trò chuyện đó không.{' '}
                <strong>Quyền tương tác</strong>: người đó có được dùng các tính năng của bot không.
              </p>
            </div>

            <div
              className={`flex flex-wrap items-center gap-2 max-[640px]:w-full ${MOBILE_TOOLBAR_ROW}`}
            >
              <button
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${TAP_CONTROL}`}
                disabled={syncUsersMutation.isPending}
                onClick={() => void handleSyncUsers()}
                title="Đồng bộ tên, avatar và SĐT từ danh bạ Zalo cá nhân (ZCA) sang người dùng"
                type="button"
              >
                <RefreshIcon className={syncUsersMutation.isPending ? 'animate-spin' : ''} />
                {syncUsersMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ thông tin'}
              </button>
              <button
                // Compact screens get this action in the MobileActionBar instead.
                className="inline-flex items-center gap-1.5 rounded-[3px] bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 max-[960px]:hidden dark:bg-indigo-500 dark:hover:bg-indigo-600"
                onClick={() => setUserDialog({ mode: 'create' })}
                type="button"
              >
                {ADD_USER_LABEL}
              </button>
              <a
                className={`${TAP_CONTROL} inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[3px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400`}
                href={driveRootData?.webViewLink || getThreadDriveOpenUrl()}
                rel="noopener noreferrer"
                target="_blank"
                title="Mở thư mục kho lưu trữ zalobot trên Google Drive"
              >
                <GoogleDriveIcon className="size-4 shrink-0" />
                <span>Kho Google Drive</span>
                <ExternalLinkIcon className="size-3 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Form thêm ID thủ công vào danh sách lắng nghe */}
          <form
            className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2.5 dark:bg-slate-800/60"
            onSubmit={handleAddManualId}
          >
            <div className="min-w-[220px] flex-1 max-[640px]:min-w-full">
              <input
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs max-[640px]:h-10 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Nhập ID Nhóm hoặc ID Người dùng để bật lắng nghe (ví dụ: g-123456 hoặc 987654321)..."
                type="text"
                value={manualId}
              />
            </div>
            <button
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 max-[640px]:h-10 max-[640px]:w-full dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
              type="submit"
            >
              + Bật lắng nghe ID
            </button>
            {manualError && <p className="w-full text-xs text-rose-500">{manualError}</p>}
          </form>

          {/* Search, Sort & Filters. Phones: full-width search, then one sideways-scrolling row. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-2">
            <div className="flex flex-wrap items-center gap-2 max-[640px]:flex-col max-[640px]:items-stretch">
              <div className="relative">
                <input
                  className="w-64 rounded border border-slate-300 bg-white py-1.5 pl-7 pr-7 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none max-[640px]:h-10 max-[640px]:w-full max-[640px]:pr-10 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, gợi nhớ, SĐT, ID..."
                  type="text"
                  value={search}
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 max-[640px]:top-1/2 max-[640px]:-translate-y-1/2">
                  🔍
                </span>
                {search && (
                  <button
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600 max-[640px]:top-0 max-[640px]:right-0 max-[640px]:inline-flex max-[640px]:size-10 max-[640px]:items-center max-[640px]:justify-center dark:hover:text-slate-200"
                    onClick={() => setSearch('')}
                    title="Xóa tìm kiếm"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Phones show the sort select in the chip row below. */}
              <div className="flex items-center gap-1.5 max-[640px]:hidden">
                <span className="text-xs text-slate-500">Sắp xếp:</span>
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  aria-label="Sắp xếp"
                  onChange={(e) => {
                    if (isChatRowSort(e.target.value)) setSortBy(e.target.value);
                  }}
                  value={sortBy}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {search && (
                <span className="text-xs text-slate-500">
                  Tìm thấy <strong>{filteredRows.length}</strong> kết quả
                </span>
              )}
            </div>

            {/* Without min-w-0 the nowrap chips widen the whole page on compact screens. */}
            <div
              className={`flex min-w-0 max-w-full gap-1.5 max-[960px]:overflow-x-auto ${MOBILE_TOOLBAR_ROW}`}
            >
              {isCompact && (
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 hidden h-10 shrink-0 max-[640px]:block"
                  aria-label="Sắp xếp"
                  onChange={(e) => {
                    if (isChatRowSort(e.target.value)) setSortBy(e.target.value);
                  }}
                  value={sortBy}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex flex-wrap items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 max-[640px]:shrink-0 max-[640px]:flex-nowrap dark:border-slate-700 dark:bg-slate-800">
                {FILTER_TABS.map((tab) => (
                  <button
                    className={`rounded px-2.5 py-1 text-xs font-medium max-[640px]:h-10 max-[640px]:shrink-0 max-[640px]:px-3 max-[640px]:text-[12.5px] max-[640px]:whitespace-nowrap ${
                      filter === tab.key
                        ? tab.activeClass ||
                          'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    type="button"
                  >
                    {tab.label} ({rowCounts[tab.key]})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Compact screens: a flat two-line list (tap a row for details and actions). */}
          {isCompact ? (
            <ul className="m-0 list-none rounded border border-slate-200 p-0 dark:border-slate-800">
              {isTableLoading ? (
                <li className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-xs text-slate-400">
                  <span className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span>{LOADING_ROWS_MESSAGE}</span>
                </li>
              ) : sortedRows.length === 0 ? (
                <li className="px-4 py-8 text-center text-xs text-slate-400">{emptyRowsMessage}</li>
              ) : (
                paginatedRows.map((row) => <ChatListRow key={rowKey(row)} {...rowProps(row)} />)
              )}
            </ul>
          ) : (
            /* Bảng hợp nhất */
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="w-20 whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Loại
                    </th>
                    <th className="whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Cuộc trò chuyện / Người dùng
                    </th>
                    <th className="w-40 whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      ID
                    </th>
                    <th className="w-28 whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Lắng nghe
                    </th>
                    <th className="w-40 whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Tính năng
                    </th>
                    <th className="w-48 whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Quyền tương tác
                    </th>
                    <th className="w-28 text-right whitespace-nowrap px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {isTableLoading ? (
                    <tr>
                      <td className="px-4 py-12 text-center text-slate-400" colSpan={7}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                          <span>{LOADING_ROWS_MESSAGE}</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                        {emptyRowsMessage}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <ChatTableRow key={rowKey(row)} {...rowProps(row)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Số mục mỗi trang:</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 max-[640px]:h-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onChange={(e) => setPageSize(Number(e.target.value))}
                value={pageSize}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={10000}>Tất cả</option>
              </select>
              <span>
                Hiển thị{' '}
                <strong>
                  {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, sortedRows.length)}
                </strong>{' '}
                trên <strong>{sortedRows.length}</strong> mục
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 max-[640px]:h-10 max-[640px]:px-3 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  type="button"
                >
                  ← Trước
                </button>
                <span className="px-2 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 max-[640px]:h-10 max-[640px]:px-3 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  type="button"
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileActionBar>
        {status && !status.loggedIn && (
          <button
            className={`${MOBILE_ACTION_BUTTON} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}
            onClick={() => void handleOpenQrLogin(false)}
            type="button"
          >
            <QrIcon />
            {QR_LOGIN_LABEL}
          </button>
        )}
        <button
          className={`${MOBILE_ACTION_BUTTON} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
          onClick={() => setUserDialog({ mode: 'create' })}
          type="button"
        >
          {ADD_USER_LABEL}
        </button>
      </MobileActionBar>

      {/* QR Login Modal */}
      <Modal
        open={isQrModalOpen}
        onDismiss={() => setIsQrModalOpen(false)}
        ariaLabel="Đăng nhập Zalo cá nhân (ZCA)"
        backdropClassName="bg-slate-900/60 backdrop-blur-sm"
        panelClassName="max-w-sm rounded-[3px] border border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          className={`${MODAL_STICKY_HEADER} flex items-center justify-between border-b border-slate-100 bg-white pt-5 pb-3 dark:border-slate-800 dark:bg-slate-900`}
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Đăng nhập Zalo cá nhân (ZCA)
          </h3>
          <button
            aria-label={t('common.close')}
            className={`rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${MODAL_CLOSE_TAP}`}
            onClick={() => setIsQrModalOpen(false)}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="my-4 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mở ứng dụng Zalo trên điện thoại, chọn biểu tượng <strong>Quét mã QR</strong> và xác
            nhận đăng nhập.
          </p>

          {/* QR Image Container */}
          <div className="flex size-56 items-center justify-center rounded-[3px] border-2 border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
            <img
              alt="Mã QR đăng nhập Zalo"
              className="size-full object-contain"
              onError={() => {
                // Retry with new timestamp if not ready
                setTimeout(() => setQrTimestamp(Date.now()), 1500);
              }}
              src={getZcaQrImageUrl(qrTimestamp)}
            />
          </div>

          {/* Dynamic QR Scan Status Banner */}
          {status?.qrStatus?.phase === 'scanned' ? (
            <div className="w-full flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
              <span className="size-2 rounded-full bg-blue-500 animate-ping" />
              <span>
                📱 Đã quét bởi <strong>{status.qrStatus.scannedBy || 'bạn'}</strong>! Vui lòng bấm{' '}
                <strong>Xác nhận đăng nhập</strong> trên điện thoại.
              </span>
            </div>
          ) : status?.qrStatus?.phase === 'confirmed' ||
            status?.qrStatus?.phase === 'logging_in' ? (
            <div className="w-full flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
              <span className="size-2 rounded-full bg-indigo-500 animate-ping" />
              <span>🔄 Đã xác nhận trên điện thoại! Đang hoàn tất thiết lập kết nối...</span>
            </div>
          ) : status?.qrStatus?.phase === 'expired' ? (
            <div className="w-full flex flex-col items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>⏰ Mã QR đã hết hạn.</span>
              </div>
              <button
                className="mt-1 font-semibold underline max-sm:min-h-10 max-sm:px-2 hover:text-amber-900 dark:hover:text-amber-100"
                onClick={() => void handleOpenQrLogin(true)}
                type="button"
              >
                Tạo mã mới ngay
              </button>
            </div>
          ) : status?.qrStatus?.phase === 'declined' ? (
            <div className="w-full flex flex-col items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              <span>❌ Yêu cầu đăng nhập đã bị từ chối trên điện thoại.</span>
              <button
                className="mt-1 font-semibold underline max-sm:min-h-10 max-sm:px-2 hover:text-rose-900 dark:hover:text-rose-100"
                onClick={() => void handleOpenQrLogin(true)}
                type="button"
              >
                Thử lại mã mới
              </button>
            </div>
          ) : status?.qrStatus?.phase === 'failed' ? (
            <div className="w-full flex flex-col items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              <span>⚠️ Đăng nhập thất bại: {status.qrStatus.error || status.qrStatus.message}</span>
              <button
                className="mt-1 font-semibold underline max-sm:min-h-10 max-sm:px-2 hover:text-rose-900 dark:hover:text-rose-100"
                onClick={() => void handleOpenQrLogin(true)}
                type="button"
              >
                Thử tạo lại mã QR
              </button>
            </div>
          ) : status?.qrStatus?.phase === 'success' ? (
            <div className="w-full flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span>✅ Đăng nhập thành công! Đang đồng bộ dữ liệu...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
              <span className="text-[11px] text-slate-500">
                Đang chờ quét và xác nhận trên điện thoại...
              </span>
            </div>
          )}

          {qrCodeString && (
            <div className="w-full rounded bg-slate-100 p-2 text-[10px] font-mono break-all dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {qrCodeString}
            </div>
          )}
        </div>

        <div
          className={`${MODAL_STICKY_FOOTER} flex justify-end gap-2 border-t border-slate-100 bg-white pt-3 pb-5 dark:border-slate-800 dark:bg-slate-900`}
        >
          <button
            className={`rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${MODAL_FOOTER_TAP}`}
            onClick={() => void handleOpenQrLogin(true)}
            type="button"
          >
            Làm mới mã QR
          </button>
          <button
            className={`rounded bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:text-white ${MODAL_FOOTER_TAP}`}
            onClick={() => setIsQrModalOpen(false)}
            type="button"
          >
            Đóng
          </button>
        </div>
      </Modal>

      {/* Historical Media Backup Modal */}
      {syncThreadTarget && (
        <SyncMediaModal
          isOpen={Boolean(syncThreadTarget)}
          onClose={() => setSyncThreadTarget(null)}
          thread={syncThreadTarget}
          threadConfig={configMap.get(syncThreadTarget.id)}
        />
      )}

      {/* Add / Edit User Dialog */}
      {userDialog && (
        <UserFormDialog
          initialId={userDialog.mode === 'create' ? userDialog.initialId : undefined}
          initialName={userDialog.mode === 'create' ? userDialog.initialName : undefined}
          onClose={() => setUserDialog(null)}
          user={userDialog.mode === 'edit' ? userDialog.user : undefined}
        />
      )}

      {/* Merge Duplicate Users Dialog */}
      {mergingUser && (
        <MergeUserDialog
          onClose={() => setMergingUser(null)}
          onMerged={handleMerged}
          source={mergingUser}
          users={users}
        />
      )}

      {/* Debt contacts linked to a user account */}
      {linkedContactsUser && (
        <LinkedContactsDialog
          onClose={() => setLinkedContactsUser(null)}
          user={linkedContactsUser}
        />
      )}
    </div>
  );
}

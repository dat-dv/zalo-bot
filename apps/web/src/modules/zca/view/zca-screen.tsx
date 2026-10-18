'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useZcaStatusQuery,
  useZcaThreadsQuery,
  useRefreshZcaThreadsMutation,
  useLoginZcaQrMutation,
  useLogoutZcaMutation,
  useSetZcaListenedThreadsMutation,
  useToggleZcaListenedThreadMutation,
  useZcaThreadConfigsQuery,
  useGoogleDriveFolderLinkQuery,
  zcaQueryKeys,
} from '../api/zca-query';
import {
  getThreadDriveLink,
  getThreadDriveOpenUrl,
  type ZcaThread,
} from '../api/zca-api';
import { ThreadConfigModal } from './thread-config-modal';
import { useLocale } from '@/shared/providers/locale-provider';

function normalizeVietnamese(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function ThreadAvatar({ thread }: { thread: ZcaThread }) {
  const [imgError, setImgError] = useState(false);

  if (thread.avatar && !imgError) {
    return (
      <img
        alt={thread.name || 'Avatar'}
        className="size-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={thread.avatar}
      />
    );
  }

  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        thread.type === 'group'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
          : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
      }`}
    >
      {thread.name ? thread.name.charAt(0).toUpperCase() : thread.type === 'group' ? '👥' : '👤'}
    </div>
  );
}

export function ZcaScreen() {
  const { t } = useLocale();
  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const { data: status, refetch: refetchStatus } = useZcaStatusQuery({
    refetchInterval: pollInterval,
  });
  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    refetch: refetchThreads,
  } = useZcaThreadsQuery({ enabled: Boolean(status?.loggedIn) });
  const { data: threadConfigs = [] } = useZcaThreadConfigsQuery();
  const { data: driveRootData } = useGoogleDriveFolderLinkQuery();
  const queryClient = useQueryClient();

  const refreshThreadsMutation = useRefreshZcaThreadsMutation();
  const loginQrMutation = useLoginZcaQrMutation();
  const logoutMutation = useLogoutZcaMutation();
  const setListenedMutation = useSetZcaListenedThreadsMutation();
  const toggleListenedMutation = useToggleZcaListenedThreadMutation();

  const isLoggingOut = logoutMutation.isPending;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'listened' | 'group' | 'user'>('all');
  const [sortBy, setSortBy] = useState<
    'listened_first' | 'name_asc' | 'name_desc' | 'group_first' | 'user_first' | 'members_desc'
  >('listened_first');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedThreadForConfig, setSelectedThreadForConfig] = useState<ZcaThread | null>(null);

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

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, sortBy, pageSize]);

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

  // Filtered threads with Vietnamese normalization and alias search
  const filteredThreads = useMemo(() => {
    const normSearch = normalizeVietnamese(search);
    return threads.filter((thread) => {
      if (normSearch) {
        const matchesName = normalizeVietnamese(thread.name || '').includes(normSearch);
        const matchesDisplayName = normalizeVietnamese(thread.displayName || '').includes(
          normSearch,
        );
        const matchesAlias = normalizeVietnamese(thread.alias || '').includes(normSearch);
        const matchesZaloName = normalizeVietnamese(thread.zaloName || '').includes(normSearch);
        const matchesPhone = (thread.phoneNumber || '').toLowerCase().includes(normSearch);
        const matchesId = thread.id.toLowerCase().includes(normSearch);

        if (
          !matchesName &&
          !matchesDisplayName &&
          !matchesAlias &&
          !matchesZaloName &&
          !matchesPhone &&
          !matchesId
        ) {
          return false;
        }
      }

      if (filter === 'listened') return thread.isListened;
      if (filter === 'group') return thread.type === 'group';
      if (filter === 'user') return thread.type === 'user';

      return true;
    });
  }, [threads, search, filter]);

  // Sorted threads
  const sortedThreads = useMemo(() => {
    return [...filteredThreads].sort((a, b) => {
      if (sortBy === 'listened_first') {
        if (a.isListened !== b.isListened) return a.isListened ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', 'vi');
      }
      if (sortBy === 'group_first') {
        if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      if (sortBy === 'user_first') {
        if (a.type !== b.type) return a.type === 'user' ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      if (sortBy === 'members_desc') {
        const memA = a.totalMembers ?? 0;
        const memB = b.totalMembers ?? 0;
        if (memA !== memB) return memB - memA;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      return 0;
    });
  }, [filteredThreads, sortBy]);

  // Paginated threads
  const totalPages = Math.max(1, Math.ceil(sortedThreads.length / pageSize));
  const paginatedThreads = useMemo(() => {
    if (pageSize >= sortedThreads.length) return sortedThreads;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedThreads.slice(startIndex, startIndex + pageSize);
  }, [sortedThreads, currentPage, pageSize]);

  const listenedCount = status?.listenedCount ?? threads.filter((t) => t.isListened).length;
  const isRefreshing = refreshThreadsMutation.isPending;

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tài khoản Zalo Cá nhân (ZCA)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quản lý kết nối tài khoản Zalo cá nhân, danh bạ bạn bè, nhóm chat và cấu hình lắng nghe
            tin nhắn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            disabled={isRefreshing}
            onClick={() => void handleRefreshAll()}
            title="Làm mới trạng thái và cập nhật lại danh bạ, nhóm từ Zalo"
            type="button"
          >
            <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Đang tải lại...' : 'Làm mới'}
          </button>
          {status?.loggedIn ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogoutIcon />
              {isLoggingOut ? 'Đang đăng xuất...' : t('zca.logout')}
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-1.5 rounded-[4px] bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none"
              onClick={() => void handleOpenQrLogin(false)}
              type="button"
            >
              <QrIcon />
              Quét mã QR đăng nhập
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Trạng thái kết nối */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Trạng thái kết nối
            </p>
            {status?.loggedIn && (
              <button
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-50"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                type="button"
              >
                {isLoggingOut ? 'Đang đăng xuất...' : t('zca.logout')}
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex size-2.5 rounded-full ${
                status?.loggedIn ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {status?.loggedIn ? 'Đã kết nối ZCA' : 'Chưa đăng nhập'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {status?.loggedIn
              ? `ID tài khoản: ${status.ownId || 'Đang cập nhật'}`
              : 'Hãy quét mã QR để bắt đầu'}
          </p>
        </div>

        {/* Card 2: Trình lắng nghe sự kiện */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Lắng nghe tin nhắn & sự kiện
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                status?.isListening
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {status?.isListening ? 'Đang hoạt động' : 'Tạm dừng'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Tự động kích hoạt khi đăng nhập thành công
          </p>
        </div>

        {/* Card 3: Danh sách lắng nghe (Whitelist) */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Danh sách lắng nghe (Whitelist)
          </p>
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

        {/* Card 4: Tổng số phát hiện */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng danh bạ đã nạp
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {threads.length}
            </span>
            <span className="text-xs text-slate-500">
              ({threads.filter((t) => t.type === 'group').length} nhóm,{' '}
              {threads.filter((t) => t.type === 'user').length} bạn bè)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {status?.proxyEnabled ? 'HTTP Proxy đã bật' : 'Kết nối trực tiếp'}
          </p>
        </div>
      </div>

      {/* Main Section: Whitelist Management */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Danh sách cuộc trò chuyện & Whitelist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chỉ những nhóm chat hoặc người dùng được bật ở danh sách bên dưới mới được bot tiếp
                nhận tin nhắn và xử lý các tính năng (thu chi, sao lưu, lịch hẹn...).
              </p>
            </div>

            {/* Quick Action: Google Drive Link */}
            <div className="flex items-center gap-2">
              <a
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
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

          {/* Form thêm ID thủ công */}
          <form
            className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2.5 dark:bg-slate-800/60"
            onSubmit={handleAddManualId}
          >
            <div className="flex-1 min-w-[220px]">
              <input
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Nhập ID Nhóm hoặc ID Người dùng thủ công (ví dụ: g-123456 hoặc 987654321)..."
                type="text"
                value={manualId}
              />
            </div>
            <button
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              type="submit"
            >
              + Thêm vào Whitelist
            </button>
            {manualError && <p className="w-full text-xs text-rose-500">{manualError}</p>}
          </form>

          {/* Search, Sort & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search input */}
              <div className="relative">
                <input
                  className="w-64 rounded border border-slate-300 bg-white pl-7 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, gợi nhớ, SĐT, ID..."
                  type="text"
                  value={search}
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">🔍</span>
                {search && (
                  <button
                    className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    onClick={() => setSearch('')}
                    title="Xóa tìm kiếm"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Sắp xếp:</span>
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as
                        | 'listened_first'
                        | 'name_asc'
                        | 'name_desc'
                        | 'group_first'
                        | 'user_first'
                        | 'members_desc',
                    )
                  }
                  value={sortBy}
                >
                  <option value="listened_first">Đang lắng nghe lên đầu</option>
                  <option value="name_asc">Tên (A → Z)</option>
                  <option value="name_desc">Tên (Z → A)</option>
                  <option value="group_first">Nhóm chat trước</option>
                  <option value="user_first">Bạn bè trước</option>
                  <option value="members_desc">Nhóm đông thành viên nhất</option>
                </select>
              </div>

              {search && (
                <span className="text-xs text-slate-500">
                  Tìm thấy <strong>{filteredThreads.length}</strong> kết quả
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 flex-wrap">
              <button
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  filter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                onClick={() => setFilter('all')}
                type="button"
              >
                Tất cả ({threads.length})
              </button>
              <button
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  filter === 'listened'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                onClick={() => setFilter('listened')}
                type="button"
              >
                Đang lắng nghe ({threads.filter((t) => t.isListened).length})
              </button>
              <button
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  filter === 'group'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                onClick={() => setFilter('group')}
                type="button"
              >
                Nhóm chat ({threads.filter((t) => t.type === 'group').length})
              </button>
              <button
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  filter === 'user'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                onClick={() => setFilter('user')}
                type="button"
              >
                Bạn bè ({threads.filter((t) => t.type === 'user').length})
              </button>
            </div>
          </div>

          {/* Threads List Table */}
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 w-20">
                    Loại
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                    Cuộc trò chuyện / Liên hệ
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 w-48">
                    ID
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-center w-40">
                    Trạng thái lắng nghe
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-right w-52">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {isThreadsLoading ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-slate-400" colSpan={5}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="size-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Đang tải danh sách nhóm & bạn bè từ Zalo...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedThreads.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      {threads.length === 0
                        ? 'Chưa có cuộc trò chuyện nào được phát hiện. Vui lòng đăng nhập Zalo hoặc thêm ID thủ công ở trên.'
                        : 'Không tìm thấy cuộc trò chuyện phù hợp với từ khóa hoặc bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  paginatedThreads.map((thread) => (
                    <tr
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                        thread.isListened ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                      }`}
                      key={thread.id}
                    >
                      {/* Cột Loại */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                            thread.type === 'group'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          }`}
                        >
                          {thread.type === 'group' ? '👥 Nhóm' : '👤 Cá nhân'}
                        </span>
                      </td>

                      {/* Cột Tên & Avatar & Thông tin nhận diện */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            <ThreadAvatar thread={thread} />
                            {thread.isListened && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                                title="Đang trong danh sách lắng nghe (Whitelist)"
                              />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[280px]">
                                {thread.name || 'Không có tên'}
                              </span>
                              {thread.alias && (
                                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                  🏷️ Gợi nhớ: {thread.alias}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              {thread.type === 'group' ? (
                                <span>
                                  👥{' '}
                                  {typeof thread.totalMembers === 'number'
                                    ? `${thread.totalMembers.toLocaleString()} thành viên`
                                    : 'Nhóm chat'}
                                </span>
                              ) : (
                                <>
                                  {thread.displayName && thread.displayName !== thread.name && (
                                    <span>Zalo: {thread.displayName}</span>
                                  )}
                                  {thread.phoneNumber && (
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                      📞 {thread.phoneNumber}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột ID */}
                      <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[150px]">{thread.id}</span>
                          <button
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            onClick={() => copyToClipboard(thread.id)}
                            title="Sao chép ID"
                            type="button"
                          >
                            {copiedId === thread.id ? (
                              <span className="text-[10px] text-emerald-600 font-sans">
                                Đã chép
                              </span>
                            ) : (
                              <CopyIcon />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Cột Trạng thái */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            thread.isListened
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {thread.isListened ? '● Đang lắng nghe' : '○ Bỏ qua'}
                        </span>
                        {configMap.get(thread.id) && (
                          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                            {configMap.get(thread.id)?.directInteraction?.enabled && (
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                  (configMap.get(thread.id)?.directInteraction?.requireMention ??
                                  true)
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                }`}
                                title={
                                  (configMap.get(thread.id)?.directInteraction?.requireMention ??
                                  true)
                                    ? 'Cần @Bot hoặc tiền tố để kích hoạt'
                                    : 'Trò chuyện tự do (không cần @Bot)'
                                }
                              >
                                {(configMap.get(thread.id)?.directInteraction?.requireMention ??
                                true)
                                  ? '🤖 @Bot'
                                  : '🤖 Tự do'}
                              </span>
                            )}
                            {configMap.get(thread.id)?.mediaBackup.enabled && (
                              <a
                                className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors"
                                href={getThreadDriveLink(
                                  thread,
                                  configMap.get(thread.id),
                                )}
                                onClick={() => {
                                  setTimeout(() => {
                                    void queryClient.invalidateQueries({
                                      queryKey: zcaQueryKeys.configs(),
                                    });
                                  }, 2000);
                                }}
                                rel="noopener noreferrer"
                                target="_blank"
                                title={`Mở thư mục Google Drive: ${configMap.get(thread.id)?.driveFolderPath || configMap.get(thread.id)?.mediaBackup.customFolder || `zalobot/${thread.id}`}`}
                              >
                                📁 Drive ↗
                              </a>
                            )}
                            {configMap.get(thread.id)?.expenseTracking.enabled && (
                              <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                💰 Thu chi
                              </span>
                            )}
                            {configMap.get(thread.id)?.calendarExtraction.enabled && (
                              <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                📅 Lịch
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Cột Thao tác (Google Drive, Cấu hình tính năng & Toggle switch button) */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-colors"
                            href={getThreadDriveLink(
                              thread,
                              configMap.get(thread.id),
                            )}
                            onClick={() => {
                              setTimeout(() => {
                                void queryClient.invalidateQueries({
                                  queryKey: zcaQueryKeys.configs(),
                                });
                              }, 2000);
                            }}
                            rel="noopener noreferrer"
                            target="_blank"
                            title={`Mở thư mục Google Drive (${configMap.get(thread.id)?.driveFolderPath || configMap.get(thread.id)?.mediaBackup.customFolder || `zalobot/${thread.id}`})`}
                          >
                            <GoogleDriveIcon className="size-3.5 shrink-0" />
                            <span>Drive</span>
                          </a>
                          <button
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            onClick={() => setSelectedThreadForConfig(thread)}
                            title="Cấu hình tính năng bot cho nhóm hoặc cá nhân này"
                            type="button"
                          >
                            ⚙️ Cấu hình
                          </button>
                          <button
                            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                              thread.isListened
                                ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                            onClick={() => handleToggleThread(thread.id)}
                            type="button"
                          >
                            {thread.isListened ? 'Tắt' : 'Bật'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Số mục mỗi trang:</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                  {sortedThreads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, sortedThreads.length)}
                </strong>{' '}
                trên <strong>{sortedThreads.length}</strong> cuộc trò chuyện
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  ← Trước
                </button>
                <span className="px-2 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  type="button"
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Login Modal */}
      {isQrModalOpen && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="relative w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Đăng nhập Zalo cá nhân (ZCA)
              </h3>
              <button
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
              <div className="flex size-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
                <img
                  alt="Mã QR đăng nhập Zalo"
                  className="size-full object-contain"
                  onError={() => {
                    // Retry with new timestamp if not ready
                    setTimeout(() => setQrTimestamp(Date.now()), 1500);
                  }}
                  src={`/api/zca/qr?t=${qrTimestamp}`}
                />
              </div>

              {/* Dynamic QR Scan Status Banner */}
              {status?.qrStatus?.phase === 'scanned' ? (
                <div className="w-full flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                  <span className="size-2 rounded-full bg-blue-500 animate-ping" />
                  <span>
                    📱 Đã quét bởi <strong>{status.qrStatus.scannedBy || 'bạn'}</strong>! Vui lòng
                    bấm <strong>Xác nhận đăng nhập</strong> trên điện thoại.
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
                    className="mt-1 font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
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
                    className="mt-1 font-semibold underline hover:text-rose-900 dark:hover:text-rose-100"
                    onClick={() => void handleOpenQrLogin(true)}
                    type="button"
                  >
                    Thử lại mã mới
                  </button>
                </div>
              ) : status?.qrStatus?.phase === 'failed' ? (
                <div className="w-full flex flex-col items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  <span>
                    ⚠️ Đăng nhập thất bại: {status.qrStatus.error || status.qrStatus.message}
                  </span>
                  <button
                    className="mt-1 font-semibold underline hover:text-rose-900 dark:hover:text-rose-100"
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

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => void handleOpenQrLogin(true)}
                type="button"
              >
                Làm mới mã QR
              </button>
              <button
                className="rounded bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                onClick={() => setIsQrModalOpen(false)}
                type="button"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thread Feature Config Modal */}
      {selectedThreadForConfig && (
        <ThreadConfigModal
          isOpen={Boolean(selectedThreadForConfig)}
          onClose={() => setSelectedThreadForConfig(null)}
          threadId={selectedThreadForConfig.id}
          threadName={selectedThreadForConfig.name}
          threadType={selectedThreadForConfig.type}
        />
      )}
    </div>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="7" width="7" x="3" y="3" />
      <rect height="7" width="7" x="14" y="3" />
      <rect height="7" width="7" x="14" y="14" />
      <rect height="7" width="7" x="3" y="14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function GoogleDriveIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3-6.75-11.75-12.6 21.85c-.45.75-.45 1.55 0 2.25z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3l-21.55 37.35 12.6-21.85 12.3-21.3z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.75 3.85-6.65c.45-.7.45-1.5 0-2.25l-20.05-34.75-12.3 21.3 11.4 19.75 12.3 8.65z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 12.3-21.3c-1.3-.8-2.9-1.2-4.5-1.2h-15.6c-1.6 0-3.2.4-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53.5h-32.3l-12.3 21.3c1.3.8 2.9 1.2 4.5 1.2h47.9c1.6 0 3.2-.4 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.55 76.8-12.3-21.3h-24.6l-6.75 11.7 11.4 19.75c1.3-.8 2.4-1.9 3.2-3.3z"
        fill="#ffba00"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'size-3' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

function LogoutIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

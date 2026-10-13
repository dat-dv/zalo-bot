'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useZcaStatusQuery,
  useZcaThreadsQuery,
  useLoginZcaQrMutation,
  useSetZcaListenedThreadsMutation,
  useToggleZcaListenedThreadMutation,
} from '../api/zca-query';

export function ZcaScreen() {
  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const { data: status, refetch: refetchStatus } = useZcaStatusQuery({
    refetchInterval: pollInterval,
  });
  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    refetch: refetchThreads,
  } = useZcaThreadsQuery();

  const loginQrMutation = useLoginZcaQrMutation();
  const setListenedMutation = useSetZcaListenedThreadsMutation();
  const toggleListenedMutation = useToggleZcaListenedThreadMutation();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'listened' | 'group' | 'user'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyToClipboard = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const handleToggleThread = async (threadId: string) => {
    await toggleListenedMutation.mutateAsync(threadId);
    void refetchStatus();
  };

  const handleSelectAllVisible = async (visibleThreadIds: string[]) => {
    const currentListened = new Set(threads.filter((t) => t.isListened).map((t) => t.id));
    for (const id of visibleThreadIds) {
      currentListened.add(id);
    }
    await setListenedMutation.mutateAsync(Array.from(currentListened));
    void refetchStatus();
  };

  const handleDeselectAll = async () => {
    if (
      confirm(
        'Bạn có chắc chắn muốn bỏ chọn tất cả? Bot sẽ tạm thời lắng nghe mọi tin nhắn nếu danh sách trống.',
      )
    ) {
      await setListenedMutation.mutateAsync([]);
      void refetchStatus();
    }
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

  // Filtered threads
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const matchesSearch =
        thread.id.toLowerCase().includes(search.toLowerCase()) ||
        thread.name.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (filter === 'listened') return thread.isListened;
      if (filter === 'group') return thread.type === 'group';
      if (filter === 'user') return thread.type === 'user';

      return true;
    });
  }, [threads, search, filter]);

  const listenedCount = status?.listenedCount ?? threads.filter((t) => t.isListened).length;

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tài khoản Zalo Cá nhân (ZCA)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quản lý kết nối tài khoản Zalo cá nhân, mã QR và chọn lọc danh sách lắng nghe tin nhắn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              void refetchStatus();
              void refetchThreads();
            }}
            type="button"
          >
            <RefreshIcon />
            Làm mới
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none"
            onClick={() => void handleOpenQrLogin(false)}
            type="button"
          >
            <QrIcon />
            Quét mã QR đăng nhập
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Trạng thái kết nối */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
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

        {/* Card 4: Kết nối Proxy */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Proxy kết nối</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                status?.proxyEnabled
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {status?.proxyEnabled ? 'HTTP Proxy' : 'Kết nối trực tiếp'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {status?.proxyEnabled ? 'Bảo vệ IP qua HttpProxyAgent' : 'Chưa cấu hình ZCA_PROXY_URL'}
          </p>
        </div>
      </div>

      {/* Main Section: Whitelist Management */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3">
          {/* Header & Description */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Danh sách lắng nghe (Whitelist Chat / Group)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chỉ những nhóm chat hoặc người dùng được bật ở danh sách bên dưới mới được bot tiếp
                nhận tin nhắn và tự động gửi lời chào mừng (Welcome).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSelectAllVisible(filteredThreads.map((t) => t.id))}
                type="button"
              >
                Chọn tất cả đang hiển thị
              </button>
              <button
                className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                onClick={handleDeselectAll}
                type="button"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          {/* Form thêm ID thủ công */}
          <form
            className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2.5 dark:bg-slate-800/60"
            onSubmit={handleAddManualId}
          >
            <div className="flex-1 min-w-[200px]">
              <input
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Nhập ID Nhóm hoặc ID Người dùng (ví dụ: g-123456 hoặc 987654321)..."
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

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <input
                className="w-64 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên hoặc ID..."
                type="text"
                value={search}
              />
              {search && (
                <button
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => setSearch('')}
                  type="button"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
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
                Người dùng ({threads.filter((t) => t.type === 'user').length})
              </button>
            </div>
          </div>

          {/* Threads List Table */}
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                    Loại
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                    Tên cuộc trò chuyện
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                    ID
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-center">
                    Trạng thái lắng nghe
                  </th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {isThreadsLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      Đang tải danh sách cuộc trò chuyện...
                    </td>
                  </tr>
                ) : filteredThreads.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                      {threads.length === 0
                        ? 'Chưa có cuộc trò chuyện nào được phát hiện. Vui lòng đăng nhập Zalo hoặc thêm ID thủ công ở trên.'
                        : 'Không tìm thấy cuộc trò chuyện phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredThreads.map((thread) => (
                    <tr
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                        thread.isListened ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
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
                          {thread.type === 'group' ? 'Nhóm' : 'Người dùng'}
                        </span>
                      </td>

                      {/* Cột Tên */}
                      <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {thread.name ? thread.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="truncate max-w-[240px]">
                            {thread.name || 'Không có tên'}
                          </span>
                        </div>
                      </td>

                      {/* Cột ID */}
                      <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span>{thread.id}</span>
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
                      </td>

                      {/* Cột Thao tác (Toggle switch button) */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <button
                          className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                            thread.isListened
                              ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                          onClick={() => handleToggleThread(thread.id)}
                          type="button"
                        >
                          {thread.isListened ? 'Tắt lắng nghe' : 'Bật lắng nghe'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                    📱 Đã quét bởi <strong>{status.qrStatus.scannedBy || 'bạn'}</strong>! Vui lòng bấm <strong>Xác nhận đăng nhập</strong> trên điện thoại.
                  </span>
                </div>
              ) : status?.qrStatus?.phase === 'confirmed' || status?.qrStatus?.phase === 'logging_in' ? (
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
                  <span>⚠️ Đăng nhập thất bại: {status.qrStatus.error || status.qrStatus.message}</span>
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
    </div>
  );
}

function RefreshIcon() {
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

'use client';

import { useState } from 'react';
import type {
  SyncMediaTimeRange,
  SyncThreadMediaResponse,
  ThreadBotConfig,
} from '@zalobot/contracts';
import { useSyncThreadMediaMutation } from '../api/zca-query';
import { getThreadDriveLink, getThreadPhotosLink, type ZcaThread } from '../api/zca-api';

interface SyncMediaModalProps {
  isOpen: boolean;
  thread: ZcaThread | null;
  threadConfig?: ThreadBotConfig | null;
  onClose: () => void;
}

const TIME_RANGES: { value: SyncMediaTimeRange; label: string; desc: string }[] = [
  { value: '1_month', label: '1 tháng gần nhất', desc: 'Rà soát tin nhắn trong vòng 30 ngày qua' },
  { value: '2_months', label: '2 tháng gần nhất', desc: 'Rà soát tin nhắn trong vòng 60 ngày qua' },
  { value: '3_months', label: '3 tháng gần nhất', desc: 'Rà soát tin nhắn trong vòng 90 ngày qua' },
  {
    value: '6_months',
    label: '6 tháng gần nhất',
    desc: 'Rà soát tin nhắn trong vòng 180 ngày qua',
  },
  { value: 'all', label: 'Toàn bộ lịch sử', desc: 'Quét toàn bộ lịch sử nhóm có thể tải được' },
];

export function SyncMediaModal({ isOpen, thread, threadConfig, onClose }: SyncMediaModalProps) {
  const syncMutation = useSyncThreadMediaMutation();

  const [timeRange, setTimeRange] = useState<SyncMediaTimeRange>('1_month');
  const [mediaTypes, setMediaTypes] = useState<{
    image: boolean;
    video: boolean;
    file: boolean;
  }>({
    image: true,
    video: true,
    file: true,
  });

  const [result, setResult] = useState<SyncThreadMediaResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !thread) return null;

  const driveLink = getThreadDriveLink(thread, threadConfig);
  const photosLink = getThreadPhotosLink(thread, threadConfig);

  const handleStartSync = async () => {
    setResult(null);
    setErrorMessage(null);

    const selectedTypes: ('image' | 'video' | 'file')[] = [];
    if (mediaTypes.image) selectedTypes.push('image');
    if (mediaTypes.video) selectedTypes.push('video');
    if (mediaTypes.file) selectedTypes.push('file');

    if (selectedTypes.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất một định dạng media (Ảnh, Video hoặc File).');
      return;
    }

    try {
      const res = await syncMutation.mutateAsync({
        threadId: thread.id,
        data: {
          timeRange,
          mediaTypes: selectedTypes,
        },
      });
      setResult(res);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Đã có lỗi xảy ra trong quá trình quét media.';
      setErrorMessage(msg);
    }
  };

  const handleClose = () => {
    if (syncMutation.isPending) return;
    setResult(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-lg dark:bg-blue-950/60">
              ⏳
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sao lưu media từ lịch sử nhóm
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhóm:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {thread.name || thread.id}
                </span>
              </p>
            </div>
          </div>
          <button
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            disabled={syncMutation.isPending}
            onClick={handleClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Deduplication Guarantee Note */}
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/60 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">🛡️</span>
              <div>
                <p className="font-semibold text-blue-950 dark:text-blue-200">
                  Chống trùng lặp tuyệt đối (Zero Duplicate)
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-400">
                  Hệ thống tự động so sánh mã tin nhắn (msgId) và nội dung trên Google Drive. Các
                  hình ảnh/video/tệp đã từng sao lưu sẽ tự động được bỏ qua và{' '}
                  <strong>không bao giờ bị tải lại trùng lặp</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              Khoảng thời gian cần rà soát & quét lại:
            </label>
            <div className="space-y-1.5">
              {TIME_RANGES.map((range) => {
                const isSelected = timeRange === range.value;
                return (
                  <label
                    key={range.value}
                    className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        checked={isSelected}
                        className="size-4 text-blue-600 focus:ring-blue-500"
                        disabled={syncMutation.isPending}
                        name="sync-time-range"
                        onChange={() => setTimeRange(range.value)}
                        type="radio"
                        value={range.value}
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {range.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {range.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">✓</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Media Types Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              Loại tệp sao lưu:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
                  mediaTypes.image
                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <input
                  checked={mediaTypes.image}
                  className="size-3.5 rounded border-slate-300 text-blue-600"
                  disabled={syncMutation.isPending}
                  onChange={(e) => setMediaTypes({ ...mediaTypes, image: e.target.checked })}
                  type="checkbox"
                />
                <span>🖼️ Ảnh</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
                  mediaTypes.video
                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <input
                  checked={mediaTypes.video}
                  className="size-3.5 rounded border-slate-300 text-blue-600"
                  disabled={syncMutation.isPending}
                  onChange={(e) => setMediaTypes({ ...mediaTypes, video: e.target.checked })}
                  type="checkbox"
                />
                <span>🎬 Video</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
                  mediaTypes.file
                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <input
                  checked={mediaTypes.file}
                  className="size-3.5 rounded border-slate-300 text-blue-600"
                  disabled={syncMutation.isPending}
                  onChange={(e) => setMediaTypes({ ...mediaTypes, file: e.target.checked })}
                  type="checkbox"
                />
                <span>📁 File / Tài liệu</span>
              </label>
            </div>
          </div>

          {/* Destination Google Drive Folder & Google Photos Album */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/30">
              <span className="text-slate-500 dark:text-slate-400">
                📁 Thư mục Google Drive của nhóm
              </span>
              <a
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                href={driveLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>Xem Drive</span>
                <svg
                  className="size-3"
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
              </a>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/30">
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                📸 Album Google Photos:{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {threadConfig?.photosAlbumTitle || `[Zalo] ${thread.name || thread.id}`}
                </strong>
              </span>
              <a
                className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400 shrink-0"
                href={photosLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>Xem Photos</span>
                <svg
                  className="size-3"
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
              </a>
            </div>
          </div>

          {/* Results Banner */}
          {result &&
            (result.warning === 'zalo_history_api_unavailable' ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">ℹ️</span>
                    <div>
                      <h4 className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-sm">
                        Thông báo về tính năng quét lịch sử cũ Zalo
                      </h4>
                      <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-300 text-[11px] sm:text-xs">
                        {result.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <a
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors"
                      href={driveLink}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      📂 Mở Drive
                    </a>
                    <a
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                      href={photosLink}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      📸 Mở Photos
                    </a>
                  </div>
                </div>

                <div className="mt-3.5 rounded-md border border-amber-200/80 bg-white/80 p-3 text-[11px] dark:border-amber-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>Sao lưu tự động thời gian thực (Real-time): Đang hoạt động 24/7</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Mọi hình ảnh, video và tệp tin mới gửi vào nhóm chat từ thời điểm bot tham gia
                    đều được tự động lưu trữ tức thì lên Google Drive & Google Photos mà không bị gián đoạn.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    ✅ Hoàn thành sao lưu media
                  </span>
                  <div className="flex items-center gap-1.5">
                    <a
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      href={driveLink}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      📂 Google Drive
                    </a>
                    <a
                      className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                      href={photosLink}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      📸 Google Photos
                    </a>
                  </div>
                </div>
                {result.warning === 'scanned_from_buffer' && (
                  <p className="mt-1.5 rounded bg-blue-100/70 p-1.5 text-[11px] text-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                    💡 Đã quét từ bộ nhớ đệm tin nhắn gần đây bot nhận được qua kết nối thời gian
                    thực.
                  </p>
                )}
                <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                  {result.message}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded bg-emerald-200/70 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                    📥 Mới tải lên: {result.syncedCount}
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-blue-900 dark:bg-blue-900/60 dark:text-blue-200">
                    ⚡ Đã có sẵn (bỏ qua trùng): {result.skippedCount}
                  </span>
                  {result.failedCount > 0 && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-900 dark:bg-rose-900/60 dark:text-rose-200">
                      ⚠️ Lỗi: {result.failedCount}
                    </span>
                  )}
                </div>
              </div>
            ))}

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              ❌ {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <button
            className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            disabled={syncMutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {result ? 'Đóng' : 'Hủy bỏ'}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={
              syncMutation.isPending || (!mediaTypes.image && !mediaTypes.video && !mediaTypes.file)
            }
            onClick={handleStartSync}
            type="button"
          >
            {syncMutation.isPending ? (
              <>
                <svg className="size-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
                </svg>
                <span>Đang quét & tải lên Drive...</span>
              </>
            ) : (
              <span>🚀 Bắt đầu quét & sao lưu</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

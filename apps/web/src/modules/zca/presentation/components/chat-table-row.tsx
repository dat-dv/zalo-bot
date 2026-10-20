'use client';

import { useState } from 'react';
import type { ThreadBotConfig } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { getThreadDriveLink, getThreadPhotosLink, type ZcaThread } from '../../api/zca-api';
import { hasInteractionAccess, type ChatRow } from '../../model/chat-rows';
import { ChatRowMenu, type ChatRowMenuItem } from './chat-row-menu';
import { CopyIcon, GoogleDriveIcon } from './zca-icons';

interface ChatTableRowProps {
  row: ChatRow;
  config?: ThreadBotConfig;
  isCopied: boolean;
  /** Người dùng này là chủ sổ thu chi chung. */
  isLedgerOwner?: boolean;
  onCopyId: (id: string) => void;
  onToggleListen: (threadId: string) => void;
  onToggleAccess: (row: ChatRow) => void;
  onConfigure: (thread: ZcaThread) => void;
  onSyncMedia: (thread: ZcaThread) => void;
  onDriveOpened: () => void;
  onEditUser: (row: ChatRow) => void;
  onMergeUser: (row: ChatRow) => void;
  onViewLinkedContacts: (row: ChatRow) => void;
  onDeleteUser: (row: ChatRow) => void;
}

const KIND_BADGE: Record<ChatRow['kind'], { label: string; className: string; title?: string }> = {
  group: {
    label: '👥 Nhóm',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  },
  personal: {
    label: '👤 Cá nhân',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  'user-only': {
    label: '🆔 Người dùng',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    title: 'Có trong hệ thống nhưng không có trong danh bạ ZCA (ID webhook hoặc chưa kết bạn)',
  },
};

const ACCESS_BADGE: Record<
  Exclude<ChatRow['access'], 'n/a'>,
  { label: string; className: string }
> = {
  admin: {
    label: '👑 Admin',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
  },
  granted: {
    label: '● Đã cấp quyền',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  pending: {
    label: '○ Chờ duyệt',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  },
  none: {
    label: '○ Chưa cấp',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
};

function RowAvatar({ row }: { row: ChatRow }) {
  const [imgError, setImgError] = useState(false);

  if (row.avatar && !imgError) {
    return (
      <img
        alt={row.name || 'Avatar'}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={row.avatar}
      />
    );
  }

  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${KIND_BADGE[row.kind].className}`}
    >
      {row.name ? row.name.charAt(0).toUpperCase() : row.kind === 'group' ? '👥' : '👤'}
    </div>
  );
}

function ConfigBadges({ row, config }: { row: ChatRow; config: ThreadBotConfig }) {
  const thread = row.thread;
  const requireMention = config.directInteraction?.requireMention ?? true;
  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
      {config.directInteraction?.enabled && (
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
            requireMention
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
          }`}
          title={
            requireMention
              ? 'Cần @Bot hoặc tiền tố để kích hoạt'
              : 'Trò chuyện tự do (không cần @Bot)'
          }
        >
          {requireMention ? '🤖 @Bot' : '🤖 Tự do'}
        </span>
      )}
      {thread && config.mediaBackup.enabled && (
        <a
          className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          href={getThreadDriveLink(thread, config)}
          rel="noopener noreferrer"
          target="_blank"
          title={`Mở thư mục Google Drive: ${config.driveFolderPath || `zalobot/${thread.id}`}`}
        >
          📁 Drive ↗
        </a>
      )}
      {thread && config.mediaBackup.enabled && (
        <a
          className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          href={getThreadPhotosLink(thread, config)}
          rel="noopener noreferrer"
          target="_blank"
          title={`Mở album Google Photos: ${config.photosAlbumTitle || `[Zalo] ${thread.name || thread.id}`}`}
        >
          📸 Photos ↗
        </a>
      )}
      {config.expenseTracking.enabled && (
        <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          💰 Thu chi
        </span>
      )}
      {config.calendarExtraction.enabled && (
        <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          📅 Lịch
        </span>
      )}
    </div>
  );
}

export function ChatTableRow({
  row,
  config,
  isCopied,
  isLedgerOwner = false,
  onCopyId,
  onToggleListen,
  onToggleAccess,
  onConfigure,
  onSyncMedia,
  onDriveOpened,
  onEditUser,
  onMergeUser,
  onViewLinkedContacts,
  onDeleteUser,
}: ChatTableRowProps) {
  const { t } = useLocale();
  const { thread } = row;
  const linkedContactCount = row.user?.linkedContactCount ?? 0;
  const kindBadge = KIND_BADGE[row.kind];
  const isGranted = hasInteractionAccess(row.access);

  const menuItems: ChatRowMenuItem[] =
    row.kind === 'group'
      ? []
      : [
          {
            key: 'edit',
            label: row.user ? '✏️ Sửa thông tin & vai trò' : '➕ Thêm vào người dùng',
            onSelect: () => onEditUser(row),
          },
          ...(row.user
            ? [
                { key: 'merge', label: '🔀 Gộp tài khoản trùng', onSelect: () => onMergeUser(row) },
                {
                  key: 'linked-contacts',
                  label: t('users.linkedContacts.action'),
                  onSelect: () => onViewLinkedContacts(row),
                },
                ...(row.access === 'admin'
                  ? []
                  : [
                      {
                        key: 'delete',
                        label: '🗑️ Xoá người dùng',
                        tone: 'danger' as const,
                        onSelect: () => onDeleteUser(row),
                      },
                    ]),
              ]
            : []),
        ];

  return (
    <tr
      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
        row.isListened ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
      }`}
    >
      {/* Loại */}
      <td className="whitespace-nowrap px-3.5 py-2.5">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${kindBadge.className}`}
          title={kindBadge.title}
        >
          {kindBadge.label}
        </span>
      </td>

      {/* Tên, avatar, thông tin nhận diện */}
      <td className="px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <RowAvatar row={row} />
            {isGranted && (
              <span
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                title="Đã cấp quyền tương tác"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="max-w-[280px] truncate font-semibold text-slate-900 dark:text-slate-100">
                {row.name || 'Không có tên'}
              </span>
              {row.alias && (
                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  🏷️ Gợi nhớ: {row.alias}
                </span>
              )}
              {isLedgerOwner && (
                <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {t('ledger.owner')}
                </span>
              )}
              {linkedContactCount > 0 && (
                <button
                  type="button"
                  onClick={() => onViewLinkedContacts(row)}
                  className="inline-flex cursor-pointer items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900"
                  title={t('users.linkedContacts.action')}
                >
                  {t('users.linkedContacts.badge', { count: linkedContactCount })}
                </button>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              {row.kind === 'group' ? (
                <span>
                  👥{' '}
                  {typeof thread?.totalMembers === 'number'
                    ? `${thread.totalMembers.toLocaleString()} thành viên`
                    : 'Nhóm chat'}
                </span>
              ) : (
                <>
                  {row.zaloName && row.zaloName !== row.name && <span>Zalo: {row.zaloName}</span>}
                  {row.phoneNumber && (
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      📞 {row.phoneNumber}
                    </span>
                  )}
                  {row.user?.username && <span>@{row.user.username}</span>}
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* ID */}
      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="max-w-[150px] truncate" title={row.id}>
            {row.id}
          </span>
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={() => onCopyId(row.id)}
            title="Sao chép ID"
            type="button"
          >
            {isCopied ? (
              <span className="font-sans text-[10px] text-emerald-600">Đã chép</span>
            ) : (
              <CopyIcon />
            )}
          </button>
        </div>
      </td>

      {/* Lắng nghe */}
      <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
        {thread ? (
          <>
            <button
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                row.isListened
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
              onClick={() => onToggleListen(thread.id)}
              title={row.isListened ? 'Bấm để tắt lắng nghe' : 'Bấm để bật lắng nghe'}
              type="button"
            >
              {row.isListened ? '● Đang lắng nghe' : '○ Bỏ qua'}
            </button>
            {config && <ConfigBadges config={config} row={row} />}
          </>
        ) : (
          <span className="text-slate-300 dark:text-slate-600" title="Không có cuộc trò chuyện ZCA">
            —
          </span>
        )}
      </td>

      {/* Quyền tương tác */}
      <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
        {row.access === 'n/a' ? (
          <span
            className="text-slate-300 dark:text-slate-600"
            title="Quyền được cấp cho từng người, không cấp cho nhóm"
          >
            —
          </span>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ACCESS_BADGE[row.access].className}`}
            >
              {ACCESS_BADGE[row.access].label}
            </span>
            <button
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition active:scale-95 ${
                isGranted
                  ? 'border border-slate-200 bg-white text-slate-600 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
              }`}
              onClick={() => onToggleAccess(row)}
              type="button"
            >
              {isGranted ? 'Thu hồi' : 'Cấp quyền ✓'}
            </button>
          </div>
        )}
      </td>

      {/* Thao tác */}
      <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {thread?.type === 'group' && (
            <button
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
              onClick={() => onSyncMedia(thread)}
              title="Quét và sao lưu media lịch sử của nhóm lên Google Drive & Google Photos"
              type="button"
            >
              <span>⏳</span>
              <span>Sao lưu</span>
            </button>
          )}
          {thread && (
            <a
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
              href={getThreadDriveLink(thread, config)}
              onClick={onDriveOpened}
              rel="noopener noreferrer"
              target="_blank"
              title={`Mở thư mục Google Drive (${config?.driveFolderPath || config?.mediaBackup.customFolder || `zalobot/${thread.id}`})`}
            >
              <GoogleDriveIcon className="size-3.5 shrink-0" />
              <span>Drive</span>
            </a>
          )}
          {thread && (
            <button
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => onConfigure(thread)}
              title="Cấu hình tính năng bot cho nhóm hoặc cá nhân này"
              type="button"
            >
              ⚙️ Cấu hình
            </button>
          )}
          <ChatRowMenu items={menuItems} label="Thao tác người dùng" />
        </div>
      </td>
    </tr>
  );
}

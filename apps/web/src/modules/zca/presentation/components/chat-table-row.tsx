'use client';

import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { APP_ROUTES, type ChannelStorageLinkKind, type ThreadBotConfig } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import type { ZcaThread } from '../../api/zca-api';
import { hasInteractionAccess, type ChatRow } from '../../model/chat-rows';
import { ChatRowMenu, type ChatRowMenuItem } from './chat-row-menu';
import { CopyIcon } from './zca-icons';
import { ThreadStorageLinksDialog } from './thread-storage-links-dialog';

interface ChatTableRowProps {
  row: ChatRow;
  config?: ThreadBotConfig;
  isCopied: boolean;
  onCopyId: (id: string) => void;
  onToggleListen: (threadId: string) => void;
  onToggleAccess: (row: ChatRow) => void;
  onSyncMedia: (thread: ZcaThread) => void;
  onDriveOpened: () => void;
  onEditUser: (row: ChatRow) => void;
  onMergeUser: (row: ChatRow) => void;
  onViewLinkedContacts: (row: ChatRow) => void;
  onDeleteUser: (row: ChatRow) => void;
}

interface InlineItem {
  key: string;
  node: ReactNode;
}

const KIND_LABEL: Record<ChatRow['kind'], { label: string; title?: string }> = {
  group: { label: 'Nhóm' },
  personal: { label: 'Cá nhân' },
  'user-only': {
    label: 'Người dùng',
    title: 'Có trong hệ thống nhưng không có trong danh bạ ZCA (ID webhook hoặc chưa kết bạn)',
  },
};

// Plain text + status dot instead of pills: colour only carries the state.
const ACCESS_STATUS: Record<
  Exclude<ChatRow['access'], 'n/a'>,
  { label: string; dot: string; className: string }
> = {
  admin: { label: 'Admin', dot: '●', className: 'text-purple-700 dark:text-purple-300' },
  granted: { label: 'Đã cấp', dot: '●', className: 'text-emerald-700 dark:text-emerald-400' },
  pending: { label: 'Chờ duyệt', dot: '●', className: 'text-amber-700 dark:text-amber-400' },
  none: { label: 'Chưa cấp', dot: '○', className: 'text-slate-500 dark:text-slate-400' },
};

const CELL_BUTTON =
  'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[2px] border px-1.5 text-[11px] whitespace-nowrap transition-colors';
const NEUTRAL_BUTTON = `${CELL_BUTTON} border-slate-200 bg-white font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800`;
const POSITIVE_BUTTON = `${CELL_BUTTON} border-emerald-600 bg-emerald-50 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60`;

const EMPTY_CELL = <span className="text-slate-300 dark:text-slate-600">—</span>;

/** Renders items on one line separated by a middle dot. */
function InlineList({ items }: { items: InlineItem[] }) {
  return items.map((item, index) => (
    <Fragment key={item.key}>
      {index > 0 && <span className="px-1 text-slate-300 dark:text-slate-600">·</span>}
      {item.node}
    </Fragment>
  ));
}

function RowAvatar({ row }: { row: ChatRow }) {
  const [imgError, setImgError] = useState(false);

  if (row.avatar && !imgError) {
    return (
      <img
        alt={row.name || 'Avatar'}
        className="size-8 shrink-0 rounded-[3px] object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={row.avatar}
      />
    );
  }

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {row.name ? row.name.charAt(0).toUpperCase() : '?'}
    </div>
  );
}

function featureItems(row: ChatRow, config: ThreadBotConfig): InlineItem[] {
  const items: InlineItem[] = [];
  if (config.directInteraction?.enabled) {
    const prefixes = config.directInteraction.triggerPrefixes ?? [];
    items.push(
      row.kind === 'group'
        ? {
            key: 'bot',
            node: (
              <span
                title={`Cần @Bot${prefixes.length > 0 ? ` hoặc tiền tố ${prefixes.join(' ')}` : ''} để kích hoạt`}
              >
                @Bot
              </span>
            ),
          }
        : {
            key: 'bot',
            node: <span title="Chat riêng: mọi tin nhắn chữ đều gửi tới bot">Chat riêng</span>,
          },
    );
  }
  if (config.chatMemory?.enabled) {
    items.push({
      key: 'memory',
      node: (
        <span title="Trí nhớ hội thoại đang bật: bot lưu tin nhắn của kênh để tra lại chuyện cũ">
          Nhớ
        </span>
      ),
    });
  }
  if (config.mediaBackup.enabled) {
    items.push({
      key: 'media',
      node: <span title="Tự sao lưu media của kênh lên Google Drive & Photos">Sao lưu media</span>,
    });
  }
  return items;
}

export function ChatTableRow({
  row,
  config,
  isCopied,
  onCopyId,
  onToggleListen,
  onToggleAccess,
  onSyncMedia,
  onDriveOpened,
  onEditUser,
  onMergeUser,
  onViewLinkedContacts,
  onDeleteUser,
}: ChatTableRowProps) {
  const { t } = useLocale();
  const { thread } = row;
  const [storageLinksKind, setStorageLinksKind] = useState<ChannelStorageLinkKind | null>(null);
  const openStorageLinks = (kind: ChannelStorageLinkKind) => {
    setStorageLinksKind(kind);
    onDriveOpened();
  };
  const linkedContactCount = row.user?.linkedContactCount ?? 0;
  const kindLabel = KIND_LABEL[row.kind];
  const isGranted = hasInteractionAccess(row.access);
  const features = thread && config ? featureItems(row, config) : [];

  const identityItems: InlineItem[] = [];
  if (row.kind === 'group') {
    identityItems.push({
      key: 'members',
      node:
        typeof thread?.totalMembers === 'number'
          ? `${thread.totalMembers.toLocaleString()} thành viên`
          : 'Nhóm chat',
    });
  } else {
    if (row.zaloName && row.zaloName !== row.name) {
      identityItems.push({ key: 'zalo', node: `Zalo: ${row.zaloName}` });
    }
    if (row.phoneNumber) {
      identityItems.push({
        key: 'phone',
        node: <span className="font-mono">{row.phoneNumber}</span>,
      });
    }
    if (row.user?.username) {
      identityItems.push({ key: 'username', node: `@${row.user.username}` });
    }
  }
  if (linkedContactCount > 0) {
    identityItems.push({
      key: 'linked',
      node: (
        <button
          className="text-sky-700 hover:underline dark:text-sky-400"
          onClick={() => onViewLinkedContacts(row)}
          title={t('users.linkedContacts.action')}
          type="button"
        >
          {t('users.linkedContacts.badge', { count: linkedContactCount })}
        </button>
      ),
    });
  }

  const threadMenuItems: ChatRowMenuItem[] = thread
    ? [
        {
          key: 'drive',
          label: `📁 ${t('zca.storageLinks.openDrive')}`,
          onSelect: () => openStorageLinks('drive'),
        },
        {
          key: 'photos',
          label: `📸 ${t('zca.storageLinks.openPhotos')}`,
          onSelect: () => openStorageLinks('photos'),
        },
        ...(thread.type === 'group'
          ? [
              {
                key: 'sync',
                label: '⏳ Sao lưu media lịch sử',
                onSelect: () => onSyncMedia(thread),
              },
            ]
          : []),
      ]
    : [];

  const userMenuItems: ChatRowMenuItem[] =
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
      <td
        className="whitespace-nowrap px-3.5 py-2 text-[11px] text-slate-600 dark:text-slate-400"
        title={kindLabel.title}
      >
        {kindLabel.label}
      </td>

      {/* Tên, avatar, thông tin nhận diện */}
      <td className="px-3.5 py-2">
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
          <div className="min-w-0">
            <div className="max-w-[360px] truncate whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {row.name || 'Không có tên'}
              </span>
              {row.alias && (
                <span
                  className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                  title={`Gợi nhớ: ${row.alias}`}
                >
                  ({row.alias})
                </span>
              )}
            </div>
            {identityItems.length > 0 && (
              <div className="mt-0.5 max-w-[360px] truncate whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                <InlineList items={identityItems} />
              </div>
            )}
          </div>
        </div>
      </td>

      {/* ID */}
      <td className="whitespace-nowrap px-3.5 py-2 font-mono text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="max-w-[140px] truncate" title={row.id}>
            {row.id}
          </span>
          <button
            className="rounded-[2px] p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
      <td className="whitespace-nowrap px-3.5 py-2">
        {thread ? (
          <button
            className={row.isListened ? POSITIVE_BUTTON : NEUTRAL_BUTTON}
            onClick={() => onToggleListen(thread.id)}
            title={row.isListened ? 'Bấm để tắt lắng nghe' : 'Bấm để bật lắng nghe'}
            type="button"
          >
            {row.isListened ? '● Đang nghe' : '○ Bỏ qua'}
          </button>
        ) : (
          <span title="Không có cuộc trò chuyện ZCA">{EMPTY_CELL}</span>
        )}
      </td>

      {/* Tính năng */}
      <td className="whitespace-nowrap px-3.5 py-2 text-[11px] text-slate-600 dark:text-slate-400">
        {features.length > 0 ? <InlineList items={features} /> : EMPTY_CELL}
      </td>

      {/* Quyền tương tác */}
      <td className="whitespace-nowrap px-3.5 py-2">
        {row.access === 'n/a' ? (
          <span title="Quyền được cấp cho từng người, không cấp cho nhóm">{EMPTY_CELL}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={`w-[72px] shrink-0 text-[11px] font-medium ${ACCESS_STATUS[row.access].className}`}
            >
              {ACCESS_STATUS[row.access].dot} {ACCESS_STATUS[row.access].label}
            </span>
            <button
              className={
                isGranted
                  ? `${NEUTRAL_BUTTON} hover:text-rose-600 dark:hover:text-rose-400`
                  : POSITIVE_BUTTON
              }
              onClick={() => onToggleAccess(row)}
              type="button"
            >
              {isGranted ? 'Thu hồi' : 'Cấp quyền'}
            </button>
          </div>
        )}
      </td>

      {/* Thao tác */}
      <td className="whitespace-nowrap px-3.5 py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {thread && (
            <Link
              className={NEUTRAL_BUTTON}
              href={APP_ROUTES.zcaThread(thread.id)}
              title="Cấu hình tính năng bot cho nhóm hoặc cá nhân này"
            >
              Cấu hình
            </Link>
          )}
          <ChatRowMenu items={[...threadMenuItems, ...userMenuItems]} label="Thao tác khác" />
        </div>
        {thread && storageLinksKind && (
          <ThreadStorageLinksDialog
            kind={storageLinksKind}
            onClose={() => setStorageLinksKind(null)}
            threadId={thread.id}
            threadName={thread.name}
          />
        )}
      </td>
    </tr>
  );
}

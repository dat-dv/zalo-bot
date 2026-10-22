'use client';

import { Fragment, useState, type ReactNode } from 'react';
import type { ChannelStorageLinkKind, ThreadBotConfig } from '@zalobot/contracts';
import { useOpenContactProfile } from '@/modules/contacts/view/use-open-contact-profile';
import { useLocale } from '@/shared/providers/locale-provider';
import type { ZcaThread } from '../../api/zca-api';
import { hasInteractionAccess, type ChatRow } from '../../model/chat-rows';
import type { ChatRowMenuItem } from './chat-row-menu';

/** Row data plus every handler a chat row (desktop table row or compact list row) can trigger. */
export interface ChatRowProps {
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
  onDeleteThread: (row: ChatRow) => void;
}

export interface InlineItem {
  key: string;
  node: ReactNode;
}

export const KIND_LABEL: Record<ChatRow['kind'], { label: string; title?: string }> = {
  group: { label: 'Nhóm' },
  personal: { label: 'Cá nhân' },
  'user-only': {
    label: 'Người dùng',
    title:
      'Có trong hệ thống nhưng không có trong danh bạ ZCA (ID cũ từ Zalo Bot chính thức, dashboard-owner hoặc chưa kết bạn)',
  },
};

// Plain text + status dot instead of pills: colour only carries the state.
export const ACCESS_STATUS: Record<
  Exclude<ChatRow['access'], 'n/a'>,
  { label: string; dot: string; className: string }
> = {
  admin: { label: 'Admin', dot: '●', className: 'text-purple-700 dark:text-purple-300' },
  granted: { label: 'Đã cấp', dot: '●', className: 'text-emerald-700 dark:text-emerald-400' },
  pending: { label: 'Chờ duyệt', dot: '●', className: 'text-amber-700 dark:text-amber-400' },
  none: { label: 'Chưa cấp', dot: '○', className: 'text-slate-500 dark:text-slate-400' },
};

export const LISTEN_LABEL = { on: '● Đang nghe', off: '○ Bỏ qua' } as const;
export const ACCESS_ACTION_LABEL = { revoke: 'Thu hồi', grant: 'Cấp quyền' } as const;
export const CONFIGURE_LABEL = 'Cấu hình';
export const CONFIGURE_TITLE = 'Cấu hình tính năng bot cho nhóm hoặc cá nhân này';
export const COPY_ID_LABEL = 'Sao chép ID';
export const COPIED_LABEL = 'Đã chép';

const CELL_BUTTON =
  'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[2px] border px-1.5 text-[11px] whitespace-nowrap transition-colors';
/** Same buttons at 40px for the compact row sheet. */
export const SHEET_BUTTON =
  'inline-flex h-10 min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[2px] border px-3 text-[12.5px] whitespace-nowrap transition-colors';
export const NEUTRAL_TONE =
  'border-slate-200 bg-white font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800';
export const POSITIVE_TONE =
  'border-emerald-600 bg-emerald-50 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60';
export const NEUTRAL_BUTTON = `${CELL_BUTTON} ${NEUTRAL_TONE}`;
export const POSITIVE_BUTTON = `${CELL_BUTTON} ${POSITIVE_TONE}`;

export function memberCountLabel(thread: ZcaThread | undefined): string {
  return typeof thread?.totalMembers === 'number'
    ? `${thread.totalMembers.toLocaleString()} thành viên`
    : 'Nhóm chat';
}

export const EMPTY_CELL = <span className="text-slate-300 dark:text-slate-600">—</span>;

/** Renders items on one line separated by a middle dot. */
export function InlineList({ items }: { items: InlineItem[] }) {
  return items.map((item, index) => (
    <Fragment key={item.key}>
      {index > 0 && <span className="px-1 text-slate-300 dark:text-slate-600">·</span>}
      {item.node}
    </Fragment>
  ));
}

export function RowAvatar({ row }: { row: ChatRow }) {
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
  if (config.chatMemory?.shortTermEnabled) {
    items.push({
      key: 'short-term-memory',
      node: (
        <span title="Trí nhớ ngắn hạn đang bật: bot nhớ vài tin gần nhất để hiểu câu nối tiếp">
          Ngữ cảnh
        </span>
      ),
    });
  }
  if (config.chatMemory?.enabled) {
    items.push({
      key: 'memory',
      node: (
        <span title="Trí nhớ dài hạn đang bật: bot lưu tin nhắn của kênh để tra lại chuyện cũ">
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

/**
 * Everything a chat row shows or does, shared by the desktop table row and the compact list
 * row so both expose the same actions through the same handlers.
 */
export function useChatRowModel({
  row,
  config,
  onSyncMedia,
  onDriveOpened,
  onEditUser,
  onMergeUser,
  onViewLinkedContacts,
  onDeleteUser,
  onDeleteThread,
}: ChatRowProps) {
  const { t } = useLocale();
  const openProfile = useOpenContactProfile();
  const { thread } = row;
  const [storageLinksKind, setStorageLinksKind] = useState<ChannelStorageLinkKind | null>(null);
  const openStorageLinks = (kind: ChannelStorageLinkKind) => {
    setStorageLinksKind(kind);
    onDriveOpened();
  };
  const linkedContactCount = row.user?.linkedContactCount ?? 0;
  const isGranted = hasInteractionAccess(row.access);
  const features = thread && config ? featureItems(row, config) : [];

  const identityItems: InlineItem[] = [];
  if (row.kind === 'group') {
    identityItems.push({ key: 'members', node: memberCountLabel(thread) });
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
        // Only placeholder rows: a chat still in Zalo would reappear with a default config.
        ...(thread.missingFromZalo
          ? [
              {
                key: 'delete-thread',
                label: t('zca.threadConfig.delete'),
                tone: 'danger' as const,
                onSelect: () => onDeleteThread(row),
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
                {
                  key: 'profile',
                  label: t(linkedContactCount > 0 ? 'zca.profile.view' : 'zca.profile.create'),
                  onSelect: () =>
                    void openProfile({
                      id: row.id,
                      name: row.name,
                      phoneNumber: row.phoneNumber,
                      linkedContactCount,
                    }),
                },
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

  return {
    kindLabel: KIND_LABEL[row.kind],
    isGranted,
    features,
    identityItems,
    menuItems: [...threadMenuItems, ...userMenuItems],
    storageLinksKind,
    closeStorageLinks: () => setStorageLinksKind(null),
  };
}

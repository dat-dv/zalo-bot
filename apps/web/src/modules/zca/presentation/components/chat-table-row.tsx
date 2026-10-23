'use client';

import Link from 'next/link';
import { APP_ROUTES } from '@zalobot/contracts';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ChatRowMenu } from './chat-row-menu';
import {
  ACCESS_ACTION_LABEL,
  ACCESS_STATUS,
  CONFIGURE_LABEL,
  CONFIGURE_TITLE,
  COPIED_LABEL,
  COPY_ID_LABEL,
  EMPTY_CELL,
  InlineList,
  LISTEN_LABEL,
  NEUTRAL_BUTTON,
  POSITIVE_BUTTON,
  REVOKE_BUTTON,
  RowAvatar,
  useChatRowModel,
  type ChatRowProps,
} from './chat-row-parts';
import { CopyIcon } from './zca-icons';
import { ThreadStorageLinksDialog } from './thread-storage-links-dialog';

/** Desktop (> 960px) table row; compact screens render `ChatListRow` instead. */
export function ChatTableRow(props: ChatRowProps) {
  const { row, isCopied, onCopyId, onToggleListen, onToggleAccess } = props;
  const { thread } = row;
  const {
    kindLabel,
    isGranted,
    features,
    identityItems,
    menuItems,
    storageLinksKind,
    closeStorageLinks,
  } = useChatRowModel(props);

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
            className={`rounded-[2px] p-0.5 ${BUTTON_TONE.ghost}`}
            onClick={() => onCopyId(row.id)}
            title={COPY_ID_LABEL}
            type="button"
          >
            {isCopied ? (
              <span className="font-sans text-[10px] text-emerald-600">{COPIED_LABEL}</span>
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
            {row.isListened ? LISTEN_LABEL.on : LISTEN_LABEL.off}
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
              className={isGranted ? REVOKE_BUTTON : POSITIVE_BUTTON}
              onClick={() => onToggleAccess(row)}
              type="button"
            >
              {isGranted ? ACCESS_ACTION_LABEL.revoke : ACCESS_ACTION_LABEL.grant}
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
              title={CONFIGURE_TITLE}
            >
              {CONFIGURE_LABEL}
            </Link>
          )}
          <ChatRowMenu items={menuItems} label="Thao tác khác" />
        </div>
        {thread && storageLinksKind && (
          <ThreadStorageLinksDialog
            kind={storageLinksKind}
            onClose={closeStorageLinks}
            threadId={thread.id}
            threadName={thread.name}
          />
        )}
      </td>
    </tr>
  );
}

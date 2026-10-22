'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { APP_ROUTES } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
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
  memberCountLabel,
  NEUTRAL_TONE,
  POSITIVE_TONE,
  RowAvatar,
  SHEET_BUTTON,
  useChatRowModel,
  type ChatRowProps,
} from './chat-row-parts';
import { CopyIcon } from './zca-icons';
import { ThreadStorageLinksDialog } from './thread-storage-links-dialog';

const DETAIL_LABEL =
  'text-[10.5px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400';

/**
 * Compact (<= 960px) chat row: a flat two-line row instead of the 7-column table. Tapping it
 * opens a sheet with the row's details and every action of the desktop row (cell buttons and
 * the "⋯" menu, whose floating popover is not used on touch screens).
 */
export function ChatListRow(props: ChatRowProps) {
  const { t } = useLocale();
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const titleId = useId();

  const shortId = row.id.length > 10 ? `…${row.id.slice(-6)}` : row.id;
  const keyFlag =
    row.access !== 'n/a' ? (
      <span className={ACCESS_STATUS[row.access].className}>{ACCESS_STATUS[row.access].label}</span>
    ) : row.kind === 'group' ? (
      memberCountLabel(thread)
    ) : null;

  return (
    <li className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <button
        className="flex min-h-[52px] w-full cursor-pointer flex-col justify-center gap-0.5 border-0 !bg-transparent px-3 py-2.5 text-left transition-colors hover:!bg-slate-50 dark:hover:!bg-slate-800/60"
        onClick={() => setIsSheetOpen(true)}
        type="button"
      >
        <span className="flex w-full min-w-0 items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
            {row.name || 'Không có tên'}
            {row.alias && (
              <span className="ml-1 text-[11.5px] font-normal text-slate-500 dark:text-slate-400">
                ({row.alias})
              </span>
            )}
          </span>
          {thread && (
            <span
              className={`shrink-0 text-[12px] font-medium ${
                row.isListened
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {row.isListened ? LISTEN_LABEL.on : LISTEN_LABEL.off}
            </span>
          )}
        </span>
        <span className="block w-full truncate text-[11.5px] text-slate-500 dark:text-slate-400">
          {kindLabel.label}
          <span aria-hidden="true"> · </span>
          <span className="font-mono">{shortId}</span>
          {keyFlag && (
            <>
              <span aria-hidden="true"> · </span>
              {keyFlag}
            </>
          )}
        </span>
      </button>

      <Modal
        open={isSheetOpen}
        onDismiss={() => setIsSheetOpen(false)}
        dismissOnBackdrop
        labelledBy={titleId}
        panelClassName="max-w-lg rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <header
          className={`${MODAL_STICKY_HEADER} flex items-center gap-2.5 border-b border-slate-200 bg-white py-1.5 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900`}
        >
          <RowAvatar row={row} />
          <div className="min-w-0 flex-1">
            <h2
              className="m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
              id={titleId}
            >
              {row.name || 'Không có tên'}
              {row.alias && (
                <span className="ml-1.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  ({row.alias})
                </span>
              )}
            </h2>
            {identityItems.length > 0 && (
              <p className="m-0 truncate text-[11px] text-slate-500 dark:text-slate-400">
                <InlineList items={identityItems} />
              </p>
            )}
          </div>
          <button
            aria-label={t('common.close')}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 !bg-transparent text-lg text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:!bg-slate-800 dark:hover:text-slate-100"
            onClick={() => setIsSheetOpen(false)}
            type="button"
          >
            ✕
          </button>
        </header>

        <dl className="m-0 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 px-3 py-1 text-xs">
          <div className="col-span-2 grid grid-cols-subgrid items-center border-b border-slate-100 py-2 dark:border-slate-800">
            <dt className={DETAIL_LABEL}>{t('zca.chatList.type')}</dt>
            <dd className="m-0 text-slate-800 dark:text-slate-200" title={kindLabel.title}>
              {kindLabel.label}
            </dd>
          </div>
          <div className="col-span-2 grid grid-cols-subgrid items-center border-b border-slate-100 py-1 dark:border-slate-800">
            <dt className={DETAIL_LABEL}>{t('table.id')}</dt>
            <dd className="m-0 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              <span className="min-w-0 truncate" title={row.id}>
                {row.id}
              </span>
              <button
                aria-label={COPY_ID_LABEL}
                className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[2px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => onCopyId(row.id)}
                title={COPY_ID_LABEL}
                type="button"
              >
                {isCopied ? (
                  <span className="font-sans text-[10.5px] text-emerald-600">{COPIED_LABEL}</span>
                ) : (
                  <CopyIcon />
                )}
              </button>
            </dd>
          </div>
          <div className="col-span-2 grid grid-cols-subgrid items-center border-b border-slate-100 py-1.5 dark:border-slate-800">
            <dt className={DETAIL_LABEL}>{t('zca.chatList.listen')}</dt>
            <dd className="m-0">
              {thread ? (
                <button
                  className={`${SHEET_BUTTON} ${row.isListened ? POSITIVE_TONE : NEUTRAL_TONE}`}
                  onClick={() => onToggleListen(thread.id)}
                  type="button"
                >
                  {row.isListened ? LISTEN_LABEL.on : LISTEN_LABEL.off}
                </button>
              ) : (
                EMPTY_CELL
              )}
            </dd>
          </div>
          <div className="col-span-2 grid grid-cols-subgrid items-center border-b border-slate-100 py-2 dark:border-slate-800">
            <dt className={DETAIL_LABEL}>{t('zca.chatList.features')}</dt>
            <dd className="m-0 text-[11.5px] text-slate-700 dark:text-slate-300">
              {features.length > 0 ? <InlineList items={features} /> : EMPTY_CELL}
            </dd>
          </div>
          <div className="col-span-2 grid grid-cols-subgrid items-center py-1.5">
            <dt className={DETAIL_LABEL}>{t('zca.chatList.access')}</dt>
            <dd className="m-0">
              {row.access === 'n/a' ? (
                EMPTY_CELL
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 text-[11.5px] font-medium ${ACCESS_STATUS[row.access].className}`}
                  >
                    {ACCESS_STATUS[row.access].dot} {ACCESS_STATUS[row.access].label}
                  </span>
                  <button
                    className={`${SHEET_BUTTON} ${
                      isGranted
                        ? `${NEUTRAL_TONE} hover:text-rose-600 dark:hover:text-rose-400`
                        : POSITIVE_TONE
                    }`}
                    onClick={() => onToggleAccess(row)}
                    type="button"
                  >
                    {isGranted ? ACCESS_ACTION_LABEL.revoke : ACCESS_ACTION_LABEL.grant}
                  </button>
                </div>
              )}
            </dd>
          </div>
        </dl>

        {menuItems.length > 0 && (
          <ul
            aria-label={t('zca.chatList.actions')}
            className="m-0 list-none border-t border-slate-200 p-0 dark:border-slate-800"
          >
            {menuItems.map((item) => (
              <li
                className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                key={item.key}
              >
                <button
                  className={`flex min-h-10 w-full cursor-pointer items-center px-3 text-left text-[12.5px] font-medium ${
                    item.tone === 'danger'
                      ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={item.onSelect}
                  type="button"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {thread && (
          <footer
            className={`${MODAL_STICKY_FOOTER} flex border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900`}
          >
            <Link
              className={`${SHEET_BUTTON} flex-1 ${NEUTRAL_TONE}`}
              href={APP_ROUTES.zcaThread(thread.id)}
              title={CONFIGURE_TITLE}
            >
              {CONFIGURE_LABEL}
            </Link>
          </footer>
        )}
      </Modal>

      {thread && storageLinksKind && (
        <ThreadStorageLinksDialog
          kind={storageLinksKind}
          onClose={closeStorageLinks}
          threadId={thread.id}
          threadName={thread.name}
        />
      )}
    </li>
  );
}

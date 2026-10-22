'use client';

import {
  localeTag,
  type ChannelStorageLink,
  type ChannelStorageLinkKind,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { useThreadStorageLinksQuery } from '../../api/zca-query';

interface ThreadStorageLinksDialogProps {
  threadId: string;
  threadName?: string;
  kind: ChannelStorageLinkKind;
  onClose: () => void;
}

const SKELETON_ROWS = 2;

/**
 * Every Drive root folder / Photos album the channel's media went to, one row per Google
 * account (or custom folder / album name), so media stored before an account change stays
 * reachable. A Drive link opens the channel root, which holds `bill`, `image`, `video`.
 */
export function ThreadStorageLinksDialog({
  threadId,
  threadName,
  kind,
  onClose,
}: ThreadStorageLinksDialogProps) {
  const { t } = useLocale();
  const query = useThreadStorageLinksQuery(threadId, true);
  const links = query.data ? query.data[kind] : [];
  const titleId = `storage-links-${kind}-${threadId}`;

  return (
    <Modal
      open
      onDismiss={onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      panelClassName="max-w-lg rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100" id={titleId}>
            {kind === 'drive' ? '📁 ' : '📸 '}
            {t(kind === 'drive' ? 'zca.storageLinks.driveTitle' : 'zca.storageLinks.photosTitle')}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t('zca.storageLinks.description', { name: threadName || threadId })}
          </p>
        </div>
        <button
          aria-label={t('zca.storageLinks.close')}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="p-4">
        {query.isPending ? (
          <ul aria-busy="true" aria-label={t('zca.storageLinks.loading')} className="space-y-2">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                className="h-[68px] animate-pulse rounded border border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
                key={index}
              />
            ))}
          </ul>
        ) : query.isError ? (
          <div className="flex flex-col items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <p>{t('zca.storageLinks.error')}</p>
            <button
              className="rounded border border-red-300 px-2 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
              onClick={() => void query.refetch()}
              type="button"
            >
              {t('zca.storageLinks.retry')}
            </button>
          </div>
        ) : links.length === 0 ? (
          <p className="rounded border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('zca.storageLinks.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <StorageLinkRow key={link.url} link={link} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function StorageLinkRow({ link }: { link: ChannelStorageLink }) {
  const { t, locale } = useLocale();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <li>
      <a
        className={`block rounded border p-3 transition-colors ${
          link.isCurrent
            ? 'border-blue-300 bg-blue-50/60 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/50'
            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
        }`}
        href={link.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {link.label || link.url} ↗
          </span>
          {link.isCurrent && (
            <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t('zca.storageLinks.current')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
          {link.googleEmail ?? t('zca.storageLinks.unknownAccount')}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {t('zca.storageLinks.usedRange', {
            from: formatDate(link.firstUsedAt),
            to: formatDate(link.lastUsedAt),
          })}
        </p>
      </a>
    </li>
  );
}

'use client';

import { useId, useState } from 'react';
import type { ITransactionItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { getTransactionReceiptUrl } from '../../api/transactions-api';

type Translate = ReturnType<typeof useLocale>['t'];

/** "Nhóm <tên>" / "Chat riêng" / "Dashboard", or `undefined` for rows created before tracking. */
export function describeTransactionSource(
  item: Pick<ITransactionItem, 'source' | 'sourceChatName' | 'sourceChatType'>,
  t: Translate,
): string | undefined {
  if (item.source === 'dashboard') return t('transactions.source.dashboard');
  if (item.source !== 'zalo') return undefined;
  if (item.sourceChatType === 'group') {
    return item.sourceChatName
      ? t('transactions.source.group', { name: item.sourceChatName })
      : t('transactions.source.groupUnnamed');
  }
  return t('transactions.source.directChat');
}

type ReceiptImageProps = {
  transactionId: string;
  className: string;
  alt: string;
};

/** Lazy receipt `<img>` with an inline error state (expired Google token, deleted file...). */
export function ReceiptImage({ transactionId, className, alt }: ReceiptImageProps) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="text-[10.5px] text-rose-600 dark:text-rose-400">
        {t('transactions.receipt.error')}
      </span>
    );
  }
  return (
    // Served by the API receipt proxy (not a static asset), so next/image optimisation does not apply.
    <img
      src={getTransactionReceiptUrl(transactionId)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

type ReceiptDialogProps = {
  item: ITransactionItem;
  onClose: () => void;
};

/** Full-size receipt in a dialog, with a link that opens the image in a new tab. */
function ReceiptDialog({ item, onClose }: ReceiptDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  return (
    <Modal
      open
      onDismiss={onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      panelClassName="max-w-3xl rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <header
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950`}
      >
        <h2
          id={titleId}
          className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {t('transactions.receipt.title')} · {item.note || item.category}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={getTransactionReceiptUrl(item.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('transactions.receipt.open')}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[3px] text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={t('transactions.actions.cancel')}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="flex justify-center bg-slate-100 p-3 dark:bg-slate-950">
        <ReceiptImage
          transactionId={item.id}
          alt={t('transactions.receipt.title')}
          className="max-h-[75vh] w-auto max-w-full rounded object-contain"
        />
      </div>
    </Modal>
  );
}

type ReceiptCellProps = {
  item: ITransactionItem;
  /** Inline preview of the whole receipt; off by default so the page does not load every image. */
  showPreview: boolean;
};

/** Receipt cell: a compact icon, or an uncropped preview; both open the full image in a dialog. */
export function ReceiptCell({ item, showPreview }: ReceiptCellProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  if (!item.hasReceipt) {
    return <span className="text-slate-400 select-none dark:text-slate-500">—</span>;
  }
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          showPreview
            ? 'inline-flex h-16 max-w-24 cursor-zoom-in items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 p-0.5 transition-colors hover:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500'
            : 'inline-flex size-7 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-sm transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500 dark:hover:bg-slate-800'
        }
        title={t('transactions.receipt.view')}
        aria-label={t('transactions.receipt.view')}
      >
        {showPreview ? (
          <ReceiptImage
            transactionId={item.id}
            alt={t('transactions.receipt.title')}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span aria-hidden="true">🧾</span>
        )}
      </button>
      {open && <ReceiptDialog item={item} onClose={() => setOpen(false)} />}
    </>
  );
}

type ReceiptColumnHeaderProps = {
  showPreview: boolean;
  onToggle: () => void;
};

/** Column title plus the toggle that shows or hides every receipt preview. */
export function ReceiptColumnHeader({ showPreview, onToggle }: ReceiptColumnHeaderProps) {
  const { t } = useLocale();
  const label = showPreview ? t('transactions.receipt.hideAll') : t('transactions.receipt.showAll');
  return (
    <span className="inline-flex items-center gap-1.5">
      {t('dashboard.columns.receipt')}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-pressed={showPreview}
        aria-label={label}
        title={label}
        className={`inline-flex size-5 cursor-pointer items-center justify-center rounded-[3px] border text-[11px] normal-case transition-colors ${
          showPreview
            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-300'
            : 'border-slate-300 bg-white text-slate-500 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-sky-300'
        }`}
      >
        <span aria-hidden="true">🖼</span>
      </button>
    </span>
  );
}

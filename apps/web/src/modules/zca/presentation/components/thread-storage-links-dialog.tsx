'use client';

import { useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  CHANNEL_STORAGE_LINK_HOSTS,
  CHANNEL_STORAGE_LINK_LIMITS,
  localeTag,
  validateChannelStorageLinkUpdate,
  type ChannelStorageLink,
  type ChannelStorageLinkKind,
  type ChannelStorageLinkUpdateError,
  type ChannelStorageLinkUpdateErrors,
  type UpdateChannelStorageLinkDto,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_CLOSE_TAP, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import {
  useDeleteThreadStorageLinkMutation,
  useThreadStorageLinksQuery,
  useUpdateThreadStorageLinkMutation,
} from '../../api/zca-query';

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

  if (typeof document === 'undefined') return null;

  // Portal to <body>: opened from a table cell, the dialog would otherwise inherit the cell's
  // `white-space: nowrap` / `text-align: right` (top layer does not reset inherited styles).
  return createPortal(
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
          className={`shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${MODAL_CLOSE_TAP}`}
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
              className="rounded border border-red-300 px-2 py-1 font-medium hover:bg-red-100 max-sm:min-h-10 max-sm:px-3 dark:border-red-800 dark:hover:bg-red-900/40"
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
              <StorageLinkRow key={link.id} link={link} threadId={threadId} />
            ))}
          </ul>
        )}
      </div>
    </Modal>,
    document.body,
  );
}

type Translate = ReturnType<typeof useLocale>['t'];

const INPUT_CLASS =
  'mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 max-sm:h-10';
const ACTION_BUTTON_CLASS =
  'inline-flex min-h-8 items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-10 max-sm:px-3';

function updateErrorMessage(
  t: Translate,
  kind: ChannelStorageLinkKind,
  code: ChannelStorageLinkUpdateError,
): string {
  switch (code) {
    case 'display_name_too_long':
      return t('zca.storageLinks.errors.displayNameTooLong', {
        max: CHANNEL_STORAGE_LINK_LIMITS.DISPLAY_NAME_MAX_LENGTH,
      });
    case 'url_required':
      return t('zca.storageLinks.errors.urlRequired');
    case 'url_invalid':
      return t('zca.storageLinks.errors.urlInvalid');
    case 'url_wrong_host':
      return t('zca.storageLinks.errors.urlWrongHost', {
        hosts: CHANNEL_STORAGE_LINK_HOSTS[kind].join(', '),
      });
    case 'email_invalid':
      return t('zca.storageLinks.errors.emailInvalid');
  }
}

function StorageLinkRow({ threadId, link }: { threadId: string; link: ChannelStorageLink }) {
  const { t, locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const deleteMutation = useDeleteThreadStorageLinkMutation(threadId);
  const name = link.displayName || link.label || link.url;
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium' }).format(new Date(iso));

  const handleDelete = () => {
    if (!window.confirm(t('zca.storageLinks.deleteConfirm', { name }))) return;
    deleteMutation.mutate(link.id);
  };

  const cardClass = link.isCurrent
    ? 'border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30'
    : 'border-slate-200 dark:border-slate-700';

  if (editing) {
    return (
      <li className={`rounded border p-3 ${cardClass}`}>
        <StorageLinkEditForm link={link} onDone={() => setEditing(false)} threadId={threadId} />
      </li>
    );
  }

  return (
    <li
      aria-busy={deleteMutation.isPending}
      className={`rounded border p-3 transition-opacity ${cardClass} ${
        deleteMutation.isPending ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline max-sm:-my-2 max-sm:leading-10 dark:text-slate-100 dark:hover:text-blue-400"
          href={link.url}
          rel="noopener noreferrer"
          target="_blank"
          title={link.url}
        >
          {name} ↗
        </a>
        {link.isCurrent && (
          <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {t('zca.storageLinks.current')}
          </span>
        )}
      </div>
      {link.displayName && link.label && (
        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {link.label}
        </p>
      )}
      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
        {link.googleEmail ?? t('zca.storageLinks.unknownAccount')}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        {t('zca.storageLinks.usedRange', {
          from: formatDate(link.firstUsedAt),
          to: formatDate(link.lastUsedAt),
        })}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
        <button
          className={`${ACTION_BUTTON_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
          disabled={deleteMutation.isPending}
          onClick={() => setEditing(true)}
          type="button"
        >
          ✏️ {t('zca.storageLinks.edit')}
        </button>
        <button
          className={`${ACTION_BUTTON_CLASS} border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40`}
          disabled={link.isCurrent || deleteMutation.isPending}
          onClick={handleDelete}
          title={link.isCurrent ? t('zca.storageLinks.deleteCurrentDisabled') : undefined}
          type="button"
        >
          🗑️ {t('zca.storageLinks.delete')}
        </button>
      </div>
      {deleteMutation.isError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {t('zca.storageLinks.deleteError')}
        </p>
      )}
    </li>
  );
}

/** Inline edit: same validation as the API, so most mistakes never reach the server. */
function StorageLinkEditForm({
  threadId,
  link,
  onDone,
}: {
  threadId: string;
  link: ChannelStorageLink;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const fieldId = useId();
  const mutation = useUpdateThreadStorageLinkMutation(threadId);
  const [draft, setDraft] = useState({
    displayName: link.displayName ?? '',
    url: link.url,
    googleEmail: link.googleEmail ?? '',
  });
  const [errors, setErrors] = useState<ChannelStorageLinkUpdateErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dto: UpdateChannelStorageLinkDto = {
      displayName: draft.displayName,
      googleEmail: draft.googleEmail,
      // The link in use is rewritten by uploads, so its URL is not editable.
      ...(link.isCurrent ? {} : { url: draft.url }),
    };
    const result = validateChannelStorageLinkUpdate(link.kind, dto);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate({ linkId: link.id, data: result.value }, { onSuccess: onDone });
  };

  const fields: {
    key: keyof UpdateChannelStorageLinkDto;
    label: string;
    placeholder?: string;
    hint?: string;
    type: 'text' | 'url' | 'email';
    disabled?: boolean;
  }[] = [
    {
      key: 'displayName',
      label: t('zca.storageLinks.displayNameLabel'),
      placeholder: t('zca.storageLinks.displayNamePlaceholder', { label: link.label || link.url }),
      type: 'text',
    },
    {
      key: 'url',
      label: t('zca.storageLinks.urlLabel'),
      hint: link.isCurrent ? t('zca.storageLinks.urlLockedHint') : undefined,
      type: 'url',
      disabled: link.isCurrent,
    },
    {
      key: 'googleEmail',
      label: t('zca.storageLinks.emailLabel'),
      placeholder: t('zca.storageLinks.emailPlaceholder'),
      type: 'email',
    },
  ];

  return (
    <form className="space-y-2.5" noValidate onSubmit={handleSubmit}>
      {fields.map((field) => {
        const inputId = `${fieldId}-${field.key}`;
        const error = errors[field.key];
        const describedBy = error ? `${inputId}-error` : field.hint ? `${inputId}-hint` : undefined;
        return (
          <div key={field.key}>
            <label
              className="text-[11px] font-medium text-slate-600 dark:text-slate-400"
              htmlFor={inputId}
            >
              {field.label}
            </label>
            <input
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              className={INPUT_CLASS}
              disabled={field.disabled || mutation.isPending}
              id={inputId}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              placeholder={field.placeholder}
              type={field.type}
              value={draft[field.key]}
            />
            {error ? (
              <p
                className="mt-0.5 text-[11px] text-red-600 dark:text-red-400"
                id={`${inputId}-error`}
              >
                {updateErrorMessage(t, link.kind, error)}
              </p>
            ) : field.hint ? (
              <p
                className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400"
                id={`${inputId}-hint`}
              >
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}
      {mutation.isError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {t('zca.storageLinks.saveError')}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
        <button
          className={`${ACTION_BUTTON_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
          disabled={mutation.isPending}
          onClick={onDone}
          type="button"
        >
          {t('zca.storageLinks.cancel')}
        </button>
        <button
          className={`${ACTION_BUTTON_CLASS} border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500`}
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? t('zca.storageLinks.saving') : t('zca.storageLinks.save')}
        </button>
      </div>
    </form>
  );
}

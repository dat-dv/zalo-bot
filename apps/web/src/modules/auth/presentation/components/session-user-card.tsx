'use client';

import { useEffect, useState } from 'react';
import type { IDashboardSessionUser } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

interface SessionUserCardProps {
  user: IDashboardSessionUser | undefined;
  isLoading: boolean;
  /** `sheet`: the compact-screen "More" sheet, with 40px tap targets. */
  variant: 'sidebar' | 'sheet';
}

/** Which Zalo account the dashboard session belongs to, and whether it is an admin. */
export function SessionUserCard({ user, isLoading, variant }: SessionUserCardProps) {
  const { t } = useLocale();
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const isSheet = variant === 'sheet';

  if (isLoading) {
    return (
      <div aria-hidden="true" className="flex items-center gap-2 px-1.5 py-1">
        <span className="size-7 shrink-0 animate-pulse rounded-[3px] bg-slate-200 dark:bg-slate-800" />
        <span className="h-3 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }
  // An error or a signed-out page shows nothing: the card is informative, never blocking.
  if (!user) return null;

  const displayName = user.name ?? (user.isDashboardOwner ? t('session.owner') : null);
  const copyLabel = t('session.copyId', { id: user.id });

  const copyId = () => {
    void navigator.clipboard?.writeText(user.id).then(() => setIsCopied(true));
  };

  return (
    <section
      aria-label={t('session.title')}
      className={`flex min-w-0 items-center gap-2 ${isSheet ? 'px-0.5' : 'px-1.5 py-1'}`}
    >
      <SessionAvatar name={displayName} url={user.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100 ${isSheet ? 'text-[13px]' : 'text-xs'}`}
            title={displayName ?? undefined}
          >
            {displayName ?? t('session.unknownName')}
          </span>
          <span
            className={`shrink-0 rounded px-1 py-px text-[9.5px] font-bold uppercase ${
              user.isAdmin
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {user.isAdmin ? t('session.roleAdmin') : t('session.roleUser')}
          </span>
        </div>
        <button
          aria-label={copyLabel}
          className={`flex max-w-full min-w-0 items-center bg-transparent !p-0 text-left font-mono text-[10.5px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ${isSheet ? 'min-h-10' : ''}`}
          onClick={copyId}
          title={copyLabel}
          type="button"
        >
          <span className="truncate">{isCopied ? t('session.copied') : user.id}</span>
        </button>
      </div>
    </section>
  );
}

function SessionAvatar({ name, url }: { name: string | null; url: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (url && !hasError) {
    return (
      <img
        alt=""
        className="size-7 shrink-0 rounded-[3px] object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setHasError(true)}
        referrerPolicy="no-referrer"
        src={url}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-[3px] bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      {name ? name.charAt(0).toUpperCase() : '?'}
    </span>
  );
}

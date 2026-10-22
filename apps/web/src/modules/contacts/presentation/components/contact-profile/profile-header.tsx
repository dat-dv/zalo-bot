'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APP_ROUTES, GrantAccessStatus, UserRole, type IContactProfile } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { MUTED } from './profile-styles';

function ProfileAvatar({ contact }: { contact: IContactProfile }) {
  const [imgError, setImgError] = useState(false);
  const src = contact.avatarUrl || contact.linkedUser?.avatarUrl;
  if (src && !imgError) {
    return (
      <img
        alt={contact.displayName}
        className="size-11 shrink-0 rounded-[3px] object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={src}
      />
    );
  }
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-[3px] bg-slate-100 text-base font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {contact.displayName.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

/** Identity strip: who this is and which Zalo account (if any) is linked. */
export function ProfileHeader({ contact }: { contact: IContactProfile }) {
  const { t } = useLocale();
  const user = contact.linkedUser;
  const accessLabel =
    user?.role === UserRole.ADMIN
      ? t('contacts.profile.role.admin')
      : user?.grantAccess === GrantAccessStatus.GRANTED
        ? t('contacts.profile.access.granted')
        : user?.grantAccess === GrantAccessStatus.DENIED
          ? t('contacts.profile.access.pending')
          : null;

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <Link
        className="w-fit text-[11px] font-medium text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
        href={APP_ROUTES.contacts}
      >
        ← {t('contacts.profile.back')}
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        <ProfileAvatar contact={contact} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
            {contact.displayName}
            {contact.alias && (
              <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                ({contact.alias})
              </span>
            )}
          </h1>
          {contact.descriptor && (
            <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">
              {contact.descriptor}
            </p>
          )}
          <p className="m-0 mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('contacts.profile.zaloAccount')}: </span>
            {user ? (
              <>
                <span className="text-slate-700 dark:text-slate-300">
                  {user.firstName || user.username || user.id}
                </span>
                {user.username && <span> @{user.username}</span>}
                {accessLabel && (
                  <>
                    <span className={`px-1 ${MUTED}`}>·</span>
                    <span
                      className={
                        user.role === UserRole.ADMIN
                          ? 'font-medium text-purple-700 dark:text-purple-300'
                          : user.grantAccess === GrantAccessStatus.GRANTED
                            ? 'font-medium text-emerald-700 dark:text-emerald-400'
                            : 'font-medium text-amber-700 dark:text-amber-400'
                      }
                    >
                      ● {accessLabel}
                    </span>
                  </>
                )}
                {accessLabel && (
                  <>
                    <span className={`px-1 ${MUTED}`}>·</span>
                    <Link
                      className="text-sky-700 hover:underline dark:text-sky-400"
                      href={APP_ROUTES.zca}
                    >
                      {t('contacts.profile.openZca')}
                    </Link>
                  </>
                )}
              </>
            ) : (
              <span className={MUTED}>{t('contacts.profile.noZaloAccount')}</span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

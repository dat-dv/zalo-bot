'use client';

import { APP_ROUTES } from '@zalobot/contracts';
import Link from 'next/link';
import { useLocale } from '@/shared/providers/locale-provider';

export default function TermsPage() {
  const { t } = useLocale();
  const email = t('public.supportEmail');

  return (
    <main className="mx-auto min-h-screen max-w-[860px] bg-slate-50 p-6 text-slate-900 max-[680px]:p-[18px]">
      <header className="flex items-center justify-between gap-[18px] max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-[14px]">
        <Link
          className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-900 no-underline"
          href={APP_ROUTES.about}
        >
          <span
            className="inline-flex size-7 items-center justify-center rounded-[5px] bg-slate-900 text-[11px] text-white"
            aria-hidden="true"
          >
            TB
          </span>{' '}
          {t('public.brand')}
        </Link>
        <Link className="text-blue-700 no-underline hover:underline" href={APP_ROUTES.privacy}>
          {t('public.privacy.title')}
        </Link>
      </header>
      <article className="my-[50px] mb-7 rounded-lg border border-slate-200 bg-white p-[clamp(24px,6vw,64px)] [&_h1]:mt-[14px] [&_h1]:mb-[34px] [&_h1]:text-[clamp(34px,6vw,54px)] [&_h1]:tracking-[-.05em] [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-[19px] [&_p]:text-[15px] [&_p]:leading-[1.75] [&_p]:text-slate-700">
        <p className="text-[11px] font-extrabold tracking-[.12em] text-slate-600">
          {t('public.updated')}
        </p>
        <h1>{t('public.terms.title')}</h1>
        <h2>{t('public.terms.acceptanceTitle')}</h2>
        <p>{t('public.terms.acceptanceDescription')}</p>
        <h2>{t('public.terms.scopeTitle')}</h2>
        <p>{t('public.terms.scopeDescription')}</p>
        <h2>{t('public.terms.accountTitle')}</h2>
        <p>{t('public.terms.accountDescription')}</p>
        <h2>{t('public.terms.legalTitle')}</h2>
        <p>{t('public.terms.legalDescription')}</p>
        <h2>{t('public.terms.changeTitle')}</h2>
        <p>{t('public.terms.changeDescription')}</p>
        <h2>{t('public.terms.contactTitle')}</h2>
        <p>{t('public.terms.contactDescription', { email })}</p>
      </article>
      <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-slate-200 py-[22px] text-xs text-slate-500 [&_a]:text-blue-700 [&_a]:no-underline hover:[&_a]:underline">
        <Link href={APP_ROUTES.about}>{t('public.privacy.about')}</Link>
        <Link href={APP_ROUTES.privacy}>{t('public.privacy.title')}</Link>
      </footer>
    </main>
  );
}

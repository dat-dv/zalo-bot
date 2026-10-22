'use client';

import { APP_ROUTES } from '@zalobot/contracts';
import Link from 'next/link';
import { useLocale } from '@/shared/providers/locale-provider';
import { BrandMark } from '@/shared/ui/brand-mark';

export default function PrivacyPage() {
  const { t } = useLocale();
  const email = t('public.supportEmail');

  return (
    <main className="mx-auto min-h-screen max-w-[860px] bg-slate-50 p-6 text-slate-900 max-[680px]:p-[18px]">
      <header className="flex items-center justify-between gap-[18px] max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-[14px]">
        <Link
          className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-900 no-underline"
          href={APP_ROUTES.about}
        >
          <BrandMark />
          {t('public.brand')}
        </Link>
        <Link className="text-blue-700 no-underline hover:underline" href={APP_ROUTES.terms}>
          {t('public.terms.title')}
        </Link>
      </header>
      <article className="my-[50px] mb-7 rounded-lg border border-slate-200 bg-white p-[clamp(24px,6vw,64px)] [&_a]:text-blue-700 [&_a]:no-underline hover:[&_a]:underline [&_h1]:mt-[14px] [&_h1]:mb-[34px] [&_h1]:text-[clamp(34px,6vw,54px)] [&_h1]:tracking-[-.05em] [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-[19px] [&_li]:text-[15px] [&_li]:leading-[1.75] [&_p]:text-[15px] [&_p]:leading-[1.75] [&_p]:text-slate-700 [&_ul]:pl-[22px]">
        <p className="text-[11px] font-extrabold tracking-[.12em] text-slate-600">
          {t('public.updated')}
        </p>
        <h1>{t('public.privacy.title')}</h1>
        <p>{t('public.privacy.intro')}</p>

        <h2>{t('public.privacy.dataTitle')}</h2>
        <p>{t('public.privacy.dataDescription')}</p>
        <p>{t('public.privacy.scopesIntro')}</p>
        <ul>
          <li>{t('public.privacy.profileScope')}</li>
          <li>{t('public.privacy.calendarScope')}</li>
        </ul>

        <h2>{t('public.privacy.useTitle')}</h2>
        <p>{t('public.privacy.useDescription')}</p>
        <p>
          {t('public.privacy.policyPrefix')}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            {t('public.privacy.policyLink')}
          </a>
          {t('public.privacy.policySuffix')}
        </p>

        <h2>{t('public.privacy.securityTitle')}</h2>
        <p>{t('public.privacy.securityDescription')}</p>

        <h2>{t('public.privacy.retentionTitle')}</h2>
        <p>{t('public.privacy.retentionDescription', { email })}</p>

        <h2>{t('public.privacy.contactTitle')}</h2>
        <p>{t('public.privacy.contactDescription', { email })}</p>
      </article>
      <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-slate-200 py-[22px] text-xs text-slate-500 [&_a]:text-blue-700 [&_a]:no-underline hover:[&_a]:underline">
        <Link href={APP_ROUTES.about}>{t('public.privacy.about')}</Link>
        <Link href={APP_ROUTES.terms}>{t('public.terms.title')}</Link>
      </footer>
    </main>
  );
}

'use client';

import { APP_ROUTES } from '@zalobot/contracts';
import Link from 'next/link';
import { useLocale } from '@/shared/providers/locale-provider';

export default function AboutPage() {
  const { t } = useLocale();
  const email = t('public.supportEmail');

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-50 p-6 text-slate-900 max-[680px]:p-[18px]">
      <header className="flex items-center justify-between gap-[18px] max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-[14px]">
        <Link
          className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-900 no-underline"
          href={APP_ROUTES.about}
          aria-label={t('public.brand')}
        >
          <span
            className="inline-flex size-7 items-center justify-center rounded-[5px] bg-slate-900 text-[11px] text-white"
            aria-hidden="true"
          >
            TB
          </span>{' '}
          {t('public.brand')}
        </Link>
        <nav
          className="flex flex-wrap gap-4 text-blue-700 [&_a]:no-underline hover:[&_a]:underline"
          aria-label={t('public.about.navigation')}
        >
          <Link href={APP_ROUTES.privacy}>{t('public.about.privacy')}</Link>
          <Link href={APP_ROUTES.terms}>{t('public.about.terms')}</Link>
        </nav>
      </header>

      <section className="max-w-[750px] pt-[120px] pb-[88px] max-[680px]:pt-[72px] max-[680px]:pb-[54px]">
        <p className="text-[11px] font-extrabold tracking-[.12em] text-slate-600">
          {t('public.about.eyebrow')}
        </p>
        <h1 className="my-4 mb-[22px] text-[clamp(38px,7vw,72px)] leading-[.98] tracking-[-.06em]">
          {t('public.about.title')}
        </h1>
        <p className="max-w-[640px] text-lg leading-[1.65] text-slate-600">
          {t('public.about.description')}
        </p>
        <a
          className="mt-[18px] inline-flex rounded-md bg-slate-900 px-[18px] py-[13px] font-bold text-white no-underline hover:bg-slate-800"
          href="https://t.me"
          target="_blank"
          rel="noreferrer"
        >
          {t('public.about.zalo')}
        </a>
      </section>

      <section
        className="grid grid-cols-3 gap-4 pb-[72px] max-[680px]:grid-cols-1"
        aria-label={t('public.about.features')}
      >
        <article className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-base font-bold">{t('public.about.financeTitle')}</h2>
          <p className="leading-[1.6] text-slate-600">{t('public.about.financeDescription')}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-base font-bold">{t('public.about.planningTitle')}</h2>
          <p className="leading-[1.6] text-slate-600">{t('public.about.planningDescription')}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-base font-bold">{t('public.about.googleTitle')}</h2>
          <p className="leading-[1.6] text-slate-600">{t('public.about.googleDescription')}</p>
        </article>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-slate-200 py-[22px] text-xs text-slate-500 [&_a]:text-blue-700 [&_a]:no-underline hover:[&_a]:underline">
        <span>{t('public.about.copyright', { year: new Date().getFullYear() })}</span>
        <span>{t('public.about.support', { email })}</span>
        <Link href={APP_ROUTES.privacy}>{t('public.about.privacyPolicy')}</Link>
        <Link href={APP_ROUTES.terms}>{t('public.about.termsOfService')}</Link>
      </footer>
    </main>
  );
}

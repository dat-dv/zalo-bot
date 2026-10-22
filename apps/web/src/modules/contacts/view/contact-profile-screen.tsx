'use client';

import axios from 'axios';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { APP_ROUTES } from '@zalobot/contracts';
import { apiErrorMessage } from '@/modules/users/api/api-error-message';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { MetricGrid, MetricGridSkeleton } from '@/shared/ui/metric-grid';
import { TOAST_POSITION } from '@/shared/ui/touch';
import { useContactProfileQuery, useSaveContactProfileMutation } from '../api/contacts-query';
import {
  toBaseContactUpdate,
  toContactProfileForm,
  validateContactProfileForm,
  type ContactProfileForm,
  type ContactProfileFormErrors,
} from '../model/contact-profile-form';
import { ProfileHeader } from '../presentation/components/contact-profile/profile-header';
import { ProfileInfoPanel } from '../presentation/components/contact-profile/profile-info-panel';
import {
  ProfileDebtsTable,
  ProfileTransactionsTable,
} from '../presentation/components/contact-profile/profile-tables';
import { SECONDARY_BUTTON } from '../presentation/components/contact-profile/profile-styles';

function MessageBox({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      role="alert"
    >
      <span>{children}</span>
      {action}
    </section>
  );
}

/** Profile page: one contact plus the Zalo user linked to it (`/contacts/profile?id=`). */
export function ContactProfileScreen() {
  const { t } = useLocale();
  const { money } = useMoneyVisibility();
  const id = useSearchParams().get('id');
  const profile = useContactProfileQuery(id);
  const save = useSaveContactProfileMutation(id ?? '');
  const [form, setForm] = useState<ContactProfileForm | null>(null);
  const [errors, setErrors] = useState<ContactProfileFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const backLink = (
    <Link className={SECONDARY_BUTTON} href={APP_ROUTES.contacts}>
      ← {t('contacts.profile.back')}
    </Link>
  );

  if (!id) return <MessageBox action={backLink}>{t('contacts.profile.missingId')}</MessageBox>;

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="h-[78px] animate-pulse rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <MetricGridSkeleton count={4} />
        <div className="h-64 animate-pulse rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    );
  }

  if (profile.isError) {
    const notFound = axios.isAxiosError(profile.error) && profile.error.response?.status === 404;
    return notFound ? (
      <MessageBox action={backLink}>{t('contacts.profile.notFound')}</MessageBox>
    ) : (
      <MessageBox
        action={
          <button className={SECONDARY_BUTTON} onClick={() => void profile.refetch()} type="button">
            {t('common.retry')}
          </button>
        }
      >
        {t('contacts.profile.loadError')}
      </MessageBox>
    );
  }

  const { contact, summary, debts, recentTransactions } = profile.data;

  const handleSave = async () => {
    if (!form) return;
    const result = validateContactProfileForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaveError(null);
    try {
      await save.mutateAsync({ base: toBaseContactUpdate(contact, form), profile: result.profile });
      setForm(null);
      setToast(t('contacts.profile.saved'));
      setTimeout(() => setToast(null), 3000);
    } catch (error: unknown) {
      setSaveError(`${t('contacts.profile.saveError')} (${apiErrorMessage(error)})`);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {toast && (
        <div
          aria-live="polite"
          className={`${TOAST_POSITION} rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900`}
          role="status"
        >
          {toast}
        </div>
      )}

      <ProfileHeader contact={contact} />

      <MetricGrid
        className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-2"
        items={[
          {
            label: t('contacts.profile.summary.receivable'),
            value: money(summary.receivableRemaining),
            valueClassName: 'text-emerald-700 dark:text-emerald-400',
          },
          {
            label: t('contacts.profile.summary.payable'),
            value: money(summary.payableRemaining),
            valueClassName: 'text-rose-700 dark:text-rose-400',
          },
          {
            label: t('contacts.profile.summary.income'),
            value: money(summary.incomeTotal),
            valueClassName: 'text-slate-900 dark:text-slate-100',
          },
          {
            label: t('contacts.profile.summary.expense'),
            value: money(summary.expenseTotal),
            valueClassName: 'text-slate-900 dark:text-slate-100',
          },
        ]}
      />
      <p className="m-0 -mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {t('contacts.profile.summary.openDebts', { count: summary.openDebtCount })}
        <span className="px-1 text-slate-300 dark:text-slate-600">·</span>
        {t('contacts.profile.summary.transactions', { count: summary.transactionCount })}
      </p>

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <ProfileInfoPanel
          contact={contact}
          errors={errors}
          form={form}
          isSaving={save.isPending}
          onCancel={() => {
            setForm(null);
            setErrors({});
            setSaveError(null);
          }}
          onChange={setForm}
          onEdit={() => setForm(toContactProfileForm(contact))}
          onSave={() => void handleSave()}
          saveError={saveError}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <ProfileDebtsTable debts={debts} />
          <ProfileTransactionsTable
            total={summary.transactionCount}
            transactions={recentTransactions}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  CONTACT_PROFILE_LIMITS,
  localeTag,
  type IDebtListItem,
  type ITransactionItem,
} from '@zalobot/contracts';
import { describeTransactionSource } from '@/modules/dashboard/presentation/components/transaction-receipt';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { MUTED } from './profile-styles';

function useShortDate() {
  const { locale } = useLocale();
  return (value?: string) =>
    value
      ? new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short' }).format(new Date(value))
      : '—';
}

export function ProfileDebtsTable({ debts }: { debts: IDebtListItem[] }) {
  const { t } = useLocale();
  const { money } = useMoneyVisibility();
  const date = useShortDate();

  const columns: DataTableColumn<IDebtListItem>[] = [
    {
      id: 'occurredAt',
      header: t('dashboard.columns.date'),
      minWidth: '90px',
      mobileSlot: 'secondary',
      cell: (debt) => <span className="whitespace-nowrap">{date(debt.occurredAt)}</span>,
    },
    {
      id: 'direction',
      header: t('dashboard.columns.direction'),
      minWidth: '160px',
      mobileSlot: 'primary',
      cell: (debt) => (
        <span className="block max-w-[260px] truncate whitespace-nowrap" title={debt.note}>
          <span
            className={
              debt.direction === 'receivable'
                ? 'font-medium text-emerald-700 dark:text-emerald-400'
                : 'font-medium text-rose-700 dark:text-rose-400'
            }
          >
            {t(
              debt.direction === 'receivable'
                ? 'contacts.profile.direction.receivable'
                : 'contacts.profile.direction.payable',
            )}
          </span>
          {debt.note && (
            <>
              <span className={`px-1 ${MUTED}`}>·</span>
              <span className="text-slate-500 dark:text-slate-400">{debt.note}</span>
            </>
          )}
        </span>
      ),
    },
    {
      id: 'originalAmount',
      header: t('dashboard.columns.original'),
      align: 'right',
      minWidth: '100px',
      mobileSlot: 'secondary',
      cell: (debt) => <span className="whitespace-nowrap">{money(debt.originalAmount)}</span>,
    },
    {
      id: 'remainingAmount',
      header: t('dashboard.columns.remaining'),
      align: 'right',
      minWidth: '100px',
      mobileSlot: 'trailing',
      cell: (debt) => (
        <span className="font-semibold whitespace-nowrap">{money(debt.remainingAmount)}</span>
      ),
    },
    {
      id: 'status',
      header: t('debts.columns.status'),
      minWidth: '100px',
      mobileSlot: 'secondary',
      cell: (debt) =>
        debt.status === 'settled' ? (
          <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
            ○ {t('debts.status.settled')}
          </span>
        ) : (
          <span className="font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">
            ● {t('debts.status.active')}
          </span>
        ),
    },
  ];

  return (
    <DataPanel title={t('contacts.profile.section.debts')}>
      <DataTable
        ariaLabel={t('contacts.profile.section.debts')}
        columns={columns}
        emptyMessage={t('contacts.profile.empty.debts')}
        id="contact-profile-debts"
        rows={debts}
      />
    </DataPanel>
  );
}

/**
 * `includesRecorded`: the contact has a linked Zalo user, so the API also returned the
 * transactions that user recorded (not only those linked to the contact).
 */
export function ProfileTransactionsTable({
  transactions,
  total,
  includesRecorded,
}: {
  transactions: ITransactionItem[];
  total: number;
  includesRecorded: boolean;
}) {
  const { t } = useLocale();
  const { money } = useMoneyVisibility();
  const date = useShortDate();

  const columns: DataTableColumn<ITransactionItem>[] = [
    {
      id: 'occurredAt',
      header: t('dashboard.columns.date'),
      minWidth: '90px',
      mobileSlot: 'secondary',
      cell: (item) => <span className="whitespace-nowrap">{date(item.occurredAt)}</span>,
    },
    {
      id: 'category',
      header: t('dashboard.columns.category'),
      minWidth: '130px',
      mobileSlot: 'primary',
      cell: (item) => (
        <span className="block max-w-[200px] truncate whitespace-nowrap" title={item.category}>
          <span className="text-slate-500 dark:text-slate-400">
            {t(
              item.type === 'income'
                ? 'contacts.profile.type.income'
                : 'contacts.profile.type.expense',
            )}
          </span>
          <span className={`px-1 ${MUTED}`}>·</span>
          <span>{item.category}</span>
        </span>
      ),
    },
    {
      id: 'note',
      header: t('dashboard.columns.note'),
      minWidth: '160px',
      mobileSlot: 'secondary',
      cell: (item) => (
        <span className="block max-w-[280px] truncate whitespace-nowrap" title={item.note}>
          {item.note || '—'}
        </span>
      ),
    },
    {
      id: 'createdBy',
      header: t('dashboard.columns.createdBy'),
      minWidth: '140px',
      mobileSlot: 'secondary',
      mobileCell: (item) => item.createdByName || describeTransactionSource(item, t) || null,
      cell: (item) => {
        const source = describeTransactionSource(item, t);
        if (!item.createdByName && !source) {
          return <span className={`select-none ${MUTED}`}>—</span>;
        }
        return (
          <div className="flex min-w-0 flex-col leading-tight">
            <span
              className="max-w-[180px] truncate font-medium text-slate-800 dark:text-slate-200"
              title={item.createdByName || undefined}
            >
              {item.createdByName || '—'}
            </span>
            {source && (
              <span
                className="max-w-[180px] truncate text-[10.5px] text-slate-500 dark:text-slate-400"
                title={source}
              >
                {source}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'amount',
      header: t('dashboard.columns.amount'),
      align: 'right',
      minWidth: '110px',
      mobileSlot: 'trailing',
      cell: (item) => (
        <span
          className={`font-semibold whitespace-nowrap ${
            item.type === 'income'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          {item.type === 'income' ? '+' : '-'} {money(item.amount)}
        </span>
      ),
    },
  ];

  const description = [
    includesRecorded ? t('contacts.profile.transactionsScope') : undefined,
    total > transactions.length
      ? t('contacts.profile.transactionsLimited', {
          shown: Math.min(transactions.length, CONTACT_PROFILE_LIMITS.RECENT_TRANSACTIONS),
          total,
        })
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DataPanel
      description={description || undefined}
      title={t('contacts.profile.section.transactions')}
    >
      <DataTable
        ariaLabel={t('contacts.profile.section.transactions')}
        columns={columns}
        emptyMessage={t('contacts.profile.empty.transactions')}
        id="contact-profile-transactions"
        rows={transactions}
      />
    </DataPanel>
  );
}

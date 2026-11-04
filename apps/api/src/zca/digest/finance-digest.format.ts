import type { FinanceBreakdown } from '../../finance/finance-report.service';

const money = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

const DAY_MS = 24 * 60 * 60_000;
export const DIGEST_DUE_WITHIN_MS = 7 * DAY_MS;
const MAX_DUE_ROWS = 3;

export interface DigestDebt {
  direction: 'receivable' | 'payable';
  counterparty: string;
  remainingAmount: number;
  dueAt?: Date | null;
}

function comparison(current: number, previous: number): string {
  if (previous <= 0) return '';
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return ' (bằng kỳ trước)';
  return percent > 0
    ? ` (tăng ${percent}% so với kỳ trước)`
    : ` (giảm ${-percent}% so với kỳ trước)`;
}

function debtLines(debts: readonly DigestDebt[], now: Date): string[] {
  if (debts.length === 0) return [];
  const sum = (direction: DigestDebt['direction']): number =>
    debts
      .filter((debt) => debt.direction === direction)
      .reduce((total, debt) => total + Number(debt.remainingAmount), 0);
  const lines = [
    `Công nợ: phải thu ${money(sum('receivable'))} · phải trả ${money(sum('payable'))}`,
  ];

  // Overdue debts stay listed: they need attention more than the ones coming up.
  const due = debts
    .filter((debt) => debt.dueAt && debt.dueAt.getTime() <= now.getTime() + DIGEST_DUE_WITHIN_MS)
    .sort((a, b) => Number(a.dueAt?.getTime()) - Number(b.dueAt?.getTime()));
  if (due.length > 0) {
    const shown = due
      .slice(0, MAX_DUE_ROWS)
      .map((debt) => `${debt.counterparty} ${money(Number(debt.remainingAmount))}`);
    const more = due.length > MAX_DUE_ROWS ? ` và ${due.length - MAX_DUE_ROWS} khoản khác` : '';
    lines.push(`Đến hạn trong 7 ngày tới: ${shown.join(', ')}${more}`);
  }
  return lines;
}

/** The whole digest; the numbers are the shared ledger's, the same as a chat report. */
export function formatFinanceDigest(input: {
  label: string;
  current: FinanceBreakdown;
  previous: FinanceBreakdown;
  debts: readonly DigestDebt[];
  now: Date;
}): string {
  const { label, current, previous, debts, now } = input;
  const lines = [`📅 Tóm tắt ${label}`];
  if (current.count === 0) {
    lines.push('Không có giao dịch nào.');
  } else {
    lines.push(
      `Thu ${money(current.income)} · Chi ${money(current.expense)}${comparison(current.expense, previous.expense)}`,
    );
    if (current.topCategories.length > 0) {
      const top = current.topCategories
        .slice(0, 3)
        .map((row) => `${row.category} ${money(row.amount)}`);
      lines.push(`Chi nhiều nhất: ${top.join(', ')}`);
    }
  }
  return [...lines, ...debtLines(debts, now)].join('\n');
}

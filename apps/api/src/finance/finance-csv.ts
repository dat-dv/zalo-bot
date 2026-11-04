import type { ITransactionListItem } from '@zalobot/contracts';
import type { DebtEntity } from '../database/entities/debt.entity';

/** Makes Excel read the file as UTF-8; without it Vietnamese turns into mojibake. */
export const CSV_BOM = '﻿';

/** Spreadsheets run a cell starting with one of these as a formula, and notes are free text. */
const FORMULA_START = /^[=+\-@\t\r]/;

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(cells: ReadonlyArray<string | number | null | undefined>): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(', ', ' ');
}

function formatDate(value?: Date | string | null): string {
  return formatDateTime(value).slice(0, 10);
}

export const TRANSACTION_CSV_HEADER = csvRow([
  'Ngày',
  'Loại',
  'Số tiền',
  'Danh mục',
  'Nội dung',
  'Nơi chốn',
  'Phương thức',
  'Người tạo',
  'Số dư sau giao dịch',
]);

export function transactionCsvRow(item: ITransactionListItem): string {
  return csvRow([
    formatDateTime(item.occurredAt),
    item.type === 'income' ? 'Thu' : 'Chi',
    item.amount,
    item.category,
    item.note,
    item.placeName,
    item.paymentMethod,
    item.createdByName,
    item.runningBalance,
  ]);
}

export const DEBT_CSV_HEADER = csvRow([
  'Ngày',
  'Loại',
  'Người liên quan',
  'Số tiền gốc',
  'Số còn lại',
  'Trạng thái',
  'Hạn trả',
  'Ghi chú',
]);

export function debtCsvRow(debt: DebtEntity): string {
  const name = debt.counterpartyAlias
    ? `${debt.counterparty} (${debt.counterpartyAlias})`
    : debt.counterparty;
  return csvRow([
    formatDate(debt.occurredAt ?? debt.createdAt),
    debt.direction === 'receivable' ? 'Phải thu' : 'Phải trả',
    name,
    Number(debt.originalAmount),
    Number(debt.remainingAmount),
    debt.status === 'settled' ? 'Đã xong' : 'Còn nợ',
    formatDate(debt.dueAt),
    debt.note,
  ]);
}

/** `giao-dich-2026-11-04.csv`, dated in Vietnam time. */
export function csvFileName(prefix: string, now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
  return `${prefix}-${date}.csv`;
}

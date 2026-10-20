import type { ITransactionListQuery, TransactionType } from '@zalobot/contracts';

export type ReceiptFilter = 'any' | 'yes' | 'no';

/** Column filters of the transactions table; kept in the URL so reload/share keeps them. */
export type TransactionColumnFilters = {
  type: 'all' | TransactionType;
  categories: string[];
  note: string;
  placeIds: string[];
  createdByUserIds: string[];
  receipt: ReceiptFilter;
  amountMin: string;
  amountMax: string;
};

export const EMPTY_TRANSACTION_COLUMN_FILTERS: TransactionColumnFilters = {
  type: 'all',
  categories: [],
  note: '',
  placeIds: [],
  createdByUserIds: [],
  receipt: 'any',
  amountMin: '',
  amountMax: '',
};

// `type` predates the column filters and stays the toolbar's existing URL param.
const PARAM = {
  type: 'type',
  categories: 'category',
  note: 'note',
  placeIds: 'place',
  createdByUserIds: 'creator',
  receipt: 'receipt',
  amountMin: 'amountMin',
  amountMax: 'amountMax',
} as const;

function amountParam(value: string | null): string {
  const trimmed = value?.trim() ?? '';
  return /^\d+$/.test(trimmed) ? trimmed : '';
}

export function parseTransactionColumnFilters(
  params: Pick<URLSearchParams, 'get' | 'getAll'>,
): TransactionColumnFilters {
  const type = params.get(PARAM.type);
  const receipt = params.get(PARAM.receipt);
  const list = (name: string) => [
    ...new Set(
      params
        .getAll(name)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  return {
    type: type === 'income' || type === 'expense' ? type : 'all',
    categories: list(PARAM.categories),
    note: params.get(PARAM.note)?.trim() ?? '',
    placeIds: list(PARAM.placeIds),
    createdByUserIds: list(PARAM.createdByUserIds),
    receipt: receipt === 'yes' || receipt === 'no' ? receipt : 'any',
    amountMin: amountParam(params.get(PARAM.amountMin)),
    amountMax: amountParam(params.get(PARAM.amountMax)),
  };
}

/** Rewrites the filter params of `params`, leaving unrelated params (period etc.) untouched. */
export function writeTransactionColumnFilters(
  params: URLSearchParams,
  filters: TransactionColumnFilters,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  Object.values(PARAM).forEach((name) => next.delete(name));
  if (filters.type !== 'all') next.set(PARAM.type, filters.type);
  filters.categories.forEach((value) => next.append(PARAM.categories, value));
  if (filters.note.trim()) next.set(PARAM.note, filters.note.trim());
  filters.placeIds.forEach((value) => next.append(PARAM.placeIds, value));
  filters.createdByUserIds.forEach((value) => next.append(PARAM.createdByUserIds, value));
  if (filters.receipt !== 'any') next.set(PARAM.receipt, filters.receipt);
  if (amountParam(filters.amountMin)) next.set(PARAM.amountMin, filters.amountMin.trim());
  if (amountParam(filters.amountMax)) next.set(PARAM.amountMax, filters.amountMax.trim());
  return next;
}

/** Number of active column filters, excluding `type` which the toolbar buttons already show. */
export function countActiveColumnFilters(filters: TransactionColumnFilters): number {
  return [
    filters.categories.length > 0,
    filters.note.trim() !== '',
    filters.placeIds.length > 0,
    filters.createdByUserIds.length > 0,
    filters.receipt !== 'any',
    filters.amountMin !== '' || filters.amountMax !== '',
  ].filter(Boolean).length;
}

/** Backend query params for the filters; empty filters are omitted. */
export function toTransactionListFilterQuery(
  filters: TransactionColumnFilters,
): Omit<ITransactionListQuery, 'startAt' | 'endAt' | 'search' | 'limit' | 'offset'> {
  const min = amountParam(filters.amountMin);
  const max = amountParam(filters.amountMax);
  // A reversed range would be rejected by the API; swap it instead of erroring while typing.
  const [amountMin, amountMax] = min && max && Number(min) > Number(max) ? [max, min] : [min, max];
  return {
    type: filters.type === 'all' ? undefined : filters.type,
    categories: filters.categories.length ? filters.categories : undefined,
    note: filters.note.trim() || undefined,
    placeIds: filters.placeIds.length ? filters.placeIds : undefined,
    createdByUserIds: filters.createdByUserIds.length ? filters.createdByUserIds : undefined,
    hasReceipt: filters.receipt === 'any' ? undefined : filters.receipt === 'yes',
    amountMin: amountMin ? Number(amountMin) : undefined,
    amountMax: amountMax ? Number(amountMax) : undefined,
  };
}

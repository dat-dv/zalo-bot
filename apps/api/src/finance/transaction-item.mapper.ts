import type { ITransactionItem } from '@zalobot/contracts';
import type { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Single mapping used by the dashboard payload and `GET /api/transactions` so both stay in sync. */
export function toTransactionItem(item: FinanceTransactionEntity): ITransactionItem {
  return {
    id: item.id,
    type: item.type,
    category: item.category,
    note: item.note,
    amount: item.amount,
    currency: item.currency,
    paymentMethod: item.paymentMethod,
    placeId: item.placeId,
    placeName: item.place?.name,
    occurredAt: toIso(item.occurredAt) ?? new Date(0).toISOString(),
    createdAt: toIso(item.createdAt),
    allocations: item.allocations?.map((alloc) => ({
      id: alloc.id,
      amount: alloc.amount,
      debtId: alloc.debtId,
      note: alloc.note,
      counterparty: alloc.debt?.counterparty,
      remainingAmount: alloc.debt?.remainingAmount,
    })),
  };
}

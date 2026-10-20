import type { ITransactionItem } from '@zalobot/contracts';
import type { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Names looked up in one batch per page (users.firstName, zca_thread_configs.thread_name). */
export interface TransactionItemLookups {
  userNames: ReadonlyMap<string, string>;
  chats: ReadonlyMap<string, { name?: string; type: 'user' | 'group' }>;
}

const EMPTY_LOOKUPS: TransactionItemLookups = { userNames: new Map(), chats: new Map() };

/** Single mapping used by the dashboard payload and `GET /api/transactions` so both stay in sync. */
export function toTransactionItem(
  item: FinanceTransactionEntity,
  lookups: TransactionItemLookups = EMPTY_LOOKUPS,
): ITransactionItem {
  const chat = item.sourceChatId ? lookups.chats.get(item.sourceChatId) : undefined;
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
    createdByUserId: item.createdByUserId,
    // Current profile name wins; the snapshot covers creators without a users row.
    createdByName:
      (item.createdByUserId && lookups.userNames.get(item.createdByUserId)) ||
      item.createdByName ||
      undefined,
    source: item.source,
    sourceChatName: chat?.name,
    sourceChatType: chat?.type,
    // The raw URL is a private Drive link; the web loads it through the receipt proxy instead.
    hasReceipt: Boolean(item.receiptUrl?.trim()),
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

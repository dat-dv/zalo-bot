import type { FinanceTransactionEntity } from '../../database/entities/finance-transaction.entity';
import type { FinanceService } from '../../finance/finance.service';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const LATEST_WORDS = ['gần nhất', 'mới nhất', 'vừa tạo', 'vừa xong', 'vừa rồi', 'lúc nãy'];

function textArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Transactions a chat request points at, best match first: by id (argument, then a UUID in the
 * message), the sender's latest for "gần nhất", otherwise rows whose note or category contains the
 * query. Several rows can match, and each caller decides what that means.
 */
export async function findTransactionTargets(
  finance: Pick<FinanceService, 'getTransaction' | 'getLatestTransaction' | 'listTransactions'>,
  input: { args: Record<string, unknown>; senderId?: string; text?: string },
): Promise<FinanceTransactionEntity[]> {
  const { args, senderId, text } = input;
  const id = textArg(args.transactionId) ?? textArg(args.id) ?? text?.match(UUID)?.[0];
  // The id column is a uuid: anything else would be a database error, not a miss.
  if (id && UUID.test(id)) {
    const transaction = await finance.getTransaction(id);
    if (transaction) return [transaction];
  }

  const query = textArg(args.query)?.toLowerCase();
  if (!query) return [];
  if (LATEST_WORDS.some((word) => query.includes(word))) {
    const latest = await finance.getLatestTransaction(senderId);
    return latest ? [latest] : [];
  }
  const rows = await finance.listTransactions();
  return rows.filter(
    (row) => row.note?.toLowerCase().includes(query) || row.category?.toLowerCase().includes(query),
  );
}

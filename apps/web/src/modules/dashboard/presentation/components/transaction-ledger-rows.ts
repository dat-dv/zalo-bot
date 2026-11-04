import type {
  ITransactionListItem,
  ITransactionSavingMovement,
  SavingMovementType,
} from '@zalobot/contracts';
import type { TransactionTableItem } from './transactions-table';

/** A deposit leaves the wallet, so it reads like an expense; the others add money. */
const ROW_TYPE: Record<SavingMovementType, TransactionTableItem['type']> = {
  deposit: 'expense',
  withdrawal: 'income',
  opening: 'income',
};

function movementRow(
  movement: ITransactionSavingMovement,
  includeSavings: boolean,
  labelFor: (type: SavingMovementType) => string,
): TransactionTableItem {
  return {
    id: movement.id,
    type: ROW_TYPE[movement.type],
    category: labelFor(movement.type),
    note: movement.note ? `${movement.groupName}: ${movement.note}` : movement.groupName,
    amount: movement.amount,
    occurredAt: movement.occurredAt,
    createdAt: movement.createdAt,
    createdByName: movement.createdByName,
    runningBalance: includeSavings ? movement.runningBalanceWithSavings : movement.runningBalance,
    readOnly: true,
  };
}

/**
 * Transactions newest first with the savings movements of the same pages between them, so a
 * balance change always has a row that explains it. The sort is stable, which keeps the
 * server's order for transactions sharing a timestamp.
 */
export function mergeLedgerRows(
  transactions: readonly ITransactionListItem[],
  movements: readonly ITransactionSavingMovement[],
  includeSavings: boolean,
  labelFor: (type: SavingMovementType) => string,
): TransactionTableItem[] {
  const rows: TransactionTableItem[] = [
    ...transactions.map((item) => ({
      ...item,
      runningBalance: includeSavings ? item.runningBalanceWithSavings : item.runningBalance,
    })),
    ...movements.map((item) => movementRow(item, includeSavings, labelFor)),
  ];
  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

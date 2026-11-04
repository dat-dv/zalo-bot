import type { ISavingMovement, SavingMovementType } from '@zalobot/contracts';
import type { SavingMovementEntity } from '../database/entities/saving-movement.entity';

/** How a movement changes the wallet and the savings. `opening` adds savings without leaving the wallet. */
export function savingMovementDeltas(
  type: SavingMovementType,
  amount: number,
): { wallet: number; savings: number } {
  if (type === 'deposit') return { wallet: -amount, savings: amount };
  if (type === 'withdrawal') return { wallet: amount, savings: -amount };
  return { wallet: 0, savings: amount };
}

export function savingBalance(
  movements: readonly Pick<SavingMovementEntity, 'type' | 'amount'>[],
): number {
  return movements.reduce(
    (total, row) => total + savingMovementDeltas(row.type, row.amount).savings,
    0,
  );
}

export function toSavingMovementItem(
  row: SavingMovementEntity,
  groupName = row.group?.name ?? '',
): ISavingMovement {
  return {
    id: row.id,
    groupId: row.groupId,
    groupName,
    type: row.type,
    amount: row.amount,
    occurredAt: row.occurredAt.toISOString(),
    note: row.note ?? undefined,
    createdByName: row.createdByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface SavingMovementWindow {
  /** Inclusive; none for the oldest page of an open-ended period. */
  from?: Date;
  to?: Date;
  /** The top of a later page is the row above it, which belongs to the previous page. */
  toExclusive: boolean;
}

/**
 * The movements to show between one page of transactions. Windows of neighbouring pages touch,
 * so a movement between two pages lands on exactly one of them.
 */
export function savingMovementsInWindow<T extends { occurredAt: Date }>(
  movements: readonly T[],
  { from, to, toExclusive }: SavingMovementWindow,
): T[] {
  return movements.filter(({ occurredAt }) => {
    const time = occurredAt.getTime();
    if (from && time < from.getTime()) return false;
    if (!to) return true;
    return toExclusive ? time < to.getTime() : time <= to.getTime();
  });
}

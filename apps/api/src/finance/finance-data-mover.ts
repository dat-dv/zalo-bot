import type { EntityTarget, FindManyOptions, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';

/** Narrow subset of TypeORM EntityManager; callers pass a transactional manager. */
export interface FinanceDataManager {
  find<E extends ObjectLiteral>(target: EntityTarget<E>, options: FindManyOptions<E>): Promise<E[]>;
  update<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: FindOptionsWhere<E>,
    partial: QueryDeepPartialEntity<E>,
  ): Promise<unknown>;
  delete<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: FindOptionsWhere<E>,
  ): Promise<unknown>;
}

export const contactKey = (c: DebtContactEntity): string =>
  `${c.normalizedName}|${c.normalizedAlias ?? ''}`;
export const categoryKey = (c: UserCategoryEntity): string =>
  `${c.type}|${c.name.trim().toLowerCase()}`;

/** Same normalized place name on both ledgers: repoint transactions to the target place. */
async function movePlaces(manager: FinanceDataManager, sourceId: string, targetId: string) {
  const targetPlaces = await manager.find(FinancePlaceEntity, { where: { userId: targetId } });
  const byName = new Map(targetPlaces.map((p) => [p.normalizedName, p]));
  for (const place of await manager.find(FinancePlaceEntity, { where: { userId: sourceId } })) {
    const duplicate = byName.get(place.normalizedName);
    if (!duplicate) continue;
    await manager.update(
      FinanceTransactionEntity,
      { placeId: place.id },
      { placeId: duplicate.id },
    );
    await manager.delete(FinancePlaceEntity, { id: place.id });
  }
  await manager.update(FinancePlaceEntity, { userId: sourceId }, { userId: targetId });
}

/** Same normalized name + alias on both ledgers: repoint debts and transactions to the target contact. */
async function moveContacts(manager: FinanceDataManager, sourceId: string, targetId: string) {
  const targetContacts = await manager.find(DebtContactEntity, { where: { userId: targetId } });
  const byKey = new Map(targetContacts.map((c) => [contactKey(c), c]));
  for (const contact of await manager.find(DebtContactEntity, { where: { userId: sourceId } })) {
    const duplicate = byKey.get(contactKey(contact));
    if (!duplicate) continue;
    await manager.update(DebtEntity, { contactId: contact.id }, { contactId: duplicate.id });
    await manager.update(
      FinanceTransactionEntity,
      { contactId: contact.id },
      { contactId: duplicate.id },
    );
    await manager.delete(DebtContactEntity, { id: contact.id });
  }
  await manager.update(DebtContactEntity, { userId: sourceId }, { userId: targetId });
}

/** Transactions store the category name, so dropping a duplicate category loses no data. */
async function moveCategories(manager: FinanceDataManager, sourceId: string, targetId: string) {
  const targetKeys = new Set(
    (await manager.find(UserCategoryEntity, { where: { userId: targetId } })).map(categoryKey),
  );
  for (const category of await manager.find(UserCategoryEntity, { where: { userId: sourceId } })) {
    if (targetKeys.has(categoryKey(category))) {
      await manager.delete(UserCategoryEntity, { id: category.id });
    }
  }
  await manager.update(UserCategoryEntity, { userId: sourceId }, { userId: targetId });
}

/**
 * Moves one ledger's finance data (places, contacts, categories, transactions, debts, payments,
 * allocations) into another, de-duplicating places, contacts and categories. Shared by the user
 * merge (duplicate identity) and the shared-ledger consolidation. Run inside a DB transaction.
 */
export async function moveFinanceData(
  manager: FinanceDataManager,
  sourceId: string,
  targetId: string,
): Promise<void> {
  await movePlaces(manager, sourceId, targetId);
  await moveContacts(manager, sourceId, targetId);
  await moveCategories(manager, sourceId, targetId);
  await manager.update(FinanceTransactionEntity, { userId: sourceId }, { userId: targetId });
  await manager.update(DebtEntity, { userId: sourceId }, { userId: targetId });
  await manager.update(DebtPaymentEntity, { userId: sourceId }, { userId: targetId });
  await manager.update(DebtPaymentAllocationEntity, { userId: sourceId }, { userId: targetId });
}

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GrantAccessStatus,
  UserRole,
  type IUserMergeConflicts,
  type IUserMergeResult,
  type IUserMergeSummary,
  type UserMergeGoogleTokenDecision,
  type UserMergeTable,
} from '@zalobot/contracts';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { DashboardExchangeTokenEntity } from '../database/entities/dashboard-exchange-token.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { UserTokenEntity } from '../database/entities/user-token.entity';
import { UserEntity } from '../database/entities/user.entity';
import {
  USER_MERGE_UNIT_OF_WORK,
  USER_MERGE_USERS_PORT,
  type UserMergeManager,
  type UserMergeUnitOfWork,
  type UserMergeUsersPort,
} from './user-merge.types';

/** Profile fields copied from the source user only when the target leaves them empty. */
const FILL_IF_EMPTY_FIELDS = [
  'firstName',
  'username',
  'phoneNumber',
  'avatarUrl',
  'driveFolderId',
  'driveFolderUrl',
  'driveFolderPath',
] as const;

const contactKey = (c: DebtContactEntity): string =>
  `${c.normalizedName}|${c.normalizedAlias ?? ''}`;
const categoryKey = (c: UserCategoryEntity): string => `${c.type}|${c.name.trim().toLowerCase()}`;

const updatedAtMs = (token: UserTokenEntity): number =>
  token.updatedAt instanceof Date
    ? token.updatedAt.getTime()
    : new Date(token.updatedAt).getTime() || 0;

/**
 * Decide which Google token survives: the only one present, otherwise the one holding a refresh
 * token, otherwise the most recently updated one.
 */
export function chooseGoogleToken(
  source: UserTokenEntity | null,
  target: UserTokenEntity | null,
): UserMergeGoogleTokenDecision {
  if (!source) return 'none';
  if (!target) return 'keep-source';
  const sourceHasRefresh = Boolean(source.refreshToken);
  const targetHasRefresh = Boolean(target.refreshToken);
  if (sourceHasRefresh !== targetHasRefresh)
    return sourceHasRefresh ? 'keep-source' : 'keep-target';
  return updatedAtMs(source) > updatedAtMs(target) ? 'keep-source' : 'keep-target';
}

/**
 * Merges a duplicate user identity (e.g. the legacy Zalo webhook app-scoped ID) into the
 * canonical user (e.g. the ZCA UID). All data moves atomically in one transaction.
 */
@Injectable()
export class UserMergeService {
  private readonly logger = new Logger(UserMergeService.name);

  constructor(
    @Inject(USER_MERGE_UNIT_OF_WORK) private readonly uow: UserMergeUnitOfWork,
    @Inject(USER_MERGE_USERS_PORT) private readonly users: UserMergeUsersPort,
  ) {}

  public preview(sourceUserId: string, targetUserId: string): Promise<IUserMergeSummary> {
    return this.summarize(this.uow.manager, sourceUserId, targetUserId);
  }

  public async merge(
    sourceUserId: string,
    targetUserId: string,
    actorId: string,
  ): Promise<IUserMergeResult> {
    const sourceId = sourceUserId.trim();
    const targetId = targetUserId.trim();
    if (this.users.isBotAccount(sourceId)) {
      throw new BadRequestException("Cannot merge the bot's own ZCA account.");
    }

    const summary = await this.uow.transaction(async (manager) => {
      const snapshot = await this.summarize(manager, sourceId, targetId);
      const source = await this.requireUser(manager, sourceId);
      const target = await this.requireUser(manager, targetId);

      await this.mergePlaces(manager, sourceId, targetId);
      await this.mergeContacts(manager, sourceId, targetId);
      await this.mergeCategories(manager, sourceId, targetId);

      await manager.update(FinanceTransactionEntity, { userId: sourceId }, { userId: targetId });
      await manager.update(DebtEntity, { userId: sourceId }, { userId: targetId });
      await manager.update(DebtPaymentEntity, { userId: sourceId }, { userId: targetId });
      await manager.update(DebtPaymentAllocationEntity, { userId: sourceId }, { userId: targetId });
      await manager.update(ReminderEntity, { userId: sourceId }, { userId: targetId });

      await this.mergeGoogleToken(manager, sourceId, targetId, snapshot.conflicts.googleToken);
      await manager.delete(DashboardExchangeTokenEntity, { userId: sourceId });

      const before = { source: { ...source }, target: { ...target } };
      this.mergeProfile(source, target);
      await manager.save(UserEntity, target);
      await manager.delete(UserEntity, { id: sourceId });

      await manager.save(AuditLogEntity, {
        tableName: 'users',
        recordId: targetId,
        action: 'update',
        actorId,
        beforeData: before,
        afterData: {
          operation: 'merge',
          mergedFromUserId: sourceId,
          counts: snapshot.counts,
          conflicts: snapshot.conflicts,
        },
      });
      return snapshot;
    });

    await this.users.afterUsersMerged(sourceId, targetId);
    this.logger.log(`Merged user ${sourceId} into ${targetId} (actor ${actorId}).`);
    return { ...summary, sourceWasCurrentSession: actorId === sourceId };
  }

  private async summarize(
    manager: UserMergeManager,
    sourceUserId: string,
    targetUserId: string,
  ): Promise<IUserMergeSummary> {
    const sourceId = sourceUserId.trim();
    const targetId = targetUserId.trim();
    if (!sourceId || !targetId)
      throw new BadRequestException('Source and target user IDs are required.');
    if (sourceId === targetId) throw new BadRequestException('Cannot merge a user into itself.');
    await this.requireUser(manager, sourceId);
    await this.requireUser(manager, targetId);

    const bySource = { where: { userId: sourceId } };
    const counts: Record<UserMergeTable, number> = {
      financeTransactions: await manager.count(FinanceTransactionEntity, bySource),
      financePlaces: await manager.count(FinancePlaceEntity, bySource),
      userCategories: await manager.count(UserCategoryEntity, bySource),
      debts: await manager.count(DebtEntity, bySource),
      debtContacts: await manager.count(DebtContactEntity, bySource),
      debtPayments: await manager.count(DebtPaymentEntity, bySource),
      debtPaymentAllocations: await manager.count(DebtPaymentAllocationEntity, bySource),
      reminders: await manager.count(ReminderEntity, bySource),
      googleToken: await manager.count(UserTokenEntity, bySource),
    };

    const conflicts: IUserMergeConflicts = {
      places: await this.countOverlap(
        (userId) => manager.find(FinancePlaceEntity, { where: { userId } }),
        sourceId,
        targetId,
        (p) => p.normalizedName,
      ),
      contacts: await this.countOverlap(
        (userId) => manager.find(DebtContactEntity, { where: { userId } }),
        sourceId,
        targetId,
        contactKey,
      ),
      categories: await this.countOverlap(
        (userId) => manager.find(UserCategoryEntity, { where: { userId } }),
        sourceId,
        targetId,
        categoryKey,
      ),
      googleToken: chooseGoogleToken(
        await manager.findOne(UserTokenEntity, { where: { userId: sourceId } }),
        await manager.findOne(UserTokenEntity, { where: { userId: targetId } }),
      ),
    };

    return {
      sourceUserId: sourceId,
      targetUserId: targetId,
      counts,
      conflicts,
      sourceIsBotAccount: this.users.isBotAccount(sourceId),
    };
  }

  private async requireUser(manager: UserMergeManager, id: string): Promise<UserEntity> {
    const user = await manager.findOne(UserEntity, { where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found.`);
    return user;
  }

  private async countOverlap<E extends { userId: string }>(
    load: (userId: string) => Promise<E[]>,
    sourceId: string,
    targetId: string,
    key: (row: E) => string,
  ): Promise<number> {
    const [sourceRows, targetRows] = await Promise.all([load(sourceId), load(targetId)]);
    const targetKeys = new Set(targetRows.map(key));
    return sourceRows.filter((row) => targetKeys.has(key(row))).length;
  }

  /** Same normalized place name on both users: repoint transactions to the target place. */
  private async mergePlaces(
    manager: UserMergeManager,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
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

  /** Same normalized name + alias on both users: repoint debts and transactions to the target contact. */
  private async mergeContacts(
    manager: UserMergeManager,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
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
    await manager.update(DebtContactEntity, { linkedUserId: sourceId }, { linkedUserId: targetId });
  }

  /** Transactions store the category name, so dropping a duplicate category loses no data. */
  private async mergeCategories(
    manager: UserMergeManager,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
    const targetKeys = new Set(
      (await manager.find(UserCategoryEntity, { where: { userId: targetId } })).map(categoryKey),
    );
    for (const category of await manager.find(UserCategoryEntity, {
      where: { userId: sourceId },
    })) {
      if (targetKeys.has(categoryKey(category))) {
        await manager.delete(UserCategoryEntity, { id: category.id });
      }
    }
    await manager.update(UserCategoryEntity, { userId: sourceId }, { userId: targetId });
  }

  private async mergeGoogleToken(
    manager: UserMergeManager,
    sourceId: string,
    targetId: string,
    decision: UserMergeGoogleTokenDecision,
  ): Promise<void> {
    if (decision === 'keep-source') {
      await manager.delete(UserTokenEntity, { userId: targetId });
      await manager.update(UserTokenEntity, { userId: sourceId }, { userId: targetId });
    } else if (decision === 'keep-target') {
      await manager.delete(UserTokenEntity, { userId: sourceId });
    }
  }

  private mergeProfile(source: UserEntity, target: UserEntity): void {
    for (const field of FILL_IF_EMPTY_FIELDS) {
      if (!target[field] && source[field]) target[field] = source[field];
    }
    if (source.role === UserRole.ADMIN) target.role = UserRole.ADMIN;
    if (source.grantAccess === GrantAccessStatus.GRANTED || target.role === UserRole.ADMIN) {
      target.grantAccess = GrantAccessStatus.GRANTED;
    }
    if (source.createdAt && target.createdAt && source.createdAt < target.createdAt) {
      target.createdAt = source.createdAt;
    }
  }
}

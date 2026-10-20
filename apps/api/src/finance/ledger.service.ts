import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, type EntityManager, type EntityTarget } from 'typeorm';
import type {
  ILedgerConsolidateResult,
  ILedgerDataCounts,
  ILedgerInfo,
  ILedgerSource,
} from '@zalobot/contracts';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { UserEntity } from '../database/entities/user.entity';
import { moveFinanceData } from './finance-data-mover';

type CountedEntity =
  | FinanceTransactionEntity
  | FinancePlaceEntity
  | DebtContactEntity
  | DebtEntity
  | UserCategoryEntity;

const COUNTED: ReadonlyArray<[keyof ILedgerDataCounts, EntityTarget<CountedEntity>]> = [
  ['transactions', FinanceTransactionEntity],
  ['places', FinancePlaceEntity],
  ['contacts', DebtContactEntity],
  ['debts', DebtEntity],
  ['categories', UserCategoryEntity],
];

const emptyCounts = (): ILedgerDataCounts => ({
  transactions: 0,
  places: 0,
  contacts: 0,
  debts: 0,
  categories: 0,
});

/**
 * Shared ledger: when a ledger owner is set, every sender's finance data (transactions, places,
 * contacts, debts, categories) is recorded and read under that one user. Without an owner the
 * system keeps the original per-user ledgers.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  /** `undefined` = not loaded yet; `null` = loaded, no owner. */
  private cachedOwnerId: string | null | undefined;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  public async getOwnerId(): Promise<string | null> {
    if (this.cachedOwnerId === undefined) {
      const owner = await this.userRepo.findOne({
        where: { isLedgerOwner: true },
        select: { id: true },
      });
      this.cachedOwnerId = owner?.id ?? null;
    }
    return this.cachedOwnerId;
  }

  /** The user id whose ledger an actor (Zalo sender or dashboard user) reads and writes. */
  public async resolveLedgerUserId(actorId: string | number): Promise<string> {
    return (await this.getOwnerId()) ?? String(actorId);
  }

  /** Makes `userId` the only ledger owner; `null` returns to per-user ledgers. */
  public async setOwner(userId: string | null): Promise<string | null> {
    await this.userRepo.manager.transaction(async (manager) => {
      if (userId !== null) {
        const exists = await manager.exists(UserEntity, { where: { id: userId } });
        if (!exists) throw new NotFoundException('Không tìm thấy người dùng.');
      }
      // Clear first so the single-owner unique index never sees two owners.
      await manager.update(UserEntity, { isLedgerOwner: true }, { isLedgerOwner: false });
      if (userId !== null)
        await manager.update(UserEntity, { id: userId }, { isLedgerOwner: true });
    });
    this.cachedOwnerId = userId;
    return userId;
  }

  /** Owner plus every other ledger (including ones whose user row is gone) and its row counts. */
  public async getInfo(): Promise<ILedgerInfo> {
    const ownerUserId = await this.getOwnerId();
    const counts = await this.countByLedger(this.userRepo.manager);
    const ids = [...new Set([...counts.keys(), ...(ownerUserId ? [ownerUserId] : [])])];
    const users = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) }, select: { id: true, firstName: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.firstName?.trim() || undefined]));

    const sources: ILedgerSource[] = [...counts.entries()]
      .filter(([userId]) => userId !== ownerUserId)
      .map(([userId, rowCounts]) => ({
        userId,
        name: names.get(userId),
        hasAccount: names.has(userId),
        counts: rowCounts,
      }))
      .sort((a, b) => b.counts.transactions - a.counts.transactions);

    return {
      ownerUserId,
      ownerName: ownerUserId ? names.get(ownerUserId) : undefined,
      sources,
    };
  }

  /**
   * Moves every other ledger's finance data into the owner's ledger in one DB transaction. Each
   * transaction keeps its original author in `created_by_user_id`; no user account is deleted.
   */
  public async consolidate(actorId: string): Promise<ILedgerConsolidateResult> {
    const ownerUserId = await this.getOwnerId();
    if (!ownerUserId) throw new BadRequestException('Chưa chọn chủ sổ chung.');

    const result = await this.userRepo.manager.transaction(async (manager) => {
      const counts = await this.countByLedger(manager);
      const sourceIds = [...counts.keys()].filter((id) => id !== ownerUserId);
      const moved = emptyCounts();
      for (const id of sourceIds) {
        const rowCounts = counts.get(id) ?? emptyCounts();
        for (const key of Object.keys(moved) as (keyof ILedgerDataCounts)[]) {
          moved[key] += rowCounts[key];
        }
      }

      // Record authorship before rows change ledger, so "Người tạo" survives the move.
      for (const id of [ownerUserId, ...sourceIds]) {
        await manager.update(
          FinanceTransactionEntity,
          { userId: id, createdByUserId: IsNull() },
          { createdByUserId: id },
        );
      }
      for (const id of sourceIds) {
        await moveFinanceData(manager, id, ownerUserId);
      }

      await manager.save(AuditLogEntity, {
        tableName: 'finance_transactions',
        recordId: ownerUserId,
        action: 'update',
        actorId,
        beforeData: { ledgers: Object.fromEntries(counts) },
        afterData: { operation: 'consolidate-shared-ledger', mergedUserIds: sourceIds },
      });
      return { ownerUserId, mergedUserIds: sourceIds, counts: moved };
    });

    this.logger.log(
      `Consolidated ${result.mergedUserIds.length} ledger(s) into ${ownerUserId} (actor ${actorId}).`,
    );
    return result;
  }

  private async countByLedger(manager: EntityManager): Promise<Map<string, ILedgerDataCounts>> {
    const counts = new Map<string, ILedgerDataCounts>();
    for (const [key, entity] of COUNTED) {
      const rows = await manager.find(entity, { select: { userId: true } });
      for (const { userId } of rows) {
        const entry = counts.get(userId) ?? emptyCounts();
        entry[key] += 1;
        counts.set(userId, entry);
      }
    }
    return counts;
  }
}

/** For optional injections (tests, partial modules): fall back to the actor's own ledger. */
export function resolveLedgerUserIdOrSelf(
  ledger: LedgerService | undefined,
  actorId: string | number,
): Promise<string> {
  return ledger ? ledger.resolveLedgerUserId(actorId) : Promise.resolve(String(actorId));
}

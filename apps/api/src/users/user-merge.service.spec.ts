import test from 'node:test';
import assert from 'node:assert/strict';
import type { EntityTarget, ObjectLiteral } from 'typeorm';
import { GrantAccessStatus, UserRole } from '@zalobot/contracts';
import { UserMergeService, chooseGoogleToken } from './user-merge.service';
import type { UserMergeManager, UserMergeUnitOfWork, UserMergeUsersPort } from './user-merge.types';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { DashboardExchangeTokenEntity } from '../database/entities/dashboard-exchange-token.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { UserTokenEntity } from '../database/entities/user-token.entity';
import { UserEntity } from '../database/entities/user.entity';

type Row = Record<string, unknown>;
type Tables = Map<EntityTarget<ObjectLiteral>, Row[]>;

function matches(row: Row, criteria: object): boolean {
  return Object.entries(criteria).every(([key, value]) => row[key] === value);
}

class FakeManager implements UserMergeManager {
  public failOnUpdateOf: EntityTarget<ObjectLiteral> | null = null;

  constructor(public tables: Tables) {}

  private rows(target: EntityTarget<ObjectLiteral>): Row[] {
    const existing = this.tables.get(target);
    if (existing) return existing;
    const created: Row[] = [];
    this.tables.set(target, created);
    return created;
  }

  public findOne<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    options: { where?: object },
  ): Promise<E | null> {
    const found = this.rows(target).find((r) => matches(r, options.where ?? {}));
    return Promise.resolve(found ? (found as E) : null);
  }

  public find<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    options: { where?: object },
  ): Promise<E[]> {
    return Promise.resolve(this.rows(target).filter((r) => matches(r, options.where ?? {})) as E[]);
  }

  public count<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    options: { where?: object },
  ): Promise<number> {
    return Promise.resolve(this.rows(target).filter((r) => matches(r, options.where ?? {})).length);
  }

  public update<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: object,
    partial: object,
  ): Promise<unknown> {
    if (this.failOnUpdateOf === target) return Promise.reject(new Error('boom'));
    for (const row of this.rows(target)) if (matches(row, criteria)) Object.assign(row, partial);
    return Promise.resolve(undefined);
  }

  public delete<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: object,
  ): Promise<unknown> {
    const rows = this.rows(target);
    const kept = rows.filter((r) => !matches(r, criteria));
    rows.splice(0, rows.length, ...kept);
    return Promise.resolve(undefined);
  }

  public save<E extends ObjectLiteral>(target: EntityTarget<E>, entity: object): Promise<unknown> {
    const rows = this.rows(target);
    const entityRow: Row = { ...entity };
    const index = target === UserEntity ? rows.findIndex((r) => r.id === entityRow.id) : -1;
    if (index >= 0) rows[index] = entityRow;
    else rows.push(entityRow);
    return Promise.resolve(entity);
  }
}

function cloneTables(tables: Tables): Tables {
  return new Map([...tables].map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
}

function setup(seed: Array<[EntityTarget<ObjectLiteral>, Row[]]>, botAccountId?: string) {
  const manager = new FakeManager(new Map(seed));
  const uow: UserMergeUnitOfWork = {
    manager,
    transaction: async (work) => {
      const backup = cloneTables(manager.tables);
      try {
        return await work(manager);
      } catch (error: unknown) {
        manager.tables = backup;
        throw error;
      }
    },
  };
  const merged: Array<[string, string]> = [];
  const users: UserMergeUsersPort = {
    isBotAccount: (id) => id === botAccountId,
    afterUsersMerged: (s, t) => {
      merged.push([s, t]);
      return Promise.resolve();
    },
  };
  return { manager, service: new UserMergeService(uow, users), merged };
}

const OLD = '573462d8909179cf2080';
const NEW = '2285509137317769272';

function seedDuplicate(): Array<[EntityTarget<ObjectLiteral>, Row[]]> {
  return [
    [
      UserEntity,
      [
        {
          id: OLD,
          firstName: 'Văn Đạt',
          role: UserRole.ADMIN,
          grantAccess: GrantAccessStatus.GRANTED,
          driveFolderId: 'drive-1',
          createdAt: new Date('2026-10-11'),
        },
        {
          id: NEW,
          firstName: 'Văn Đạt',
          role: UserRole.USER,
          grantAccess: GrantAccessStatus.DENIED,
          createdAt: new Date('2026-10-19'),
        },
      ],
    ],
    [
      FinancePlaceEntity,
      [
        { id: 'p-old-dup', userId: OLD, normalizedName: 'highlands' },
        { id: 'p-old-only', userId: OLD, normalizedName: 'circle k' },
        { id: 'p-new', userId: NEW, normalizedName: 'highlands' },
      ],
    ],
    [
      DebtContactEntity,
      [
        { id: 'c-old', userId: OLD, normalizedName: 'tri', normalizedAlias: 'tri den' },
        { id: 'c-new', userId: NEW, normalizedName: 'tri', normalizedAlias: 'tri den' },
        { id: 'c-link', userId: 'someone', normalizedName: 'dat', linkedUserId: OLD },
      ],
    ],
    [
      UserCategoryEntity,
      [
        { id: 'cat-old-dup', userId: OLD, type: 'expense', name: 'Ăn uống' },
        { id: 'cat-old-only', userId: OLD, type: 'expense', name: 'Xăng xe' },
        { id: 'cat-new', userId: NEW, type: 'expense', name: 'ăn uống ' },
      ],
    ],
    [
      FinanceTransactionEntity,
      [
        { id: 't1', userId: OLD, placeId: 'p-old-dup', contactId: 'c-old' },
        { id: 't2', userId: OLD, placeId: 'p-old-only' },
      ],
    ],
    [DebtEntity, [{ id: 'd1', userId: OLD, contactId: 'c-old' }]],
    [ReminderEntity, [{ id: 'r1', userId: OLD }]],
    [UserTokenEntity, [{ userId: OLD, refreshToken: 'rt', updatedAt: new Date('2026-10-12') }]],
    [DashboardExchangeTokenEntity, [{ id: 'x1', userId: OLD }]],
  ];
}

void test('chooseGoogleToken prefers the token with a refresh token, then the newest', () => {
  const t = (refreshToken: string | undefined, iso: string) =>
    ({ userId: 'u', refreshToken, updatedAt: new Date(iso) }) as UserTokenEntity;
  assert.equal(chooseGoogleToken(null, t('a', '2026-01-01')), 'none');
  assert.equal(chooseGoogleToken(t('a', '2026-01-01'), null), 'keep-source');
  assert.equal(chooseGoogleToken(t(undefined, '2026-05-01'), t('b', '2026-01-01')), 'keep-target');
  assert.equal(chooseGoogleToken(t('a', '2026-05-01'), t('b', '2026-01-01')), 'keep-source');
});

void test('preview rejects self-merge and unknown users', async () => {
  const { service } = setup(seedDuplicate());
  await assert.rejects(() => service.preview(OLD, OLD), /itself/);
  await assert.rejects(() => service.preview(OLD, 'missing'), /not found/);
});

void test('preview reports counts and conflicts without writing', async () => {
  const { service, manager } = setup(seedDuplicate());
  const summary = await service.preview(OLD, NEW);
  assert.equal(summary.counts.financeTransactions, 2);
  assert.equal(summary.counts.financePlaces, 2);
  assert.equal(summary.counts.googleToken, 1);
  assert.deepEqual(
    { ...summary.conflicts },
    { places: 1, contacts: 1, categories: 1, googleToken: 'keep-source' },
  );
  assert.equal(manager.tables.get(UserEntity)?.length, 2);
});

void test('merge moves data, folds duplicates, keeps admin rights and audits', async () => {
  const { service, manager, merged } = setup(seedDuplicate());
  const result = await service.merge(OLD, NEW, OLD);
  const rows = (e: EntityTarget<ObjectLiteral>) => manager.tables.get(e) ?? [];

  assert.equal(result.sourceWasCurrentSession, true);
  assert.deepEqual(merged, [[OLD, NEW]]);

  const users = rows(UserEntity);
  assert.equal(users.length, 1);
  assert.equal(users[0].id, NEW);
  assert.equal(users[0].role, UserRole.ADMIN);
  assert.equal(users[0].grantAccess, GrantAccessStatus.GRANTED);
  assert.equal(users[0].driveFolderId, 'drive-1');
  assert.deepEqual(users[0].createdAt, new Date('2026-10-11'));

  assert.deepEqual(
    rows(FinancePlaceEntity).map((p) => [p.id, p.userId]),
    [
      ['p-old-only', NEW],
      ['p-new', NEW],
    ],
  );
  const tx = rows(FinanceTransactionEntity);
  assert.ok(tx.every((t) => t.userId === NEW));
  assert.equal(tx.find((t) => t.id === 't1')?.placeId, 'p-new');
  assert.equal(tx.find((t) => t.id === 't1')?.contactId, 'c-new');
  assert.equal(rows(DebtEntity)[0].contactId, 'c-new');
  assert.equal(rows(DebtEntity)[0].userId, NEW);
  assert.deepEqual(
    rows(DebtContactEntity).map((c) => c.id),
    ['c-new', 'c-link'],
  );
  assert.equal(rows(DebtContactEntity).find((c) => c.id === 'c-link')?.linkedUserId, NEW);
  assert.deepEqual(
    rows(UserCategoryEntity).map((c) => c.id),
    ['cat-old-only', 'cat-new'],
  );
  assert.equal(rows(ReminderEntity)[0].userId, NEW);
  assert.deepEqual(
    rows(UserTokenEntity).map((t) => t.userId),
    [NEW],
  );
  assert.equal(rows(DashboardExchangeTokenEntity).length, 0);

  const audit = rows(AuditLogEntity);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].recordId, NEW);
  assert.equal(audit[0].actorId, OLD);
});

void test('merge is refused when the source is the bot own ZCA account', async () => {
  const { service, manager } = setup(seedDuplicate(), OLD);
  await assert.rejects(() => service.merge(OLD, NEW, NEW), /bot's own ZCA account/);
  assert.equal(manager.tables.get(UserEntity)?.length, 2);
});

void test('merge rolls back everything when a step fails', async () => {
  const { service, manager, merged } = setup(seedDuplicate());
  manager.failOnUpdateOf = ReminderEntity;
  await assert.rejects(() => service.merge(OLD, NEW, NEW), /boom/);
  assert.equal(manager.tables.get(UserEntity)?.length, 2);
  assert.ok((manager.tables.get(FinanceTransactionEntity) ?? []).every((t) => t.userId === OLD));
  assert.equal(merged.length, 0);
});

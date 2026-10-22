import test from 'node:test';
import assert from 'node:assert/strict';
import type { EntityTarget, ObjectLiteral } from 'typeorm';
import { GrantAccessStatus, UserRole } from '@zalobot/contracts';
import { UserMergeService, chooseGoogleToken, replaceRemindUser } from './user-merge.service';
import type { UserMergeManager, UserMergeUnitOfWork, UserMergeUsersPort } from './user-merge.types';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { CalendarEventEntity } from '../database/entities/calendar-event.entity';
import { DashboardExchangeTokenEntity } from '../database/entities/dashboard-exchange-token.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { TaskEntity } from '../database/entities/task.entity';
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
      DebtContactEntity,
      [
        { id: 'c-link', normalizedName: 'dat', linkedUserId: OLD },
        { id: 'c-other', normalizedName: 'hang', linkedUserId: 'someone-else' },
      ],
    ],
    [
      FinanceTransactionEntity,
      [
        { id: 't1', createdByUserId: OLD, placeId: 'p-1', contactId: 'c-other' },
        { id: 't2', createdByUserId: OLD },
        { id: 't3', createdByUserId: NEW },
      ],
    ],
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
  assert.deepEqual(
    { ...summary.counts },
    { financeTransactions: 2, debtContacts: 1, reminders: 1, googleToken: 1 },
  );
  assert.deepEqual({ ...summary.conflicts }, { linkedContacts: 0, googleToken: 'keep-source' });
  assert.equal(manager.tables.get(UserEntity)?.length, 2);
});

void test('merge moves authorship and links, keeps shared finance data, admin rights and audits', async () => {
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

  // Shared finance rows stay as they are; only who wrote them follows the identity.
  const tx = rows(FinanceTransactionEntity);
  assert.deepEqual(
    tx.map((t) => [t.id, t.createdByUserId]),
    [
      ['t1', NEW],
      ['t2', NEW],
      ['t3', NEW],
    ],
  );
  assert.equal(tx.find((t) => t.id === 't1')?.placeId, 'p-1');
  assert.equal(tx.find((t) => t.id === 't1')?.contactId, 'c-other');
  assert.equal(rows(DebtContactEntity).find((c) => c.id === 'c-link')?.linkedUserId, NEW);
  assert.equal(
    rows(DebtContactEntity).find((c) => c.id === 'c-other')?.linkedUserId,
    'someone-else',
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

void test('merge drops the source contact link when the target already has one', async () => {
  const seed = seedDuplicate().map(([entity, rows]): [EntityTarget<ObjectLiteral>, Row[]] =>
    entity === DebtContactEntity
      ? [entity, [...rows, { id: 'c-target', normalizedName: 'dat 2', linkedUserId: NEW }]]
      : [entity, rows],
  );
  const { service, manager } = setup(seed);

  const summary = await service.preview(OLD, NEW);
  assert.equal(summary.conflicts.linkedContacts, 1);

  await service.merge(OLD, NEW, NEW);
  const contacts = manager.tables.get(DebtContactEntity) ?? [];
  assert.equal(contacts.find((c) => c.id === 'c-link')?.linkedUserId, null);
  assert.equal(contacts.find((c) => c.id === 'c-target')?.linkedUserId, NEW);
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
  assert.equal(
    (manager.tables.get(FinanceTransactionEntity) ?? []).find((t) => t.id === 't1')
      ?.createdByUserId,
    OLD,
  );
  assert.equal(merged.length, 0);
});

void test('merge moves task and calendar authorship and where reminders go', async () => {
  const seed = seedDuplicate().filter(([entity]) => entity !== ReminderEntity);
  seed.push(
    [
      ReminderEntity,
      [
        { id: 'r-own', userId: OLD, chatId: null, remindUsers: [] },
        { id: 'r-chat', userId: NEW, chatId: OLD, remindUsers: [] },
        { id: 'r-tag', userId: 'x', chatId: 'g1', remindUsers: [{ id: OLD, name: 'Đạt' }] },
        {
          id: 'r-both',
          userId: 'x',
          chatId: 'g1',
          remindUsers: [
            { id: OLD, name: 'Đạt' },
            { id: NEW, name: 'Đạt' },
          ],
        },
        { id: 'r-other', userId: 'x', chatId: 'g1', remindUsers: [{ id: 'y', name: 'Y' }] },
      ],
    ],
    [
      TaskEntity,
      [
        { id: 'k1', createdByUserId: OLD, remindChatId: OLD, remindUsers: [] },
        {
          id: 'k2',
          createdByUserId: 'x',
          remindChatId: 'g1',
          remindUsers: [{ id: OLD, name: 'Đạt' }],
        },
      ],
    ],
    [CalendarEventEntity, [{ id: 'e1', createdByUserId: OLD }]],
  );
  const { service, manager } = setup(seed);
  await service.merge(OLD, NEW, NEW);
  const rows = (e: EntityTarget<ObjectLiteral>) => manager.tables.get(e) ?? [];
  const byId = (e: EntityTarget<ObjectLiteral>, id: string) => rows(e).find((r) => r.id === id);

  assert.equal(byId(ReminderEntity, 'r-own')?.userId, NEW);
  assert.equal(byId(ReminderEntity, 'r-chat')?.chatId, NEW);
  assert.deepEqual(byId(ReminderEntity, 'r-tag')?.remindUsers, [{ id: NEW, name: 'Đạt' }]);
  assert.deepEqual(byId(ReminderEntity, 'r-both')?.remindUsers, [{ id: NEW, name: 'Đạt' }]);
  assert.deepEqual(byId(ReminderEntity, 'r-other')?.remindUsers, [{ id: 'y', name: 'Y' }]);
  assert.equal(byId(TaskEntity, 'k1')?.createdByUserId, NEW);
  assert.equal(byId(TaskEntity, 'k1')?.remindChatId, NEW);
  assert.deepEqual(byId(TaskEntity, 'k2')?.remindUsers, [{ id: NEW, name: 'Đạt' }]);
  assert.equal(byId(CalendarEventEntity, 'e1')?.createdByUserId, NEW);
});

void test('replaceRemindUser swaps the source, drops it when the target is listed', () => {
  const people = [
    { id: OLD, name: 'Đạt' },
    { id: 'y', name: 'Y' },
  ];
  assert.deepEqual(replaceRemindUser(people, OLD, NEW), [
    { id: NEW, name: 'Đạt' },
    { id: 'y', name: 'Y' },
  ]);
  assert.deepEqual(replaceRemindUser([...people, { id: NEW, name: 'Đạt' }], OLD, NEW), [
    { id: 'y', name: 'Y' },
    { id: NEW, name: 'Đạt' },
  ]);
  assert.equal(replaceRemindUser(people, 'z', NEW), null);
  assert.equal(replaceRemindUser(undefined, OLD, NEW), null);
});

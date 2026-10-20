/**
 * Removes fake users whose id is actually a ZCA group thread id.
 *
 * Before the passive-tool-allowlist fix, `UsersService.saveDriveFolderInfo` created a DENIED user
 * for any unknown channel id, so group ids showed up as "pending approval" on the Users page.
 *
 * Candidates come from `zca_thread_configs.thread_type = 'group'`. Older rows may still say 'user'
 * for numeric ZCA group ids; the API fixes them when it loads the ZCA thread list, so open the ZCA
 * threads page (or run the Users sync) once after deploying before running this script.
 *
 * Usage:
 *   npm run users:cleanup-groups --workspace @zalobot/api            # dry-run, prints candidates
 *   npm run users:cleanup-groups --workspace @zalobot/api -- --apply # deletes eligible rows
 */
import Redis from 'ioredis';
import { In, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../src/database/data-source';
import { UserRole } from '@zalobot/contracts';
import { UserEntity } from '../src/database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../src/database/entities/zca-thread-config.entity';
import { FinanceTransactionEntity } from '../src/database/entities/finance-transaction.entity';
import { UserTokenEntity } from '../src/database/entities/user-token.entity';
import { DebtContactEntity } from '../src/database/entities/debt-contact.entity';
import { ReminderEntity } from '../src/database/entities/reminder.entity';
import { DashboardExchangeTokenEntity } from '../src/database/entities/dashboard-exchange-token.entity';

interface LinkedTable {
  label: string;
  entity: EntityTarget<ObjectLiteral>;
  /** Column that points at `users.id`. */
  key: string;
}

// Every table that references a user. A candidate with rows here is real data and is never
// auto-deleted. Finance data is shared (no owner column), so only authorship and links count.
const LINKED_TABLES: LinkedTable[] = [
  { label: 'finance_transactions', entity: FinanceTransactionEntity, key: 'createdByUserId' },
  { label: 'debt_contacts', entity: DebtContactEntity, key: 'linkedUserId' },
  { label: 'user_tokens', entity: UserTokenEntity, key: 'userId' },
  { label: 'reminders', entity: ReminderEntity, key: 'userId' },
  { label: 'dashboard_exchange_tokens', entity: DashboardExchangeTokenEntity, key: 'userId' },
];

interface Candidate {
  user: UserEntity;
  blockedBy: string[];
}

async function findCandidates(): Promise<Candidate[]> {
  const groupThreads = await AppDataSource.getRepository(ZcaThreadConfigEntity).find({
    where: { threadType: 'group' },
    select: { threadId: true },
  });
  const groupIds = groupThreads.map((t) => t.threadId);
  if (groupIds.length === 0) return [];

  const users = await AppDataSource.getRepository(UserEntity).find({
    where: { id: In(groupIds) },
  });

  const candidates: Candidate[] = [];
  for (const user of users) {
    const blockedBy: string[] = [];
    if (user.role === UserRole.ADMIN) blockedBy.push('role=admin');
    for (const table of LINKED_TABLES) {
      const count = await AppDataSource.getRepository(table.entity).count({
        where: { [table.key]: user.id },
      });
      if (count > 0) blockedBy.push(`${table.label}=${count}`);
    }
    candidates.push({ user, blockedBy });
  }
  return candidates;
}

function printCandidates(candidates: Candidate[]): void {
  if (candidates.length === 0) {
    console.log('Không có user nào trùng ID với group thread.');
    return;
  }
  console.table(
    candidates.map(({ user, blockedBy }) => ({
      id: user.id,
      firstName: user.firstName ?? '',
      role: user.role,
      grantAccess: user.grantAccess,
      createdAt: user.createdAt?.toISOString?.() ?? '',
      action: blockedBy.length === 0 ? 'DELETE' : `SKIP (${blockedBy.join(', ')})`,
    })),
  );
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

async function clearWhitelistCache(ids: string[]): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl || ids.length === 0) return;
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.del(...ids.map((id) => `whitelist:user:${id}`));
  } catch (err: unknown) {
    console.warn(`Không xoá được cache whitelist trên Redis: ${describeError(err)}`);
  } finally {
    redis.disconnect();
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await AppDataSource.initialize();
  try {
    const candidates = await findCandidates();
    printCandidates(candidates);

    const deletable = candidates.filter((c) => c.blockedBy.length === 0).map((c) => c.user);
    if (!apply) {
      console.log(
        `\nDry-run: ${deletable.length} user sẽ bị xoá. Chạy lại với "-- --apply" để thực hiện.`,
      );
      return;
    }
    if (deletable.length === 0) {
      console.log('Không có user nào đủ điều kiện xoá.');
      return;
    }

    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(UserEntity).remove(deletable);
    });
    await clearWhitelistCache(deletable.map((u) => u.id));
    console.log(`Đã xoá ${deletable.length} user giả có ID là group.`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(describeError(err));
  process.exitCode = 1;
});

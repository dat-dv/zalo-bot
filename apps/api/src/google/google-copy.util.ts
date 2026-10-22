import type { GoogleSyncStatus, IGoogleCopySync } from '@zalobot/contracts';
import { In, type Repository } from 'typeorm';
import type { UserEntity } from '../database/entities/user.entity';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import type { GoogleAuthService } from './google-auth.service';

/**
 * Helpers for records that live in the DB and keep a copy in a Google account (calendar
 * events): reaching that account again, and describing who made the record (also used by
 * tasks, which have no Google copy).
 */

type GoogleAccounts = Pick<GoogleAuthService, 'isAuthorized' | 'getAccountEmail'>;

/** HTTP status of a googleapis error, if it carries one. */
export function googleErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { code, status, response } = err as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  for (const value of [response?.status, status, code]) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

/** Which client reaches the Google account holding a copy: the actor's own, or the shared one. */
export async function resolveGoogleCopyTarget(
  googleAuth: GoogleAccounts,
  accountEmail: string | null | undefined,
  actorId?: string,
): Promise<{ reachable: boolean; userId?: string }> {
  if (!accountEmail) return { reachable: false };
  for (const candidate of [actorId, undefined]) {
    if (!googleAuth.isAuthorized(candidate)) continue;
    if ((await googleAuth.getAccountEmail(candidate)) === accountEmail) {
      return { reachable: true, userId: candidate };
    }
  }
  return { reachable: false };
}

/** Google accounts the system can currently write to for this viewer. */
export async function connectedGoogleEmails(
  googleAuth: GoogleAccounts,
  viewerId?: string,
): Promise<Set<string>> {
  const emails = new Set<string>();
  for (const candidate of [viewerId, undefined]) {
    if (!googleAuth.isAuthorized(candidate)) continue;
    try {
      const email = await googleAuth.getAccountEmail(candidate);
      if (email) emails.add(email);
    } catch {
      // Unknown account: its records just show as "other account".
    }
  }
  return emails;
}

/** Names looked up in one batch per response (users.firstName, zca_thread_configs.thread_name). */
export interface RecordOriginLookups {
  userNames: ReadonlyMap<string, string>;
  chats: ReadonlyMap<string, { name?: string; type: 'user' | 'group' }>;
  /** Google accounts the system can currently write to. */
  connectedEmails: ReadonlySet<string>;
}

export interface RecordOrigin {
  createdByUserId?: string | null;
  sourceChatId?: string | null;
}

export async function loadRecordOriginLookups(
  rows: readonly RecordOrigin[],
  deps: {
    /** Omit for records without a Google copy (tasks): `connectedEmails` is then empty. */
    googleAuth?: GoogleAccounts;
    userRepo?: Repository<UserEntity>;
    threadConfigRepo?: Repository<ZcaThreadConfigEntity>;
  },
  viewerId?: string,
): Promise<RecordOriginLookups> {
  const creatorIds = [
    ...new Set(rows.map((row) => row.createdByUserId).filter((id): id is string => !!id)),
  ];
  const chatIds = [
    ...new Set(rows.map((row) => row.sourceChatId).filter((id): id is string => !!id)),
  ];
  const [users, chats, connectedEmails] = await Promise.all([
    creatorIds.length && deps.userRepo
      ? deps.userRepo.find({
          where: { id: In(creatorIds) },
          select: { id: true, firstName: true },
        })
      : Promise.resolve<UserEntity[]>([]),
    chatIds.length && deps.threadConfigRepo
      ? deps.threadConfigRepo.find({
          where: { threadId: In(chatIds) },
          select: { threadId: true, threadName: true, threadType: true },
        })
      : Promise.resolve<ZcaThreadConfigEntity[]>([]),
    deps.googleAuth
      ? connectedGoogleEmails(deps.googleAuth, viewerId)
      : Promise.resolve(new Set<string>()),
  ]);
  return {
    userNames: new Map(
      users.flatMap((user): [string, string][] => {
        const name = user.firstName?.trim();
        return name ? [[user.id, name]] : [];
      }),
    ),
    chats: new Map(
      chats.map((chat) => [
        chat.threadId,
        {
          name: chat.threadName?.trim() || undefined,
          type: chat.threadType === 'group' ? 'group' : 'user',
        },
      ]),
    ),
    connectedEmails,
  };
}

/** Current profile name wins; the snapshot covers creators without a users row. */
export function creatorDisplayName(
  row: RecordOrigin & { createdByName?: string | null },
  lookups: RecordOriginLookups,
): string | undefined {
  return (
    (row.createdByUserId && lookups.userNames.get(row.createdByUserId)) ||
    row.createdByName ||
    undefined
  );
}

export function toGoogleCopySync(
  row: {
    syncStatus: GoogleSyncStatus;
    googleAccountEmail?: string | null;
    syncedAt?: Date | null;
  },
  lookups: RecordOriginLookups,
): IGoogleCopySync {
  const accountEmail = row.googleAccountEmail ?? undefined;
  return {
    status: row.syncStatus,
    accountEmail,
    isCurrentAccount: accountEmail ? lookups.connectedEmails.has(accountEmail) : true,
    syncedAt: row.syncedAt?.toISOString(),
  };
}

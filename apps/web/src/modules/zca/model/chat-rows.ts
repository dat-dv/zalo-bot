import { GrantAccessStatus, UserRole, type IUserListItem } from '@zalobot/contracts';
import type { ZcaThread } from '../api/zca-api';

/**
 * One row of the unified "Zalo & Users" table.
 * - `group`: a ZCA group thread (listening only, groups are never users).
 * - `personal`: a ZCA 1-1 thread; `user` is set when the same id exists in `users`.
 * - `user-only`: a `users` row with no ZCA thread (legacy official-bot ids, `dashboard-owner`, non-friend group members).
 */
export type ChatRowKind = 'group' | 'personal' | 'user-only';

/** `none` = personal thread without a `users` record yet; `n/a` = groups. */
export type ChatRowAccess = 'admin' | 'granted' | 'pending' | 'none' | 'n/a';

export interface ChatRow {
  id: string;
  kind: ChatRowKind;
  thread?: ZcaThread;
  user?: IUserListItem;
  name: string;
  avatar?: string;
  alias?: string;
  zaloName?: string;
  phoneNumber?: string;
  isListened: boolean;
  access: ChatRowAccess;
}

export type ChatRowFilter =
  'all' | 'listened' | 'group' | 'personal' | 'pending' | 'granted' | 'admin';

export type ChatRowSort =
  | 'listened_first'
  | 'pending_first'
  | 'name_asc'
  | 'name_desc'
  | 'group_first'
  | 'user_first'
  | 'members_desc';

const GENERIC_USER_NAMES = new Set(['bạn', 'Người dùng Zalo']);

export function normalizeVietnamese(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function getUserAccess(user: IUserListItem | undefined): ChatRowAccess {
  if (!user) return 'none';
  if (user.role === UserRole.ADMIN) return 'admin';
  return user.grantAccess === GrantAccessStatus.GRANTED ? 'granted' : 'pending';
}

export function hasInteractionAccess(access: ChatRowAccess): boolean {
  return access === 'admin' || access === 'granted';
}

function userDisplayName(user: IUserListItem): string {
  const firstName =
    user.firstName && !GENERIC_USER_NAMES.has(user.firstName) ? user.firstName : undefined;
  return firstName || user.alias || user.displayName || user.zaloName || user.firstName || '';
}

export function buildChatRows(threads: ZcaThread[], users: IUserListItem[]): ChatRow[] {
  const usersById = new Map(users.map((u) => [u.id, u]));
  const threadIds = new Set<string>();
  const rows: ChatRow[] = [];

  for (const thread of threads) {
    threadIds.add(thread.id);
    if (thread.type === 'group') {
      rows.push({
        id: thread.id,
        kind: 'group',
        thread,
        name: thread.name,
        avatar: thread.avatar,
        alias: thread.alias,
        isListened: thread.isListened,
        access: 'n/a',
      });
      continue;
    }
    const user = usersById.get(thread.id);
    rows.push({
      id: thread.id,
      kind: 'personal',
      thread,
      user,
      name: thread.name || (user ? userDisplayName(user) : ''),
      avatar: thread.avatar || user?.avatarUrl,
      alias: thread.alias || user?.alias,
      zaloName: thread.displayName || user?.displayName || user?.zaloName,
      phoneNumber: thread.phoneNumber || user?.phoneNumber,
      isListened: thread.isListened,
      access: getUserAccess(user),
    });
  }

  for (const user of users) {
    if (threadIds.has(user.id)) continue;
    rows.push({
      id: user.id,
      kind: 'user-only',
      user,
      name: userDisplayName(user),
      avatar: user.avatarUrl,
      alias: user.alias,
      zaloName: user.displayName || user.zaloName,
      phoneNumber: user.phoneNumber,
      isListened: false,
      access: getUserAccess(user),
    });
  }

  return rows;
}

export function matchesChatRowSearch(row: ChatRow, search: string): boolean {
  const query = normalizeVietnamese(search);
  if (!query) return true;
  const textFields = [row.name, row.alias, row.zaloName, row.thread?.zaloName, row.user?.username];
  if (textFields.some((value) => normalizeVietnamese(value || '').includes(query))) return true;
  return (
    (row.phoneNumber || '').toLowerCase().includes(query) || row.id.toLowerCase().includes(query)
  );
}

export function matchesChatRowFilter(row: ChatRow, filter: ChatRowFilter): boolean {
  switch (filter) {
    case 'listened':
      return row.isListened;
    case 'group':
      return row.kind === 'group';
    case 'personal':
      return row.kind !== 'group';
    case 'pending':
      return row.access === 'pending' || row.access === 'none';
    case 'granted':
      return hasInteractionAccess(row.access);
    case 'admin':
      return row.access === 'admin';
    default:
      return true;
  }
}

export function countChatRows(rows: ChatRow[]): Record<ChatRowFilter, number> {
  const count = (filter: ChatRowFilter) =>
    rows.filter((row) => matchesChatRowFilter(row, filter)).length;
  return {
    all: rows.length,
    listened: count('listened'),
    group: count('group'),
    personal: count('personal'),
    pending: count('pending'),
    granted: count('granted'),
    admin: count('admin'),
  };
}

function byName(a: ChatRow, b: ChatRow): number {
  return (a.name || '').localeCompare(b.name || '', 'vi');
}

const PENDING_RANK: Record<ChatRowAccess, number> = {
  pending: 0,
  none: 1,
  granted: 2,
  admin: 3,
  'n/a': 4,
};

export function sortChatRows(rows: ChatRow[], sortBy: ChatRowSort): ChatRow[] {
  return [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'listened_first':
        if (a.isListened !== b.isListened) return a.isListened ? -1 : 1;
        return byName(a, b);
      case 'pending_first':
        if (a.access !== b.access) return PENDING_RANK[a.access] - PENDING_RANK[b.access];
        return byName(a, b);
      case 'name_desc':
        return byName(b, a);
      case 'group_first':
        if ((a.kind === 'group') !== (b.kind === 'group')) return a.kind === 'group' ? -1 : 1;
        return byName(a, b);
      case 'user_first':
        if ((a.kind === 'group') !== (b.kind === 'group')) return a.kind === 'group' ? 1 : -1;
        return byName(a, b);
      case 'members_desc': {
        const diff = (b.thread?.totalMembers ?? 0) - (a.thread?.totalMembers ?? 0);
        return diff !== 0 ? diff : byName(a, b);
      }
      default:
        return byName(a, b);
    }
  });
}

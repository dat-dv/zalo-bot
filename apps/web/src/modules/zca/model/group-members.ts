import type { IUserListItem, IZcaGroupMember } from '@zalobot/contracts';
import { getUserAccess, normalizeVietnamese } from './chat-rows';

/** Access a member already has outside this group; such members cannot be switched off here. */
export type GroupMemberGlobalAccess = 'admin' | 'granted' | 'none';

export interface GroupMemberRow {
  id: string;
  displayName: string;
  zaloName?: string;
  avatar?: string;
  globalAccess: GroupMemberGlobalAccess;
  isSelected: boolean;
  /** Selected earlier but no longer returned by Zalo as a member. */
  hasLeft: boolean;
}

export type GroupMemberFilter = 'all' | 'selected';

function globalAccessOf(user: IUserListItem | undefined): GroupMemberGlobalAccess {
  const access = getUserAccess(user);
  return access === 'admin' || access === 'granted' ? access : 'none';
}

/** Zalo members in their order, then selected ids that left the group so they can be removed. */
export function buildGroupMemberRows(
  members: readonly IZcaGroupMember[],
  users: readonly IUserListItem[],
  selectedIds: readonly string[],
): GroupMemberRow[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const selected = new Set(selectedIds);
  const memberIds = new Set(members.map((member) => member.id));

  const rows: GroupMemberRow[] = members.map((member) => ({
    ...member,
    globalAccess: globalAccessOf(usersById.get(member.id)),
    isSelected: selected.has(member.id),
    hasLeft: false,
  }));
  for (const id of selectedIds) {
    if (memberIds.has(id)) continue;
    const user = usersById.get(id);
    rows.push({
      id,
      displayName: user?.firstName || user?.displayName || user?.zaloName || id,
      avatar: user?.avatarUrl,
      globalAccess: globalAccessOf(user),
      isSelected: true,
      hasLeft: true,
    });
  }
  return rows;
}

export function filterGroupMemberRows(
  rows: readonly GroupMemberRow[],
  search: string,
  filter: GroupMemberFilter,
): GroupMemberRow[] {
  const query = normalizeVietnamese(search);
  return rows.filter((row) => {
    if (filter === 'selected' && !row.isSelected) return false;
    if (!query) return true;
    return (
      normalizeVietnamese(row.displayName).includes(query) ||
      normalizeVietnamese(row.zaloName || '').includes(query) ||
      row.id.includes(query)
    );
  });
}

export function setMemberSelected(ids: readonly string[], id: string, selected: boolean): string[] {
  const rest = ids.filter((current) => current !== id);
  return selected ? [...rest, id] : rest;
}

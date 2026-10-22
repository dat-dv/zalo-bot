import type { IZcaGroupMember, IZcaGroupMembersResponse } from '@zalobot/contracts';

/** Short cache: membership changes often, and the thread config page has a refresh button. */
export const ZCA_GROUP_MEMBERS_TTL_SECONDS = 600;
/** `getGroupMembersInfo` is called in chunks of this size. */
export const ZCA_GROUP_MEMBERS_BATCH_SIZE = 50;

export function zcaGroupMembersRedisKey(groupId: string): string {
  return `zca:group_members:${groupId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Zalo suffixes member ids with a version (`<uid>_<ver>`); only the uid identifies a sender. */
export function stripMemberVersion(raw: string): string {
  return raw.split('_')[0]?.trim() ?? '';
}

/**
 * Reads the member ids and member count of one group from a `getGroupInfo` response.
 * Returns null when the response does not contain the group.
 */
export function readGroupInfo(
  response: unknown,
  groupId: string,
): { memberIds: string[]; totalMembers: number } | null {
  const map = isRecord(response) ? response.gridInfoMap : undefined;
  const group = isRecord(map) ? map[groupId] : undefined;
  if (!isRecord(group)) return null;
  const memberIds: string[] = [];
  const list = Array.isArray(group.memVerList) ? group.memVerList : [];
  for (const entry of list) {
    const id = typeof entry === 'string' ? stripMemberVersion(entry) : '';
    if (id && !memberIds.includes(id)) memberIds.push(id);
  }
  const totalMembers = typeof group.totalMember === 'number' ? group.totalMember : memberIds.length;
  return { memberIds, totalMembers };
}

/** Maps `getGroupMembersInfo` profiles (keyed by `<uid>` or `<uid>_<ver>`) by uid. */
export function readMemberProfiles(response: unknown): Map<string, IZcaGroupMember> {
  const result = new Map<string, IZcaGroupMember>();
  const profiles = isRecord(response) ? response.profiles : undefined;
  if (!isRecord(profiles)) return result;
  for (const [key, profile] of Object.entries(profiles)) {
    if (!isRecord(profile)) continue;
    const id = stripMemberVersion(typeof profile.id === 'string' && profile.id ? profile.id : key);
    if (!id) continue;
    const displayName = typeof profile.displayName === 'string' ? profile.displayName.trim() : '';
    const zaloName = typeof profile.zaloName === 'string' ? profile.zaloName.trim() : '';
    const avatar =
      typeof profile.avatar === 'string' && profile.avatar ? profile.avatar : undefined;
    const shownName = displayName || zaloName || id;
    result.set(id, {
      id,
      displayName: shownName,
      ...(zaloName && zaloName !== shownName ? { zaloName } : {}),
      ...(avatar ? { avatar } : {}),
    });
  }
  return result;
}

/** Keeps the Zalo member order; a member whose profile failed to load shows its uid. */
export function buildGroupMembers(
  memberIds: readonly string[],
  profiles: ReadonlyMap<string, IZcaGroupMember>,
): IZcaGroupMember[] {
  return memberIds.map((id) => profiles.get(id) ?? { id, displayName: id });
}

export function parseGroupMembersCache(raw: string | null): IZcaGroupMembersResponse | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !Array.isArray(value.members)) return null;
    const members: IZcaGroupMember[] = [];
    for (const member of value.members) {
      if (!isRecord(member) || typeof member.id !== 'string') continue;
      members.push({
        id: member.id,
        displayName: typeof member.displayName === 'string' ? member.displayName : member.id,
        ...(typeof member.zaloName === 'string' ? { zaloName: member.zaloName } : {}),
        ...(typeof member.avatar === 'string' ? { avatar: member.avatar } : {}),
      });
    }
    return {
      members,
      totalMembers: typeof value.totalMembers === 'number' ? value.totalMembers : members.length,
      fetchedAt: typeof value.fetchedAt === 'number' ? value.fetchedAt : 0,
    };
  } catch {
    return null;
  }
}

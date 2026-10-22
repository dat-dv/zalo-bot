import { ZCA_DIRECTORY_SOFT_TTL_MS } from './zca.constants';

/** A group or contact as Zalo returns it, without per-bot state such as `isListened`. */
export interface ZcaDirectoryEntry {
  id: string;
  name: string;
  type: 'user' | 'group';
  avatar?: string;
  alias?: string;
  displayName?: string;
  zaloName?: string;
  phoneNumber?: string;
  totalMembers?: number;
}

/** Groups and friends of one ZCA account, stored in Redis under `zca:directory:<ownId>`. */
export interface ZcaDirectorySnapshot {
  fetchedAt: string;
  /** False when part of the last fetch failed; such a snapshot is retried like a stale one. */
  complete: boolean;
  groups: ZcaDirectoryEntry[];
  friends: ZcaDirectoryEntry[];
}

/** One part of a fetch; `complete` is false when any Zalo call behind it failed. */
export interface ZcaDirectorySection {
  complete: boolean;
  entries: ZcaDirectoryEntry[];
}

const OPTIONAL_TEXT_FIELDS = ['avatar', 'alias', 'displayName', 'zaloName', 'phoneNumber'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDirectoryEntry(value: unknown): ZcaDirectoryEntry | null {
  if (!isRecord(value)) return null;
  const { id, name, type } = value;
  if (typeof id !== 'string' || !id || typeof name !== 'string') return null;
  if (type !== 'user' && type !== 'group') return null;

  const entry: ZcaDirectoryEntry = { id, name, type };
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string') entry[field] = fieldValue;
  }
  if (typeof value.totalMembers === 'number') entry.totalMembers = value.totalMembers;
  return entry;
}

function toDirectoryEntries(value: unknown): ZcaDirectoryEntry[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(toDirectoryEntry).filter((entry): entry is ZcaDirectoryEntry => entry !== null);
}

/** Reads a snapshot written by an earlier run; anything malformed counts as a cache miss. */
export function parseZcaDirectorySnapshot(raw: string | null): ZcaDirectorySnapshot | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const { fetchedAt } = parsed;
  if (typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt))) return null;
  const groups = toDirectoryEntries(parsed.groups);
  const friends = toDirectoryEntries(parsed.friends);
  if (!groups || !friends) return null;
  return { fetchedAt, complete: parsed.complete === true, groups, friends };
}

export function isZcaDirectoryStale(snapshot: ZcaDirectorySnapshot, now: number): boolean {
  return !snapshot.complete || now - Date.parse(snapshot.fetchedAt) >= ZCA_DIRECTORY_SOFT_TTL_MS;
}

/**
 * Builds the next snapshot from a fetch. A section whose Zalo calls failed keeps the previous
 * snapshot's entries, so one failing call never wipes groups or friends for a whole week.
 * Returns null when nothing usable was fetched, so the caller keeps the previous snapshot as is.
 */
export function mergeZcaDirectory(
  groups: ZcaDirectorySection,
  friends: ZcaDirectorySection,
  previous: ZcaDirectorySnapshot | null,
  fetchedAt: Date,
): ZcaDirectorySnapshot | null {
  const fetchedAnything =
    groups.complete || friends.complete || groups.entries.length + friends.entries.length > 0;
  if (!fetchedAnything) return null;

  const pick = (section: ZcaDirectorySection, kept: ZcaDirectoryEntry[] | undefined) =>
    !section.complete && kept && kept.length > 0 ? kept : section.entries;

  return {
    fetchedAt: fetchedAt.toISOString(),
    complete: groups.complete && friends.complete,
    groups: pick(groups, previous?.groups),
    friends: pick(friends, previous?.friends),
  };
}

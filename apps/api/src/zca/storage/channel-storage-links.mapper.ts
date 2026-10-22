import type {
  ChannelStorageLink,
  ChannelStorageLinkKind,
  ChannelStorageLinksResponse,
} from '@zalobot/contracts';
import type { ChannelStorageLinkEntity } from '../../database/entities/channel-storage-link.entity';

export interface CurrentStorageResource {
  resourceId: string;
  url: string;
}

/** Where new media of a channel goes with the current shared Google account. */
export interface CurrentChannelStorage {
  drive?: CurrentStorageResource;
  photos?: CurrentStorageResource;
}

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

/**
 * Rows of one kind → links, newest first. A link backfilled from a thread config may hold the
 * URL as its id while a later upload recorded the real id, so rows are merged by URL.
 */
function toLinks(
  rows: readonly ChannelStorageLinkEntity[],
  kind: ChannelStorageLinkKind,
  current?: CurrentStorageResource,
): ChannelStorageLink[] {
  const byUrl = new Map<string, ChannelStorageLink>();
  for (const row of rows) {
    if (row.kind !== kind) continue;
    const isCurrent =
      Boolean(current) && (row.resourceId === current?.resourceId || row.url === current?.url);
    const link: ChannelStorageLink = {
      kind,
      url: row.url,
      label: row.label,
      googleEmail: row.googleEmail ?? null,
      firstUsedAt: toIso(row.firstUsedAt),
      lastUsedAt: toIso(row.lastUsedAt),
      isCurrent,
    };
    const existing = byUrl.get(row.url);
    if (!existing) {
      byUrl.set(row.url, link);
      continue;
    }
    byUrl.set(row.url, {
      ...existing,
      label: existing.label || link.label,
      googleEmail: existing.googleEmail ?? link.googleEmail,
      firstUsedAt:
        existing.firstUsedAt < link.firstUsedAt ? existing.firstUsedAt : link.firstUsedAt,
      lastUsedAt: existing.lastUsedAt > link.lastUsedAt ? existing.lastUsedAt : link.lastUsedAt,
      isCurrent: existing.isCurrent || link.isCurrent,
    });
  }
  return [...byUrl.values()].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  });
}

export function toChannelStorageLinksResponse(
  threadId: string,
  rows: readonly ChannelStorageLinkEntity[],
  current: CurrentChannelStorage = {},
): ChannelStorageLinksResponse {
  return {
    threadId,
    drive: toLinks(rows, 'drive', current.drive),
    photos: toLinks(rows, 'photos', current.photos),
  };
}

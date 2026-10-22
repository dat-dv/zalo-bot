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

/** Same rule as the dialog's "in use" badge: the row is where new media of the channel goes. */
export function isCurrentStorageRow(
  row: Pick<ChannelStorageLinkEntity, 'kind' | 'resourceId' | 'url'>,
  current: CurrentChannelStorage,
): boolean {
  const resource = row.kind === 'drive' ? current.drive : current.photos;
  return (
    Boolean(resource) && (row.resourceId === resource?.resourceId || row.url === resource?.url)
  );
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
  current: CurrentChannelStorage,
): ChannelStorageLink[] {
  const byUrl = new Map<string, ChannelStorageLink>();
  for (const row of rows) {
    if (row.kind !== kind) continue;
    const isCurrent = isCurrentStorageRow(row, current);
    const link: ChannelStorageLink = {
      id: row.id,
      kind,
      url: row.url,
      label: row.label,
      displayName: row.displayName || null,
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
      displayName: existing.displayName ?? link.displayName,
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
    drive: toLinks(rows, 'drive', current),
    photos: toLinks(rows, 'photos', current),
  };
}

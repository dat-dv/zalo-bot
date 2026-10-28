import type { IWebhookRecipient } from '@zalobot/contracts';

/** A Zalo chat as the Settings → Webhook list shows it. */
export interface WebhookRecipientRow {
  id: string;
  name: string;
  type: 'user' | 'group';
  avatar?: string;
  selected: boolean;
  /** Picked earlier but no longer in the Zalo directory (left group, removed friend). */
  missing: boolean;
}

export type WebhookRecipientFilter = 'all' | 'user' | 'group' | 'selected';

interface DirectoryThread {
  id: string;
  name: string;
  type: 'user' | 'group';
  avatar?: string;
  missingFromZalo?: boolean;
}

/** Directory chats plus picked chats Zalo no longer returns; picked first, then groups, then by name. */
export function buildWebhookRecipientRows(
  threads: DirectoryThread[],
  draft: ReadonlyMap<string, IWebhookRecipient>,
): WebhookRecipientRow[] {
  // Placeholder rows (left groups, stale listened ids) cannot be messaged: only keep them if picked.
  const live = threads.filter((thread) => !thread.missingFromZalo);
  const rows: WebhookRecipientRow[] = live.map((thread) => ({
    id: thread.id,
    name: thread.name || thread.id,
    type: thread.type,
    avatar: thread.avatar,
    selected: draft.has(thread.id),
    missing: false,
  }));
  const known = new Set(live.map((thread) => thread.id));
  for (const recipient of draft.values()) {
    if (known.has(recipient.threadId)) continue;
    rows.push({
      id: recipient.threadId,
      name: recipient.threadName || recipient.threadId,
      type: recipient.threadType,
      selected: true,
      missing: true,
    });
  }
  return rows.sort(
    (a, b) =>
      Number(b.selected) - Number(a.selected) ||
      (a.type === b.type ? 0 : a.type === 'group' ? -1 : 1) ||
      a.name.localeCompare(b.name, 'vi'),
  );
}

export function filterWebhookRecipientRows(
  rows: WebhookRecipientRow[],
  filter: WebhookRecipientFilter,
  search: string,
): WebhookRecipientRow[] {
  const query = normalize(search.trim());
  return rows.filter((row) => {
    if (filter === 'selected' && !row.selected) return false;
    if ((filter === 'user' || filter === 'group') && row.type !== filter) return false;
    return !query || normalize(row.name).includes(query) || row.id.includes(query);
  });
}

export function toggleWebhookRecipient(
  draft: ReadonlyMap<string, IWebhookRecipient>,
  row: WebhookRecipientRow,
): Map<string, IWebhookRecipient> {
  const next = new Map(draft);
  if (next.has(row.id)) next.delete(row.id);
  else next.set(row.id, { threadId: row.id, threadName: row.name, threadType: row.type });
  return next;
}

export function isSameRecipientSet(
  draft: ReadonlyMap<string, IWebhookRecipient>,
  saved: IWebhookRecipient[],
): boolean {
  return draft.size === saved.length && saved.every((recipient) => draft.has(recipient.threadId));
}

function normalize(value: string): string {
  return value
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

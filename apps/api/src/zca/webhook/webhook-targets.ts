import type { IWebhookTarget, IWebhookTargetsQuery } from '@zalobot/contracts';
import type { ZcaDirectoryEntry } from '../zca-directory-cache';
import { foldVietnamese } from '../memory/memory-text.util';

/**
 * The bot's friends and groups as webhook targets: filtered by type and name, groups first, then
 * by name. Copies only the picker fields so phone numbers and admin aliases never leave the bot.
 */
export function toWebhookTargets(
  threads: readonly ZcaDirectoryEntry[],
  query: IWebhookTargetsQuery,
): IWebhookTarget[] {
  const needle = foldVietnamese(query.q ?? '');
  return threads
    .filter((thread) => !query.type || thread.type === query.type)
    .filter((thread) => !needle || foldVietnamese(thread.name).includes(needle))
    .map((thread) => ({
      id: thread.id,
      name: thread.name,
      type: thread.type,
      avatar: thread.avatar || null,
      ...(thread.type === 'group' && thread.totalMembers !== undefined
        ? { totalMembers: thread.totalMembers }
        : {}),
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });
}

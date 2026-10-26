/** BullMQ queue of the long-term memory jobs (nightly, segments of today, `/sync`). */
export const CHAT_MEMORY_QUEUE = 'chat-memory';
export const CHAT_MEMORY_NIGHTLY_JOB = 'nightly';
/** Today's new messages of one chat, after it went quiet. */
export const CHAT_MEMORY_SEGMENT_JOB = 'segment';
/** `/sync` in one chat. */
export const CHAT_MEMORY_SYNC_JOB = 'sync';
/** 03:00 in the bot timezone: the chat day before is over and chats are quiet. */
export const CHAT_MEMORY_NIGHTLY_CRON = '0 3 * * *';

export interface SegmentJobData {
  channelId: string;
  /** A message of today was recalled: forget today's segments first. */
  resetToday?: boolean;
}

export interface SyncJobData {
  channelId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The channel of a segment or sync job; `null` for a malformed payload. */
export function readChannelJob(data: unknown): SegmentJobData | null {
  if (!isRecord(data) || typeof data.channelId !== 'string' || !data.channelId) return null;
  return { channelId: data.channelId, resetToday: data.resetToday === true };
}

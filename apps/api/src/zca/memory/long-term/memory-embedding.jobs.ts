/** BullMQ queue of the long-term memory jobs (nightly sweep, new messages of a chat, `/sync`). */
export const CHAT_MEMORY_QUEUE = 'chat-memory';
/** Every chat with long-term memory: messages still without an embedding. */
export const CHAT_MEMORY_NIGHTLY_JOB = 'nightly';
/** New messages of one chat, shortly after they were stored. */
export const CHAT_MEMORY_EMBED_JOB = 'embed';
/** Name of the per-chat job before embeddings (Cognee segments); jobs left in Redis run as `embed`. */
export const LEGACY_CHAT_MEMORY_SEGMENT_JOB = 'segment';
/** `/sync` in one chat. */
export const CHAT_MEMORY_SYNC_JOB = 'sync';
/** 03:00 in the bot timezone: catches anything a missed job left behind. */
export const CHAT_MEMORY_NIGHTLY_CRON = '0 3 * * *';

export interface ChannelJobData {
  channelId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The channel of an embed or sync job; `null` for a malformed payload. */
export function readChannelJob(data: unknown): ChannelJobData | null {
  if (!isRecord(data) || typeof data.channelId !== 'string' || !data.channelId) return null;
  return { channelId: data.channelId };
}

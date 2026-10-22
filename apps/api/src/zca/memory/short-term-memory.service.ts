import { Inject, Injectable, Optional } from '@nestjs/common';
import { CHAT_MEMORY_LIMITS } from '@zalobot/contracts';
import { RedisService } from '../../redis/redis.service';
import { toMemoryRecord, type MemoryLine, type MemorySourceMessage } from './chat-memory.mapper';

/** Short-term memory forgets a chat a day after its last message. */
export const SHORT_TERM_MEMORY_TTL_SECONDS = 24 * 3600;

/**
 * Raw entries kept per chat. Twice the largest window, because a bot reply can be stored twice
 * (its send result and its self-listen echo); reads merge those copies.
 */
export const SHORT_TERM_MEMORY_MAX_ENTRIES = CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX * 2;

interface ShortTermEntry {
  msgId: string;
  cliMsgId: string | null;
  senderUid: string;
  senderName: string | null;
  isBot: boolean;
  text: string;
  /** Epoch milliseconds. */
  sentAt: number;
}

/** The Redis calls this service makes; a structural type so tests can pass a plain fake. */
export type ShortTermMemoryRedis = Pick<
  RedisService,
  'isReady' | 'lrange' | 'rpush' | 'ltrim' | 'expire' | 'del'
>;

function shortTermKey(channelId: string): string {
  return `zca:short_memory:${channelId}`;
}

function isShortTermEntry(value: unknown): value is ShortTermEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.msgId === 'string' &&
    (entry.cliMsgId === null || typeof entry.cliMsgId === 'string') &&
    typeof entry.senderUid === 'string' &&
    (entry.senderName === null || typeof entry.senderName === 'string') &&
    typeof entry.isBot === 'boolean' &&
    typeof entry.text === 'string' &&
    typeof entry.sentAt === 'number'
  );
}

function parseEntry(raw: string): ShortTermEntry | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isShortTermEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toEntry(
  channelId: string,
  data: MemorySourceMessage,
  isBot: boolean,
): ShortTermEntry | null {
  // The channel type only matters for Postgres rows; it is not kept here.
  const record = toMemoryRecord(channelId, 'user', data, { isBot });
  if (!record?.text) return null;
  return {
    msgId: record.msgId,
    cliMsgId: record.cliMsgId,
    senderUid: record.senderUid,
    senderName: record.senderName,
    isBot: record.isBot,
    text: record.text,
    sentAt: record.sentAt.getTime(),
  };
}

/**
 * Short-term chat memory: the latest messages of a ZCA chat, added to the LLM prompt so follow-ups
 * make sense. Independent of the long-term memory (Postgres): it lives in Redis, keeps a few dozen
 * messages and expires a day after the chat goes quiet. Whether a chat uses it is its
 * `chatMemory.shortTermEnabled` thread config, checked by the callers. Never throws.
 */
@Injectable()
export class ShortTermMemoryService {
  /** Used while Redis is unavailable; same cap and expiry as the Redis list. */
  private readonly localLists = new Map<string, { entries: ShortTermEntry[]; expiresAt: number }>();

  constructor(@Optional() @Inject(RedisService) private readonly redis?: ShortTermMemoryRedis) {}

  public async record(channelId: string, data: MemorySourceMessage): Promise<void> {
    const entry = toEntry(channelId, data, false);
    if (entry) await this.append(channelId, entry);
  }

  public async recordBotReply(channelId: string, msgId: string, text: string): Promise<void> {
    const entry = toEntry(channelId, { msgId, content: text, ts: Date.now() }, true);
    if (entry) await this.append(channelId, entry);
  }

  /** The latest `limit` messages, oldest first, without `excludeMsgId`. */
  public async getRecent(
    channelId: string,
    limit: number,
    excludeMsgId?: string,
  ): Promise<MemoryLine[]> {
    if (!channelId || limit <= 0) return [];
    const byMsgId = new Map<string, ShortTermEntry>();
    for (const entry of await this.read(channelId)) {
      if (entry.msgId === excludeMsgId) continue;
      const seen = byMsgId.get(entry.msgId);
      // A self-listen echo of a bot reply arrives as a member message; keep the bot flag.
      byMsgId.set(entry.msgId, seen ? { ...seen, isBot: seen.isBot || entry.isBot } : entry);
    }
    return [...byMsgId.values()]
      .sort((a, b) => a.sentAt - b.sentAt)
      .slice(-limit)
      .map((entry) => ({
        sentAt: new Date(entry.sentAt),
        senderName: entry.senderName,
        isBot: entry.isBot,
        text: entry.text,
      }));
  }

  /**
   * Drops a recalled message. The client id is not unique across senders, so it only matches
   * together with the sender (same rule as the long-term memory).
   */
  public async markRecalled(
    channelId: string,
    msgId: string,
    byClient?: { cliMsgId: string; senderUid: string },
  ): Promise<void> {
    if (!channelId || !msgId) return;
    const entries = await this.read(channelId);
    const kept = entries.filter(
      (entry) =>
        entry.msgId !== msgId &&
        !(
          byClient &&
          entry.cliMsgId === byClient.cliMsgId &&
          entry.senderUid === byClient.senderUid
        ),
    );
    if (kept.length !== entries.length) await this.replace(channelId, kept);
  }

  private async append(channelId: string, entry: ShortTermEntry): Promise<void> {
    if (this.redis?.isReady) {
      const key = shortTermKey(channelId);
      await this.redis.rpush(key, JSON.stringify(entry));
      await this.redis.ltrim(key, -SHORT_TERM_MEMORY_MAX_ENTRIES, -1);
      await this.redis.expire(key, SHORT_TERM_MEMORY_TTL_SECONDS);
      return;
    }
    const entries = [...this.readLocal(channelId), entry].slice(-SHORT_TERM_MEMORY_MAX_ENTRIES);
    this.writeLocal(channelId, entries);
  }

  private async read(channelId: string): Promise<ShortTermEntry[]> {
    if (this.redis?.isReady) {
      const rawList = await this.redis.lrange(shortTermKey(channelId), 0, -1);
      return rawList.map(parseEntry).filter((entry): entry is ShortTermEntry => entry !== null);
    }
    return this.readLocal(channelId);
  }

  private async replace(channelId: string, entries: readonly ShortTermEntry[]): Promise<void> {
    if (this.redis?.isReady) {
      const key = shortTermKey(channelId);
      await this.redis.del(key);
      if (entries.length === 0) return;
      await this.redis.rpush(key, ...entries.map((entry) => JSON.stringify(entry)));
      await this.redis.expire(key, SHORT_TERM_MEMORY_TTL_SECONDS);
      return;
    }
    if (entries.length === 0) {
      this.localLists.delete(channelId);
    } else {
      this.writeLocal(channelId, [...entries]);
    }
  }

  private readLocal(channelId: string): ShortTermEntry[] {
    const list = this.localLists.get(channelId);
    if (!list) return [];
    if (list.expiresAt <= Date.now()) {
      this.localLists.delete(channelId);
      return [];
    }
    return list.entries;
  }

  private writeLocal(channelId: string, entries: ShortTermEntry[]): void {
    this.localLists.set(channelId, {
      entries,
      expiresAt: Date.now() + SHORT_TERM_MEMORY_TTL_SECONDS * 1000,
    });
  }
}

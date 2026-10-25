import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZcaMemoryIngestionEntity } from '../../database/entities/zca-memory-ingestion.entity';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import {
  SHORT_TERM_IMAGE_TEXT_MAX_CHARS,
  toMemoryRecord,
  type ChatMemoryRecord,
  type MemoryChannelType,
  type MemoryLine,
  type MemorySourceMessage,
} from './chat-memory.mapper';
import {
  buildHitQuery,
  buildNeighbourQuery,
  type ChatMemorySearchParams,
} from './chat-memory.query';
import {
  LONG_TERM_INGEST_KINDS,
  SECRET_MESSAGE_PLACEHOLDER,
  SHORT_TERM_KINDS,
  type MemoryKind,
} from './memory-kind';

/** Upper bound of lines handed to the LLM for one memory question. */
export const MAX_MEMORY_LINES = 80;

export interface MemoryLineRow {
  id: string;
  sender_name: string | null;
  is_bot: boolean;
  text: string | null;
  sent_at: Date | string;
  hit_rank?: number | string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * Which memories of the thread are on when a row is written. Rows are stored while either is on;
 * without the long-term memory they expire (see `shortTermExpiry`).
 */
export interface MemoryRetention {
  longTerm: boolean;
}

export interface RecentMessagesOptions {
  limit: number;
  /** Only messages sent within this many days. */
  maxAgeDays: number;
  /** The message being answered (it is the prompt itself). */
  excludeMsgId?: string;
}

/** A tool call that was confirmed and ran successfully, written as one memory row. */
export interface ConfirmedActionMemory {
  /** Unique per pending action: `action:<code>:<createdAt>`. */
  actionId: string;
  /** `users.id` of whoever asked for the action (not whoever approved it). */
  requesterUid: string;
  requesterName: string | null;
  text: string;
}

interface RecentMessageRow {
  sender_uid: string | null;
  sender_name: string | null;
  is_bot: boolean;
  text: string | null;
  msg_type: string;
  sent_at: Date | string;
}

/**
 * Chat memory of ZCA threads, one store for both memories: stores messages with their
 * `MemoryKind`, forgets recalled ones, serves the short-term window and finds past messages for
 * the `SEARCH_CHAT_HISTORY` tool. Whether a thread uses memory is its `chatMemory` thread config,
 * checked by the callers (this module stays free of ZcaModule). Writes never throw.
 */
@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(
    @InjectRepository(ZcaMessageEntity)
    private readonly messageRepository: Repository<ZcaMessageEntity>,
    @Optional()
    @InjectRepository(ZcaMemoryIngestionEntity)
    private readonly ingestionRepository?: Repository<ZcaMemoryIngestionEntity>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /** Bot timezone; chat days sent to Cognee are counted in it. */
  public timeZone(): string {
    return (
      this.configService?.get<string>('timezone') ||
      process.env.DEFAULT_TIMEZONE ||
      'Asia/Ho_Chi_Minh'
    );
  }

  public async record(
    channelId: string,
    channelType: MemoryChannelType,
    data: MemorySourceMessage,
    retention: MemoryRetention,
  ): Promise<void> {
    const record = toMemoryRecord(channelId, channelType, data, { longTerm: retention.longTerm });
    if (!record) return;
    await this.insertIgnoringDuplicates([record]);
  }

  /**
   * The bot's own message with the kind it was sent as. If the self-listen echo was stored first
   * it is re-flagged as bot; a `secret` message never keeps its text (sign-in link and code).
   */
  public async recordBotReply(
    channelId: string,
    channelType: MemoryChannelType,
    msgId: string,
    text: string,
    kind: MemoryKind,
    retention: MemoryRetention,
  ): Promise<void> {
    const content = kind === 'secret' ? SECRET_MESSAGE_PLACEHOLDER : text;
    const record = toMemoryRecord(
      channelId,
      channelType,
      { msgId, content, ts: Date.now() },
      { isBot: true, memoryKind: kind, longTerm: retention.longTerm },
    );
    if (!record) return;
    try {
      await this.messageRepository
        .createQueryBuilder()
        .insert()
        .into(ZcaMessageEntity)
        .values(record)
        .orUpdate(['is_bot', 'memory_kind', 'text', 'content'], ['channel_id', 'msg_id'])
        .execute();
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not store bot reply in ${channelId}: ${errorMessage(err)}`,
      );
    }
  }

  /** A confirmed tool call that ran successfully; the only way a tool call reaches memory. */
  public async recordAction(
    channelId: string,
    channelType: MemoryChannelType,
    action: ConfirmedActionMemory,
    retention: MemoryRetention,
  ): Promise<void> {
    const requesterName =
      action.requesterName ?? (await this.lastSenderName(channelId, action.requesterUid));
    const record = toMemoryRecord(
      channelId,
      channelType,
      {
        msgId: action.actionId,
        content: action.text,
        ts: Date.now(),
        uidFrom: action.requesterUid,
        dName: requesterName ?? undefined,
      },
      { memoryKind: 'action', longTerm: retention.longTerm },
    );
    if (!record) return;
    await this.insertIgnoringDuplicates([record]);
  }

  /** The name a member last had in this chat (group members missing from the directory). */
  private async lastSenderName(channelId: string, senderUid: string): Promise<string | null> {
    if (!senderUid) return null;
    try {
      const rows: Array<{ sender_name: string | null }> = await this.messageRepository.query(
        `SELECT sender_name FROM zca_messages WHERE channel_id = $1 AND sender_uid = $2 ` +
          `AND sender_name IS NOT NULL AND NOT is_bot ORDER BY sent_at DESC LIMIT 1`,
        [channelId, senderUid],
      );
      return rows[0]?.sender_name ?? null;
    } catch {
      return null;
    }
  }

  /** Re-tags a member message, e.g. as `request` once it turned into a tool call. */
  public async setKind(channelId: string, msgId: string, kind: MemoryKind): Promise<void> {
    if (!channelId || !msgId) return;
    try {
      await this.messageRepository
        .createQueryBuilder()
        .update(ZcaMessageEntity)
        .set({ memoryKind: kind })
        .where('channel_id = :channelId', { channelId })
        .andWhere('msg_id = :msgId', { msgId })
        .andWhere('NOT is_bot')
        .execute();
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not tag ${msgId} in ${channelId}: ${errorMessage(err)}`);
    }
  }

  /**
   * The short-term window: latest conversation messages of the chat sent within `maxAgeDays`,
   * oldest first. Confirmation cards, notices and secrets are left out (see `SHORT_TERM_KINDS`).
   * Photo text is cut so one photo cannot fill the prompt. Never throws.
   */
  public async getRecent(channelId: string, options: RecentMessagesOptions): Promise<MemoryLine[]> {
    if (!channelId || options.limit <= 0) return [];
    try {
      const rows: RecentMessageRow[] = await this.messageRepository.query(
        `SELECT sender_uid, sender_name, is_bot, text, msg_type, sent_at FROM zca_messages ` +
          `WHERE channel_id = $1 AND recalled_at IS NULL AND text IS NOT NULL ` +
          `AND memory_kind = ANY($2::varchar[]) ` +
          `AND sent_at >= now() - make_interval(days => $3::int) ` +
          `AND ($4::varchar IS NULL OR msg_id <> $4::varchar) ` +
          `ORDER BY sent_at DESC LIMIT $5`,
        [
          channelId,
          [...SHORT_TERM_KINDS],
          Math.max(1, Math.round(options.maxAgeDays)),
          options.excludeMsgId ?? null,
          Math.round(options.limit),
        ],
      );
      return rows.reverse().map((row) => ({
        sentAt: row.sent_at instanceof Date ? row.sent_at : new Date(row.sent_at),
        senderUid: row.sender_uid,
        senderName: row.sender_name,
        isBot: Boolean(row.is_bot),
        text: shortTermText(row.msg_type, row.text ?? ''),
      }));
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not read recent messages of ${channelId}: ${errorMessage(err)}`,
      );
      return [];
    }
  }

  /**
   * Local days (in `timeZone`, before `beforeDay`) with messages for the long-term memory that are
   * not in Cognee yet: never sent, `stale` after a recall, or `failed` with attempts left. Newest
   * first, so last night's day goes before backfilled ones.
   */
  public async daysToIngest(
    channelId: string,
    options: { timeZone: string; beforeDay: string; limit: number; maxAttempts: number },
  ): Promise<string[]> {
    const rows: Array<{ day: string }> = await this.messageRepository.query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day FROM (` +
        `SELECT DISTINCT (sent_at AT TIME ZONE $2)::date AS day FROM zca_messages ` +
        `WHERE channel_id = $1 AND expires_at IS NULL AND (sent_at AT TIME ZONE $2)::date < $3::date` +
        `) d LEFT JOIN zca_memory_ingestions i ON i.channel_id = $1 AND i.day = d.day ` +
        `WHERE i.id IS NULL OR i.status IN ('pending', 'stale') ` +
        `OR (i.status = 'failed' AND i.attempts < $4) ` +
        `ORDER BY d.day DESC LIMIT $5`,
      [channelId, options.timeZone, options.beforeDay, options.maxAttempts, options.limit],
    );
    return rows.map((row) => row.day);
  }

  /** What one local day of a chat sends to Cognee: people's messages and confirmed actions. */
  public async dayLines(
    channelId: string,
    day: string,
    timeZone: string,
  ): Promise<Array<{ sentAt: Date; senderName: string | null; text: string }>> {
    const rows: Array<{ sent_at: Date | string; sender_name: string | null; text: string }> =
      await this.messageRepository.query(
        `SELECT sent_at, sender_name, text FROM zca_messages ` +
          `WHERE channel_id = $1 AND (sent_at AT TIME ZONE $2)::date = $3::date ` +
          `AND recalled_at IS NULL AND expires_at IS NULL AND text IS NOT NULL ` +
          `AND NOT is_bot AND memory_kind = ANY($4::varchar[]) ORDER BY sent_at ASC`,
        [channelId, timeZone, day, [...LONG_TERM_INGEST_KINDS]],
      );
    return rows.map((row) => ({
      sentAt: row.sent_at instanceof Date ? row.sent_at : new Date(row.sent_at),
      senderName: row.sender_name,
      text: row.text,
    }));
  }

  /** Members who wrote the most on the given local days (for learning facts about them). */
  public async activeMembers(
    channelId: string,
    days: readonly string[],
    timeZone: string,
    limit: number,
  ): Promise<Array<{ userId: string; name: string }>> {
    if (days.length === 0) return [];
    const rows: Array<{ sender_uid: string; sender_name: string | null }> =
      await this.messageRepository.query(
        `SELECT sender_uid, max(sender_name) AS sender_name FROM zca_messages ` +
          `WHERE channel_id = $1 AND (sent_at AT TIME ZONE $2)::date = ANY($3::date[]) ` +
          `AND recalled_at IS NULL AND NOT is_bot AND sender_uid <> '' ` +
          `AND memory_kind = ANY($4::varchar[]) ` +
          `GROUP BY sender_uid ORDER BY count(*) DESC LIMIT $5`,
        [channelId, timeZone, [...days], [...LONG_TERM_INGEST_KINDS], limit],
      );
    return rows.map((row) => ({ userId: row.sender_uid, name: row.sender_name || row.sender_uid }));
  }

  /** Deletes rows kept only for a short-term memory once past their expiry. */
  public async purgeExpired(now: Date = new Date()): Promise<number> {
    try {
      const result = await this.messageRepository
        .createQueryBuilder()
        .delete()
        .from(ZcaMessageEntity)
        .where('expires_at IS NOT NULL')
        .andWhere('expires_at < :now', { now })
        .execute();
      return result.affected ?? 0;
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not purge expired messages: ${errorMessage(err)}`);
      return 0;
    }
  }

  /**
   * Replaces a member photo's text with one that includes the text read from it; the generated
   * search vector follows. A photo recalled meanwhile stays erased.
   */
  public async attachImageText(channelId: string, msgId: string, text: string): Promise<void> {
    if (!channelId || !msgId || !text) return;
    try {
      await this.messageRepository
        .createQueryBuilder()
        .update(ZcaMessageEntity)
        .set({ text })
        .where('channel_id = :channelId', { channelId })
        .andWhere('msg_id = :msgId', { msgId })
        .andWhere('recalled_at IS NULL')
        .andWhere('NOT is_bot')
        .execute();
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not store image text in ${channelId}: ${errorMessage(err)}`,
      );
    }
  }

  /** Re-imports buffered messages (e.g. the Redis recent buffer); duplicates are skipped. */
  public async backfill(
    channelId: string,
    channelType: MemoryChannelType,
    messages: readonly MemorySourceMessage[],
    retention: MemoryRetention = { longTerm: true },
  ): Promise<number> {
    if (messages.length === 0) return 0;
    const records = messages
      .map((data) => toMemoryRecord(channelId, channelType, data, { longTerm: retention.longTerm }))
      .filter((record): record is ChatMemoryRecord => record !== null);
    if (records.length === 0) return 0;
    await this.insertIgnoringDuplicates(records);
    return records.length;
  }

  /**
   * A recalled message is forgotten: its content is erased, only the tombstone remains. The
   * client id is not unique across senders, so it only matches together with the sender. A day
   * already sent to Cognee is marked `stale`, so the nightly job sends it again without it.
   */
  public async markRecalled(
    channelId: string,
    msgId: string,
    byClient?: { cliMsgId: string; senderUid: string },
  ): Promise<void> {
    if (!channelId || !msgId) return;
    try {
      const result = await this.messageRepository
        .createQueryBuilder()
        .update(ZcaMessageEntity)
        .set({ recalledAt: () => 'now()', text: null, content: null })
        .where('channel_id = :channelId', { channelId })
        .andWhere(
          byClient
            ? '(msg_id = :msgId OR (cli_msg_id = :cliMsgId AND sender_uid = :senderUid))'
            : 'msg_id = :msgId',
          { msgId, cliMsgId: byClient?.cliMsgId, senderUid: byClient?.senderUid },
        )
        .returning(['sent_at'])
        .execute();
      const rows = Array.isArray(result.raw) ? (result.raw as Array<{ sent_at?: unknown }>) : [];
      const sentAts = rows
        .map((row) =>
          row.sent_at instanceof Date
            ? row.sent_at
            : typeof row.sent_at === 'string'
              ? new Date(row.sent_at)
              : null,
        )
        .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()));
      await this.markDaysStale(channelId, sentAts);
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not mark recall in ${channelId}: ${errorMessage(err)}`);
    }
  }

  private async markDaysStale(channelId: string, sentAts: readonly Date[]): Promise<void> {
    if (!this.ingestionRepository || sentAts.length === 0) return;
    const days = [...new Set(sentAts.map((date) => localDay(date, this.timeZone())))];
    await this.ingestionRepository
      .createQueryBuilder()
      .update(ZcaMemoryIngestionEntity)
      .set({ status: 'stale' })
      .where('channel_id = :channelId', { channelId })
      .andWhere('day IN (:...days)', { days })
      .andWhere("status = 'ingested'")
      .execute();
  }

  /**
   * Best matches with their neighbours, oldest first, at most `MAX_MEMORY_LINES` lines. Lines of
   * better-ranked hits are kept first when the cap is reached.
   */
  public async search(channelId: string, search: ChatMemorySearchParams): Promise<MemoryLine[]> {
    if (!channelId) return [];
    const hitQuery = buildHitQuery(channelId, search);
    if (!hitQuery) return [];

    const hitRows: Array<{ id: string }> = await this.messageRepository.query(
      hitQuery.sql,
      hitQuery.params,
    );
    if (hitRows.length === 0) return [];

    const neighbourQuery = buildNeighbourQuery(
      channelId,
      hitRows.map((row) => row.id),
    );
    const rows: MemoryLineRow[] = await this.messageRepository.query(
      neighbourQuery.sql,
      neighbourQuery.params,
    );
    return selectMemoryLines(rows, MAX_MEMORY_LINES);
  }

  private async insertIgnoringDuplicates(records: ChatMemoryRecord[]): Promise<void> {
    try {
      await this.messageRepository
        .createQueryBuilder()
        .insert()
        .into(ZcaMessageEntity)
        .values(records)
        .orIgnore()
        .execute();
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not store ${records.length} message(s) of ${records[0]?.channelId}: ${errorMessage(err)}`,
      );
    }
  }
}

/** `YYYY-MM-DD` of an instant in an IANA time zone. */
export function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Photo text read by OCR can be long; the window keeps only its start. */
function shortTermText(msgType: string, text: string): string {
  if (msgType !== 'chat.photo' || text.length <= SHORT_TERM_IMAGE_TEXT_MAX_CHARS) return text;
  return `${text.slice(0, SHORT_TERM_IMAGE_TEXT_MAX_CHARS)}…`;
}

/** Rows arrive ordered by hit rank; keep unique ids up to `max`, then sort chronologically. */
export function selectMemoryLines(rows: readonly MemoryLineRow[], max: number): MemoryLine[] {
  const picked = new Map<string, MemoryLine>();
  for (const row of rows) {
    if (picked.size >= max) break;
    if (picked.has(row.id) || !row.text) continue;
    picked.set(row.id, {
      sentAt: row.sent_at instanceof Date ? row.sent_at : new Date(row.sent_at),
      senderName: row.sender_name,
      isBot: Boolean(row.is_bot),
      text: row.text,
    });
  }
  return [...picked.values()].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

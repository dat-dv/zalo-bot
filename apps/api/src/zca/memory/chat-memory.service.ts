import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import {
  toMemoryRecord,
  type ChatMemoryRecord,
  type MemoryChannelType,
  type MemoryLine,
  type MemorySourceMessage,
} from './chat-memory.mapper';
import {
  AUTO_RECALL_HITS,
  AUTO_RECALL_MAX_DISTANCE,
  AUTO_RECALL_MAX_LINES,
  AUTO_RECALL_MIN_WORDS,
  AUTO_RECALL_WINDOW_HOURS,
  buildHitQuery,
  buildNeighbourQuery,
  buildVectorHitQuery,
  meaningfulWordCount,
  mergeRankedIds,
  type ChatMemorySearchParams,
  type VectorHitOptions,
} from './chat-memory.query';
import { LocalEmbedder, type TextEmbedder } from './long-term/local-embedder';
import { SECRET_MESSAGE_PLACEHOLDER, type MemoryKind } from './memory-kind';

/** Upper bound of lines handed to the LLM for one memory question. */
export const MAX_MEMORY_LINES = 80;
/**
 * The embedding of a message also reads the messages just before it, so a recall or a photo's
 * text changes the embeddings of the messages sent this soon after it too.
 */
export const EMBEDDING_CONTEXT_WINDOW_MS = 10 * 60 * 1000;

/** Called when the memory of a chat changed (stored, recalled or edited messages). */
export type ChatMemoryChangeListener = (channelId: string) => void;

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

/** A tool call that was confirmed and ran successfully, written as one memory row. */
export interface ConfirmedActionMemory {
  /** Unique per pending action: `action:<code>:<createdAt>`. */
  actionId: string;
  /** `users.id` of whoever asked for the action (not whoever approved it). */
  requesterUid: string;
  requesterName: string | null;
  text: string;
}

/**
 * Chat memory of ZCA threads (the long-term memory's store): stores messages with their
 * `MemoryKind`, forgets recalled ones and finds past messages for the `SEARCH_CHAT_HISTORY` tool
 * by keywords and by meaning (local embeddings, see `MemoryEmbeddingService`). Whether a thread
 * uses memory is its `chatMemory` thread config, checked by the callers (this module stays free of
 * ZcaModule). Writes never throw.
 */
@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);
  private readonly listeners = new Set<ChatMemoryChangeListener>();

  constructor(
    @InjectRepository(ZcaMessageEntity)
    private readonly messageRepository: Repository<ZcaMessageEntity>,
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(LocalEmbedder) private readonly embedder?: TextEmbedder,
  ) {}

  /** Subscribes to memory changes (the embedding scheduler); returns the unsubscribe function. */
  public onChange(listener: ChatMemoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyChange(channelId: string): void {
    for (const listener of this.listeners) {
      try {
        listener(channelId);
      } catch (err: unknown) {
        this.logger.warn(`[ChatMemory] Change listener failed: ${errorMessage(err)}`);
      }
    }
  }

  /** Bot timezone; date filters of memory questions are counted in it. */
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
  ): Promise<void> {
    const record = toMemoryRecord(channelId, channelType, data);
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
  ): Promise<void> {
    const content = kind === 'secret' ? SECRET_MESSAGE_PLACEHOLDER : text;
    const record = toMemoryRecord(
      channelId,
      channelType,
      { msgId, content, ts: Date.now() },
      { isBot: true, memoryKind: kind },
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
      { memoryKind: 'action' },
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

  /** Deletes the rows kept for the removed short-term memory once past their expiry. */
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
      const result = await this.messageRepository
        .createQueryBuilder()
        .update(ZcaMessageEntity)
        .set({ text })
        .where('channel_id = :channelId', { channelId })
        .andWhere('msg_id = :msgId', { msgId })
        .andWhere('recalled_at IS NULL')
        .andWhere('NOT is_bot')
        .returning('sent_at')
        .execute();
      // Embedded again with the photo's text.
      await this.forgetEmbeddingsFrom(channelId, sentAtsOf(result.raw));
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
  ): Promise<number> {
    if (messages.length === 0) return 0;
    const records = messages
      .map((data) => toMemoryRecord(channelId, channelType, data))
      .filter((record): record is ChatMemoryRecord => record !== null);
    if (records.length === 0) return 0;
    await this.insertIgnoringDuplicates(records);
    return records.length;
  }

  /**
   * A recalled message is forgotten: its content is erased, only the tombstone remains. The
   * client id is not unique across senders, so it only matches together with the sender. Its
   * embedding goes, and so do the embeddings that read it as context (embedded again without it).
   * Resolves when the recalled messages were sent (none when nothing matched or it failed).
   */
  public async markRecalled(
    channelId: string,
    msgId: string,
    byClient?: { cliMsgId: string; senderUid: string },
  ): Promise<Date[]> {
    if (!channelId || !msgId) return [];
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
        .returning('sent_at')
        .execute();
      const sentAts = sentAtsOf(result.raw);
      await this.forgetEmbeddingsFrom(channelId, sentAts);
      return sentAts;
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not mark recall in ${channelId}: ${errorMessage(err)}`);
      return [];
    }
  }

  /**
   * Deletes the embeddings of the messages sent at `sentAts` and of those whose context reads them
   * (sent up to `EMBEDDING_CONTEXT_WINDOW_MS` later), then tells the listeners so they are
   * embedded again.
   */
  private async forgetEmbeddingsFrom(channelId: string, sentAts: readonly Date[]): Promise<void> {
    if (sentAts.length === 0) return;
    for (const sentAt of sentAts) {
      await this.messageRepository.query(
        `DELETE FROM zca_message_embeddings e USING zca_messages m ` +
          `WHERE e.message_id = m.id AND m.channel_id = $1 ` +
          `AND m.sent_at >= $2::timestamptz AND m.sent_at <= $2::timestamptz + make_interval(secs => $3)`,
        [channelId, sentAt, EMBEDDING_CONTEXT_WINDOW_MS / 1000],
      );
    }
    this.notifyChange(channelId);
  }

  /**
   * Best matches with their neighbours, oldest first, at most `MAX_MEMORY_LINES` lines. Keyword
   * hits and meaning hits (`question` against the stored embeddings) are merged by rank fusion;
   * lines of better-ranked hits are kept first when the cap is reached. Without a usable
   * embedding model only the keyword search answers.
   */
  public async search(
    channelId: string,
    search: ChatMemorySearchParams & { question?: string },
  ): Promise<MemoryLine[]> {
    if (!channelId) return [];
    const [keywordIds, meaningIds] = await Promise.all([
      this.keywordHits(channelId, search),
      this.meaningHits(channelId, search),
    ]);
    const hitIds = mergeRankedIds([keywordIds, meaningIds], search.limit);
    if (hitIds.length === 0) return [];

    const neighbourQuery = buildNeighbourQuery(channelId, hitIds);
    const rows: MemoryLineRow[] = await this.messageRepository.query(
      neighbourQuery.sql,
      neighbourQuery.params,
    );
    return selectMemoryLines(rows, MAX_MEMORY_LINES);
  }

  /**
   * Lines of the last `AUTO_RECALL_WINDOW_HOURS` close in meaning to a message the bot answers as
   * free chat, with their neighbours, oldest first, at most `AUTO_RECALL_MAX_LINES`. Meaning only:
   * a chat message is full of common words, so keywords would pull in noise. Never throws: `[]`
   * when the message is too short to carry a topic, the model is unavailable or a query fails, so
   * the reply goes on as before.
   */
  public async recallRecent(
    channelId: string,
    options: { question: string; excludeMsgId?: string; timeZone: string; now?: Date },
  ): Promise<MemoryLine[]> {
    const question = options.question.trim();
    if (!channelId || meaningfulWordCount(question) < AUTO_RECALL_MIN_WORDS) return [];
    const now = options.now ?? new Date();
    try {
      const hitIds = await this.meaningHits(
        channelId,
        {
          keywords: '',
          question,
          limit: AUTO_RECALL_HITS,
          timeZone: options.timeZone,
          excludeMsgId: options.excludeMsgId,
        },
        {
          maxDistance: AUTO_RECALL_MAX_DISTANCE,
          since: new Date(now.getTime() - AUTO_RECALL_WINDOW_HOURS * 60 * 60 * 1000),
        },
      );
      if (hitIds.length === 0) return [];
      const neighbourQuery = buildNeighbourQuery(channelId, hitIds);
      const rows: MemoryLineRow[] = await this.messageRepository.query(
        neighbourQuery.sql,
        neighbourQuery.params,
      );
      return selectMemoryLines(rows, AUTO_RECALL_MAX_LINES);
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Auto recall failed in ${channelId}: ${errorMessage(err)}`);
      return [];
    }
  }

  private async keywordHits(channelId: string, search: ChatMemorySearchParams): Promise<string[]> {
    const query = buildHitQuery(channelId, search);
    if (!query) return [];
    const rows: Array<{ id: string }> = await this.messageRepository.query(query.sql, query.params);
    return rows.map((row) => row.id);
  }

  /** `[]` when there is no question, no model, or the search fails (keywords still answer). */
  private async meaningHits(
    channelId: string,
    search: ChatMemorySearchParams & { question?: string },
    options: VectorHitOptions = {},
  ): Promise<string[]> {
    const question = search.question?.trim() || search.keywords.trim();
    if (!this.embedder || !question) return [];
    try {
      const vectors = await this.embedder.embed([question]);
      if (!vectors?.[0]) return [];
      const query = buildVectorHitQuery(
        channelId,
        vectors[0],
        this.embedder.model,
        search,
        options,
      );
      const rows: Array<{ id: string }> = await this.messageRepository.query(
        query.sql,
        query.params,
      );
      return rows.map((row) => row.id);
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Meaning search failed in ${channelId}: ${errorMessage(err)}`);
      return [];
    }
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
      this.notifyChange(records[0].channelId);
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not store ${records.length} message(s) of ${records[0]?.channelId}: ${errorMessage(err)}`,
      );
    }
  }
}

/** `sent_at` of the rows an `UPDATE … RETURNING sent_at` touched. */
function sentAtsOf(raw: unknown): Date[] {
  const rows = Array.isArray(raw) ? (raw as Array<{ sent_at?: unknown }>) : [];
  return rows
    .map((row) =>
      row.sent_at instanceof Date
        ? row.sent_at
        : typeof row.sent_at === 'string'
          ? new Date(row.sent_at)
          : null,
    )
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()));
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

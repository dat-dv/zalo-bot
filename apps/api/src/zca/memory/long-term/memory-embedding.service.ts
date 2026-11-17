import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IChannelMemoryStatus } from '@zalobot/contracts';
import { Repository } from 'typeorm';
import { ZcaMessageEntity } from '../../../database/entities/zca-message.entity';
import { ThreadConfigService } from '../../thread-config.service';
import { EMBEDDING_CONTEXT_WINDOW_MS, ChatMemoryService } from '../chat-memory.service';
import { SEARCH_HIT_KINDS, sqlList, toVectorLiteral } from '../chat-memory.query';
import { EMBEDDING_CONTEXT_BEFORE, buildEmbeddingText, type EmbeddingLine } from './embedding-text';
import { LocalEmbedder, type TextEmbedder } from './local-embedder';

/** Messages read and embedded per round. */
export const EMBED_ROUND_SIZE = 128;
/** Messages embedded per run at most (a backfill of a big chat continues on the next run). */
export const EMBED_RUN_LIMIT = 5000;

/** What `/sync` did in one chat. */
export interface MemorySyncResult {
  embedded: number;
  /** The embedding model could not be loaded, nothing was embedded. */
  unavailable: boolean;
}

interface PendingRow {
  id: string;
  channel_id: string;
  sender_name: string | null;
  text: string;
  context: unknown;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/** The `context` JSON column of the pending query: older messages first. */
export function readContextLines(value: unknown): EmbeddingLine[] {
  if (!Array.isArray(value)) return [];
  const lines: EmbeddingLine[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.text !== 'string' || !row.text) continue;
    lines.push({
      senderName: typeof row.sender_name === 'string' ? row.sender_name : null,
      text: row.text,
    });
  }
  return lines;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Long-term memory ingest: every message that may be a memory hit (people's chat, requests and
 * confirmed actions of a listened chat with long-term memory on) gets one local embedding in
 * `zca_message_embeddings`, so questions find it by meaning. No LLM call: the model runs inside
 * the API. Messages without an embedding (new, recalled neighbours, photos whose text was just
 * read, or rows of another model) are picked up by the next run; nothing is ever marked failed.
 * Never throws.
 */
@Injectable()
export class MemoryEmbeddingService {
  private readonly logger = new Logger(MemoryEmbeddingService.name);

  constructor(
    private readonly threadConfigService: ThreadConfigService,
    private readonly chatMemory: ChatMemoryService,
    @InjectRepository(ZcaMessageEntity)
    private readonly messageRepository: Repository<ZcaMessageEntity>,
    @Inject(LocalEmbedder) private readonly embedder: TextEmbedder,
  ) {}

  /** Listened chats with long-term memory on. */
  public memoryChannels(): string[] {
    return this.threadConfigService
      .getAllConfigs()
      .filter((config) => config.isListened && config.chatMemory?.enabled)
      .map((config) => config.threadId);
  }

  /** Nightly: purges the rows of the removed short-term memory, then embeds every chat. */
  public async runNightly(): Promise<void> {
    const purged = await this.chatMemory.purgeExpired();
    if (purged > 0) this.logger.log(`[MemoryEmbedding] Purged ${purged} expired short-term rows`);
    await this.embedPending(this.memoryChannels());
  }

  /** New messages of one chat; nothing when the chat has no long-term memory. */
  public async runChannel(channelId: string): Promise<MemorySyncResult | null> {
    const config = await this.threadConfigService.findStoredConfig(channelId);
    if (!config?.isListened || !config.chatMemory?.enabled) return null;
    const embedded = await this.embedPending([channelId]);
    return { embedded: embedded ?? 0, unavailable: embedded === null };
  }

  /**
   * Embeds the messages of `channelIds` that have no embedding of the current model, oldest
   * first, up to `limit`. Resolves how many were written, or `null` when the model is unavailable.
   */
  public async embedPending(
    channelIds: readonly string[],
    limit: number = EMBED_RUN_LIMIT,
  ): Promise<number | null> {
    if (channelIds.length === 0) return 0;
    let written = 0;
    while (written < limit) {
      let rows: PendingRow[];
      try {
        rows = await this.pendingRows(channelIds, Math.min(EMBED_ROUND_SIZE, limit - written));
      } catch (err: unknown) {
        this.logger.warn(`[MemoryEmbedding] Could not read pending messages: ${errorMessage(err)}`);
        break;
      }
      if (rows.length === 0) break;
      const texts = rows.map((row) =>
        buildEmbeddingText(
          { senderName: row.sender_name, text: row.text },
          readContextLines(row.context),
        ),
      );
      const vectors = await this.embedder.embed(texts);
      if (!vectors) return written > 0 ? written : null;
      try {
        await this.store(rows, vectors);
      } catch (err: unknown) {
        this.logger.warn(`[MemoryEmbedding] Could not store embeddings: ${errorMessage(err)}`);
        break;
      }
      written += rows.length;
      if (rows.length < EMBED_ROUND_SIZE) break;
    }
    if (written > 0) {
      this.logger.log(
        `[MemoryEmbedding] Embedded ${written} message(s) in ${channelIds.length} chat(s)`,
      );
    }
    return written;
  }

  /** How far one chat is embedded (dashboard). */
  public async status(channelId: string): Promise<IChannelMemoryStatus> {
    const rows: Array<{ embedded: unknown; pending: unknown; last: Date | string | null }> =
      await this.messageRepository.query(
        `SELECT count(e.message_id) AS embedded, count(*) - count(e.message_id) AS pending, ` +
          `max(e.created_at) AS last FROM zca_messages m ` +
          `LEFT JOIN zca_message_embeddings e ON e.message_id = m.id AND e.model = $2 ` +
          `WHERE m.channel_id = $1 AND ${this.memoryRowConditions('m')}`,
        [channelId, this.embedder.model],
      );
    const row = rows[0];
    const last = row?.last ? new Date(row.last) : null;
    return {
      embedder: this.embedder.state(),
      embeddedMessages: count(row?.embedded),
      pendingMessages: count(row?.pending),
      lastEmbeddedAt: last && !Number.isNaN(last.getTime()) ? last.toISOString() : null,
    };
  }

  /** Rows that may be memory hits, as the search counts them. */
  private memoryRowConditions(alias: string): string {
    return (
      `${alias}.recalled_at IS NULL AND ${alias}.expires_at IS NULL AND ${alias}.text IS NOT NULL ` +
      `AND NOT ${alias}.is_bot AND ${alias}.memory_kind IN (${sqlList(SEARCH_HIT_KINDS)})`
    );
  }

  private async pendingRows(channelIds: readonly string[], limit: number): Promise<PendingRow[]> {
    return this.messageRepository.query(
      `SELECT m.id, m.channel_id, m.sender_name, m.text, ` +
        `COALESCE((SELECT json_agg(c ORDER BY c.sent_at) FROM (` +
        `SELECT p.sender_name, p.text, p.sent_at FROM zca_messages p ` +
        `WHERE p.channel_id = m.channel_id AND p.sent_at < m.sent_at ` +
        `AND p.sent_at >= m.sent_at - make_interval(secs => $4) AND ${this.memoryRowConditions('p')} ` +
        `ORDER BY p.sent_at DESC LIMIT ${EMBEDDING_CONTEXT_BEFORE}) c), '[]'::json) AS context ` +
        `FROM zca_messages m ` +
        `WHERE m.channel_id = ANY($1::varchar[]) AND ${this.memoryRowConditions('m')} ` +
        `AND NOT EXISTS (SELECT 1 FROM zca_message_embeddings e ` +
        `WHERE e.message_id = m.id AND e.model = $2) ` +
        `ORDER BY m.sent_at ASC LIMIT $3`,
      [[...channelIds], this.embedder.model, limit, EMBEDDING_CONTEXT_WINDOW_MS / 1000],
    );
  }

  /** Upserts; a message deleted meanwhile is skipped instead of failing the batch. */
  private async store(rows: readonly PendingRow[], vectors: readonly number[][]): Promise<void> {
    await this.messageRepository.query(
      `INSERT INTO zca_message_embeddings (message_id, channel_id, embedding, model) ` +
        `SELECT t.id, t.channel_id, t.embedding::vector, $4 ` +
        `FROM unnest($1::uuid[], $2::varchar[], $3::text[]) AS t(id, channel_id, embedding) ` +
        `WHERE EXISTS (SELECT 1 FROM zca_messages m WHERE m.id = t.id) ` +
        `ON CONFLICT (message_id) DO UPDATE SET embedding = EXCLUDED.embedding, ` +
        `model = EXCLUDED.model, created_at = now()`,
      [
        rows.map((row) => row.id),
        rows.map((row) => row.channel_id),
        vectors.map((vector) => toVectorLiteral(vector)),
        this.embedder.model,
      ],
    );
  }
}

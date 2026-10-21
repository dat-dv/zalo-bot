import { Injectable, Logger } from '@nestjs/common';
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
  buildHitQuery,
  buildNeighbourQuery,
  type ChatMemorySearchParams,
} from './chat-memory.query';

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
 * Chat memory of listened ZCA threads: stores every message, forgets recalled ones and finds past
 * messages for the `SEARCH_CHAT_HISTORY` tool. Writes never throw: memory must not break replies.
 */
@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(
    @InjectRepository(ZcaMessageEntity)
    private readonly messageRepository: Repository<ZcaMessageEntity>,
    private readonly configService: ConfigService,
  ) {}

  public isEnabled(): boolean {
    return this.configService.get<boolean>('chatMemory.enabled') === true;
  }

  public getContextWindowSize(): number {
    const size = this.configService.get<number>('chatMemory.contextWindow') ?? 0;
    return Number.isFinite(size) && size > 0 ? Math.floor(size) : 0;
  }

  public getSearchLimit(): number {
    const limit = this.configService.get<number>('chatMemory.searchLimit') ?? 15;
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 15;
  }

  public async record(
    channelId: string,
    channelType: MemoryChannelType,
    data: MemorySourceMessage,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    const record = toMemoryRecord(channelId, channelType, data);
    if (!record) return;
    await this.insertIgnoringDuplicates([record]);
  }

  /** The bot's own reply; if the self-listen echo was stored first, it is re-flagged as bot. */
  public async recordBotReply(
    channelId: string,
    channelType: MemoryChannelType,
    msgId: string,
    text: string,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    const record = toMemoryRecord(
      channelId,
      channelType,
      { msgId, content: text, ts: Date.now() },
      { isBot: true },
    );
    if (!record) return;
    try {
      await this.messageRepository
        .createQueryBuilder()
        .insert()
        .into(ZcaMessageEntity)
        .values(record)
        .orUpdate(['is_bot'], ['channel_id', 'msg_id'])
        .execute();
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not store bot reply in ${channelId}: ${errorMessage(err)}`,
      );
    }
  }

  /** Re-imports buffered messages (e.g. the Redis recent buffer); duplicates are skipped. */
  public async backfill(
    channelId: string,
    channelType: MemoryChannelType,
    messages: readonly MemorySourceMessage[],
  ): Promise<number> {
    if (!this.isEnabled() || messages.length === 0) return 0;
    const records = messages
      .map((data) => toMemoryRecord(channelId, channelType, data))
      .filter((record): record is ChatMemoryRecord => record !== null);
    if (records.length === 0) return 0;
    await this.insertIgnoringDuplicates(records);
    return records.length;
  }

  /** A recalled message is forgotten: its content is erased, only the tombstone remains. */
  public async markRecalled(channelId: string, msgId: string, cliMsgId?: string): Promise<void> {
    if (!this.isEnabled() || !channelId || (!msgId && !cliMsgId)) return;
    try {
      await this.messageRepository
        .createQueryBuilder()
        .update(ZcaMessageEntity)
        .set({ recalledAt: () => 'now()', text: null, content: null })
        .where('channel_id = :channelId', { channelId })
        .andWhere('(msg_id = :msgId OR cli_msg_id = :cliMsgId)', {
          msgId: msgId || '',
          cliMsgId: cliMsgId || '',
        })
        .execute();
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not mark recall in ${channelId}: ${errorMessage(err)}`);
    }
  }

  /** The latest messages of a channel, oldest first, without `excludeMsgId`. */
  public async getRecentWindow(
    channelId: string,
    limit: number,
    excludeMsgId?: string,
  ): Promise<MemoryLine[]> {
    if (!this.isEnabled() || !channelId || limit <= 0) return [];
    try {
      const query = this.messageRepository
        .createQueryBuilder('m')
        .select(['m.id', 'm.senderName', 'm.isBot', 'm.text', 'm.sentAt'])
        .where('m.channel_id = :channelId', { channelId })
        .andWhere('m.recalled_at IS NULL')
        .andWhere('m.text IS NOT NULL')
        .orderBy('m.sentAt', 'DESC')
        .limit(limit);
      if (excludeMsgId) {
        query.andWhere('m.msg_id <> :excludeMsgId', { excludeMsgId });
      }
      const rows = await query.getMany();
      return rows.reverse().map((row) => ({
        sentAt: row.sentAt,
        senderName: row.senderName ?? null,
        isBot: row.isBot,
        text: row.text ?? '',
      }));
    } catch (err: unknown) {
      this.logger.warn(
        `[ChatMemory] Could not read recent window of ${channelId}: ${errorMessage(err)}`,
      );
      return [];
    }
  }

  /**
   * Best matches with their neighbours, oldest first, at most `MAX_MEMORY_LINES` lines. Lines of
   * better-ranked hits are kept first when the cap is reached.
   */
  public async search(channelId: string, search: ChatMemorySearchParams): Promise<MemoryLine[]> {
    if (!this.isEnabled() || !channelId) return [];
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

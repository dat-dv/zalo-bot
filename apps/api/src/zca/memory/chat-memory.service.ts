import { Injectable, Logger } from '@nestjs/common';
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
 * Chat memory of ZCA threads: stores messages, forgets recalled ones and finds past messages for
 * the `SEARCH_CHAT_HISTORY` tool. Whether a thread uses memory is its `chatMemory` thread config,
 * checked by the callers (this module stays free of ZcaModule). Writes never throw.
 */
@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(
    @InjectRepository(ZcaMessageEntity)
    private readonly messageRepository: Repository<ZcaMessageEntity>,
  ) {}

  public async record(
    channelId: string,
    channelType: MemoryChannelType,
    data: MemorySourceMessage,
  ): Promise<void> {
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
   * client id is not unique across senders, so it only matches together with the sender.
   */
  public async markRecalled(
    channelId: string,
    msgId: string,
    byClient?: { cliMsgId: string; senderUid: string },
  ): Promise<void> {
    if (!channelId || !msgId) return;
    try {
      await this.messageRepository
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
        .execute();
    } catch (err: unknown) {
      this.logger.warn(`[ChatMemory] Could not mark recall in ${channelId}: ${errorMessage(err)}`);
    }
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

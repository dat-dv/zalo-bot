import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { IChannelMemoryStatus, ThreadBotConfig } from '@zalobot/contracts';
import { Repository } from 'typeorm';
import { ZcaMemoryIngestionEntity } from '../../../database/entities/zca-memory-ingestion.entity';
import { ZcaMemorySegmentEntity } from '../../../database/entities/zca-memory-segment.entity';
import { LlmService } from '../../../llm/llm.service';
import { ThreadConfigService } from '../../thread-config.service';
import { ChatMemoryService, localDay } from '../chat-memory.service';
import { LearnedFactsService, type LearnedFactSubject } from '../learned-facts.service';
import { buildChatDayDocument, chatDayFileName, chatSegmentFileName } from './chat-day-document';
import { CogneeClient, cogneeDatasetName } from './cognee.client';
import {
  LEARNED_FACTS_SYSTEM_INSTRUCTION,
  buildLearnedFactsPrompt,
  factRecallQuery,
  parseLearnedFacts,
} from './learned-facts.prompt';

/** Chat days sent per chat per night: last night plus a few backfilled or retried ones. */
export const INGEST_DAYS_PER_NIGHT = 8;
/** A failing day is retried on this many nights, then left alone. */
export const INGEST_MAX_ATTEMPTS = 5;
/** Members whose facts are learned again per chat per night (most active first). */
export const LEARN_MEMBERS_PER_NIGHT = 10;

/** What `/sync` sent: past days that went in and messages of today in the new segment. */
export interface MemorySyncResult {
  days: number;
  todayLines: number;
  /** Today's segment could not be sent (a failing past day is retried as every night). */
  failed: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * Long-term memory ingest into Cognee (dataset `zca-<channelId>`).
 * - Nightly: for each listened chat with long-term memory on, every chat day not yet in Cognee
 *   goes in as one dated document (its segments forgotten first), days marked `stale` after a
 *   recall are resent, then the facts about the bot and the most active members are learned
 *   again. Also purges the rows left by the removed short-term memory. Chats one after the other
 *   so a free LLM behind the router is not flooded. Never throws per chat.
 * - During the day: the messages of today not in a segment yet go in as one more segment once the
 *   chat went quiet (`MemorySegmentScheduler`) or on `/sync`.
 */
@Injectable()
export class MemoryIngestService {
  private readonly logger = new Logger(MemoryIngestService.name);

  constructor(
    private readonly threadConfigService: ThreadConfigService,
    private readonly chatMemory: ChatMemoryService,
    private readonly cognee: CogneeClient,
    private readonly learnedFacts: LearnedFactsService,
    private readonly llmService: LlmService,
    @InjectRepository(ZcaMemoryIngestionEntity)
    private readonly ingestionRepository: Repository<ZcaMemoryIngestionEntity>,
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    @InjectRepository(ZcaMemorySegmentEntity)
    private readonly segmentRepository?: Repository<ZcaMemorySegmentEntity>,
  ) {}

  public async runNightly(now: Date = new Date()): Promise<void> {
    const purged = await this.chatMemory.purgeExpired(now);
    if (purged > 0) this.logger.log(`[MemoryIngest] Purged ${purged} expired short-term rows`);
    if (!this.cognee.isEnabled()) return;

    const configs = this.threadConfigService
      .getAllConfigs()
      .filter((config) => config.isListened && config.chatMemory?.enabled);
    for (const config of configs) {
      try {
        await this.ingestChannel(config, now);
      } catch (err: unknown) {
        this.logger.warn(
          `[MemoryIngest] Chat ${config.threadId} skipped tonight: ${errorMessage(err)}`,
        );
      }
    }
  }

  /**
   * Sends the pending days of one chat, then learns facts when anything new went in (unless
   * `learn` is off, as for `/sync`).
   */
  public async ingestChannel(
    config: ThreadBotConfig,
    now: Date = new Date(),
    options: { learn?: boolean } = {},
  ): Promise<string[]> {
    const timeZone = this.chatMemory.timeZone();
    const channelId = config.threadId;
    const days = await this.chatMemory.daysToIngest(channelId, {
      timeZone,
      beforeDay: localDay(now, timeZone),
      limit: INGEST_DAYS_PER_NIGHT,
      maxAttempts: INGEST_MAX_ATTEMPTS,
    });
    const ingested: string[] = [];
    for (const day of days) {
      if (await this.ingestDay(config, day, timeZone)) ingested.push(day);
    }
    if (ingested.length > 0 && config.chatMemory.learnPeople && options.learn !== false) {
      await this.learnChannel(channelId, ingested, timeZone);
    }
    return ingested;
  }

  /**
   * Sends the messages of today not in a segment yet as one more segment. Resolves how many lines
   * went in: 0 when there was nothing new, `null` when Cognee could not take it (the next run
   * picks them up again, nothing is marked).
   */
  public async ingestSegment(
    config: ThreadBotConfig,
    now: Date = new Date(),
  ): Promise<number | null> {
    if (!this.segmentRepository || !this.cognee.isEnabled() || !config.chatMemory?.enabled) {
      return 0;
    }
    const timeZone = this.chatMemory.timeZone();
    const channelId = config.threadId;
    const day = localDay(now, timeZone);
    const last = await this.segmentRepository.findOne({
      where: { channelId, day },
      order: { toSentAt: 'DESC' },
    });
    const lines = await this.chatMemory.dayLines(channelId, day, timeZone, last?.toSentAt);
    if (lines.length === 0) return 0;

    const lastSentAt = lines[lines.length - 1].sentAt;
    const result = await this.cognee.remember(
      cogneeDatasetName(channelId),
      chatSegmentFileName(channelId, day, lastSentAt),
      buildChatDayDocument(config.threadName || channelId, day, lines, timeZone, {
        segment: true,
      }),
    );
    if (!result) {
      this.logger.warn(`[MemoryIngest] Cognee did not take today's segment of chat ${channelId}`);
      return null;
    }
    await this.segmentRepository.save(
      this.segmentRepository.create({
        channelId,
        day,
        fromSentAt: lines[0].sentAt,
        toSentAt: lastSentAt,
        cogneeDataId: `${result.datasetId}:${result.dataId}`,
      }),
    );
    this.logger.log(`[MemoryIngest] Sent ${lines.length} new lines of today for chat ${channelId}`);
    return lines.length;
  }

  /** `/sync`: past days still pending or failed, then today's new messages; no fact learning. */
  public async sync(config: ThreadBotConfig, now: Date = new Date()): Promise<MemorySyncResult> {
    const days = await this.ingestChannel(config, now, { learn: false });
    const todayLines = await this.ingestSegment(config, now);
    return { days: days.length, todayLines: todayLines ?? 0, failed: todayLines === null };
  }

  /**
   * The `segment` job: today's new messages of a listened chat with long-term memory. After a
   * recall of a message of today (`resetToday`) today's segments are forgotten first, so today is
   * sent again without it.
   */
  public async runSegment(
    channelId: string,
    options: { resetToday?: boolean } = {},
    now: Date = new Date(),
  ): Promise<number | null> {
    const config = await this.threadConfigService.findStoredConfig(channelId);
    if (!config?.isListened || !config.chatMemory?.enabled) return 0;
    if (options.resetToday) {
      await this.forgetSegments(channelId, localDay(now, this.chatMemory.timeZone()));
    }
    return this.ingestSegment(config, now);
  }

  /** The `sync` job; `null` when the chat has no long-term memory. */
  public async runSync(
    channelId: string,
    now: Date = new Date(),
  ): Promise<MemorySyncResult | null> {
    const config = await this.threadConfigService.findStoredConfig(channelId);
    if (!config?.isListened || !config.chatMemory?.enabled) return null;
    return this.sync(config, now);
  }

  /** Where the nightly job stands for one chat (dashboard). */
  public async status(channelId: string, now: Date = new Date()): Promise<IChannelMemoryStatus> {
    const rows = await this.ingestionRepository.find({ where: { channelId } });
    const ingested = rows
      .filter((row) => row.status === 'ingested')
      .map((row) => row.day)
      .sort();
    const failed = rows.filter((row) => row.status === 'failed');
    const lastFailed = failed.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return {
      cogneeEnabled: this.cognee.isEnabled(),
      lastIngestedDay: ingested.length > 0 ? ingested[ingested.length - 1] : null,
      failedDays: failed.length,
      lastError: lastFailed?.lastError ?? null,
      todayIngestedUntil: (await this.todayIngestedUntil(channelId, now))?.toISOString() ?? null,
    };
  }

  private async ingestDay(
    config: ThreadBotConfig,
    day: string,
    timeZone: string,
  ): Promise<boolean> {
    const channelId = config.threadId;
    const row =
      (await this.ingestionRepository.findOne({ where: { channelId, day } })) ??
      this.ingestionRepository.create({ channelId, day, status: 'pending', attempts: 0 });

    // The whole day replaces the segments sent during it and its old document, whose graph
    // nodes go with them. Stored as `<datasetId>:<dataId>`: both are needed to forget an item.
    await this.forgetSegments(channelId, day);
    if (row.cogneeDataId) {
      const [datasetId, dataId] = row.cogneeDataId.split(':');
      if (datasetId && dataId) await this.cognee.forget(datasetId, dataId);
      row.cogneeDataId = null;
    }

    const lines = await this.chatMemory.dayLines(channelId, day, timeZone);
    const document = buildChatDayDocument(config.threadName || channelId, day, lines, timeZone);
    if (!document) {
      row.status = 'ingested';
      row.ingestedAt = new Date();
      row.lastError = null;
      await this.ingestionRepository.save(row);
      return false;
    }

    const result = await this.cognee.remember(
      cogneeDatasetName(channelId),
      chatDayFileName(channelId, day),
      document,
    );
    if (!result) {
      row.status = 'failed';
      row.attempts += 1;
      row.lastError = 'Cognee không nạp được ngày này (xem log API).';
      await this.ingestionRepository.save(row);
      return false;
    }
    row.status = 'ingested';
    row.cogneeDataId = `${result.datasetId}:${result.dataId}`;
    row.ingestedAt = new Date();
    row.lastError = null;
    await this.ingestionRepository.save(row);
    this.logger.log(`[MemoryIngest] Sent ${lines.length} lines of ${day} for chat ${channelId}`);
    return true;
  }

  private async forgetSegments(channelId: string, day: string): Promise<void> {
    if (!this.segmentRepository) return;
    const segments = await this.segmentRepository.find({ where: { channelId, day } });
    for (const segment of segments) {
      const [datasetId, dataId] = segment.cogneeDataId.split(':');
      if (datasetId && dataId) await this.cognee.forget(datasetId, dataId);
    }
    if (segments.length > 0) await this.segmentRepository.delete({ channelId, day });
  }

  /** Last message of today already in Cognee through a segment. */
  private async todayIngestedUntil(channelId: string, now: Date): Promise<Date | null> {
    if (!this.segmentRepository) return null;
    const last = await this.segmentRepository.findOne({
      where: { channelId, day: localDay(now, this.chatMemory.timeZone()) },
      order: { toSentAt: 'DESC' },
    });
    return last?.toSentAt ?? null;
  }

  private async learnChannel(
    channelId: string,
    days: readonly string[],
    timeZone: string,
  ): Promise<void> {
    const botName =
      this.configService?.get<string>('zalo.botName') || process.env.BOT_NAME || 'Bot';
    const members = await this.chatMemory.activeMembers(
      channelId,
      days,
      timeZone,
      LEARN_MEMBERS_PER_NIGHT,
    );
    const subjects: LearnedFactSubject[] = [
      { kind: 'bot', userId: null, name: botName },
      ...members.map((member) => ({
        kind: 'member' as const,
        userId: member.userId,
        name: member.name,
      })),
    ];
    for (const subject of subjects) {
      try {
        await this.learnSubject(channelId, subject, botName);
      } catch (err: unknown) {
        this.logger.warn(
          `[MemoryIngest] Could not learn about ${subject.name} in ${channelId}: ${errorMessage(err)}`,
        );
      }
    }
  }

  private async learnSubject(
    channelId: string,
    subject: LearnedFactSubject,
    botName: string,
  ): Promise<void> {
    const contexts = await this.cognee.recallContext(
      cogneeDatasetName(channelId),
      factRecallQuery(subject, botName),
    );
    // Nothing found keeps what was learned before.
    if (contexts.length === 0) return;
    const deleted = await this.learnedFacts.deletedFor(channelId, subject);
    const response = await this.llmService.generate(
      buildLearnedFactsPrompt(subject, botName, contexts, deleted),
      undefined,
      LEARNED_FACTS_SYSTEM_INSTRUCTION,
    );
    if (response.failed) return;
    const facts = parseLearnedFacts(response.text);
    await this.learnedFacts.replaceForSubject(channelId, subject, facts);
  }
}

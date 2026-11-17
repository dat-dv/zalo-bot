import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LEARNED_FACTS_LIMITS } from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { matchesAllWords } from './memory-text.util';

/**
 * Facts learned earlier (by the removed nightly LLM job) about the bot and the members of a chat.
 * Nothing learns new ones any more: the long-term memory makes no LLM call. The kept facts are
 * still used in the prompt and can be deleted (soft delete).
 */
@Injectable()
export class LearnedFactsService {
  private readonly logger = new Logger(LearnedFactsService.name);

  constructor(
    @InjectRepository(ZcaLearnedFactEntity)
    private readonly factRepository: Repository<ZcaLearnedFactEntity>,
  ) {}

  public async listActive(channelId: string): Promise<ZcaLearnedFactEntity[]> {
    if (!channelId) return [];
    try {
      return await this.factRepository.find({
        where: { channelId, deletedAt: IsNull() },
        order: { subjectKind: 'ASC', subjectName: 'ASC', learnedAt: 'ASC' },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[LearnedFacts] Could not read facts of ${channelId}: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      return [];
    }
  }

  /**
   * Facts for one prompt: only the ones about the bot, at most `LEARNED_FACTS_LIMITS.MAX_IN_PROMPT`.
   * Facts about members stay out of the prompt: the removed nightly job stored them unfiltered
   * (one held a member's ID card number, read out in a group on 2026-11-17), they are frozen and
   * may be wrong. They can still be listed and deleted on the dashboard.
   */
  public async forPrompt(channelId: string): Promise<ZcaLearnedFactEntity[]> {
    const facts = await this.listActive(channelId);
    return facts
      .filter((fact) => fact.subjectKind === 'bot')
      .slice(0, LEARNED_FACTS_LIMITS.MAX_IN_PROMPT);
  }

  /** Soft-deletes facts of the chat; `deletedBy` is the member or dashboard user who asked. */
  public async remove(
    channelId: string,
    factIds: readonly string[],
    deletedBy: string | null,
  ): Promise<number> {
    if (!channelId || factIds.length === 0) return 0;
    const result = await this.factRepository.update(
      { channelId, id: In([...factIds]), deletedAt: IsNull() },
      { deletedAt: new Date(), deletedBy },
    );
    return result.affected ?? 0;
  }

  /** Active facts whose text or subject contains every word of `query`. */
  public async findMatching(channelId: string, query: string): Promise<ZcaLearnedFactEntity[]> {
    return (await this.listActive(channelId)).filter(
      (fact) =>
        matchesAllWords(fact.fact, query) ||
        matchesAllWords(`${fact.subjectName} ${fact.fact}`, query),
    );
  }
}

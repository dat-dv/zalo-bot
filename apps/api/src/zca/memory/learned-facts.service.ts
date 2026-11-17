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
   * Facts for one prompt: about the bot first, then about the given members in that order,
   * at most `LEARNED_FACTS_LIMITS.MAX_IN_PROMPT` lines.
   */
  public async forPrompt(
    channelId: string,
    memberIds: readonly string[],
  ): Promise<ZcaLearnedFactEntity[]> {
    const facts = await this.listActive(channelId);
    if (facts.length === 0) return [];
    const order = new Map(memberIds.map((id, index) => [id, index]));
    return facts
      .filter(
        (fact) =>
          fact.subjectKind === 'bot' ||
          (fact.subjectUserId !== null &&
            fact.subjectUserId !== undefined &&
            order.has(fact.subjectUserId)),
      )
      .sort((a, b) => rank(a, order) - rank(b, order))
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

function rank(fact: ZcaLearnedFactEntity, order: ReadonlyMap<string, number>): number {
  if (fact.subjectKind === 'bot') return -1;
  return order.get(fact.subjectUserId ?? '') ?? Number.MAX_SAFE_INTEGER;
}

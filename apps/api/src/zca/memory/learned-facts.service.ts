import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LEARNED_FACTS_LIMITS } from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import {
  ZcaLearnedFactEntity,
  type LearnedFactSubjectKind,
} from '../../database/entities/zca-learned-fact.entity';
import { collapseWhitespace, foldVietnamese, matchesAllWords } from './memory-text.util';

/** Who a fact is about. */
export interface LearnedFactSubject {
  kind: LearnedFactSubjectKind;
  /** `users.id`; null for the bot. */
  userId: string | null;
  name: string;
}

/**
 * Facts the nightly job learned from a chat about the bot and its members. They are used in the
 * prompt at once and can be deleted; a deleted fact keeps its row so it is not learned again.
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

  /** Texts deleted for a subject: the nightly job is told not to learn them again. */
  public async deletedFor(channelId: string, subject: LearnedFactSubject): Promise<string[]> {
    const rows = await this.factRepository.find({
      where: {
        channelId,
        subjectKind: subject.kind,
        subjectUserId: subject.userId ?? IsNull(),
      },
    });
    return rows.filter((row) => row.deletedAt).map((row) => row.fact);
  }

  /**
   * Replaces the active facts of a subject with what was learned now. Facts equal to a deleted
   * one (accent-insensitive) are dropped, so a deletion sticks.
   */
  public async replaceForSubject(
    channelId: string,
    subject: LearnedFactSubject,
    facts: readonly string[],
  ): Promise<number> {
    const deleted = new Set(
      (await this.deletedFor(channelId, subject)).map((fact) => foldVietnamese(fact)),
    );
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const raw of facts) {
      const fact = collapseWhitespace(raw).slice(0, LEARNED_FACTS_LIMITS.MAX_CHARS);
      const key = foldVietnamese(fact);
      if (!key || deleted.has(key) || seen.has(key)) continue;
      seen.add(key);
      kept.push(fact);
      if (kept.length >= LEARNED_FACTS_LIMITS.MAX_PER_SUBJECT) break;
    }
    await this.factRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(ZcaLearnedFactEntity)
        .where('channel_id = :channelId', { channelId })
        .andWhere('subject_kind = :kind', { kind: subject.kind })
        .andWhere(
          subject.userId ? 'subject_user_id = :userId' : 'subject_user_id IS NULL',
          subject.userId ? { userId: subject.userId } : {},
        )
        .andWhere('deleted_at IS NULL')
        .execute();
      if (kept.length === 0) return;
      await manager.insert(
        ZcaLearnedFactEntity,
        kept.map((fact) => ({
          channelId,
          subjectKind: subject.kind,
          subjectUserId: subject.userId,
          subjectName: subject.name,
          fact,
        })),
      );
    });
    return kept.length;
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

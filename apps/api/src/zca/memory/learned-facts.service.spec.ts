import test from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from 'typeorm';
import type { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { LearnedFactsService } from './learned-facts.service';

function fact(
  subjectKind: 'bot' | 'member',
  text: string,
  subjectUserId: string | null = null,
): ZcaLearnedFactEntity {
  return {
    subjectKind,
    subjectName: subjectKind === 'bot' ? 'Đen' : 'Văn Đạt',
    subjectUserId,
    fact: text,
  } as ZcaLearnedFactEntity;
}

void test('forPrompt keeps only the facts about the bot', async () => {
  const repository = {
    find: () =>
      Promise.resolve([
        fact('bot', 'là mèo đen 10 tuổi'),
        fact('member', 'số CCCD là 000000000000', 'u1'),
        fact('member', 'ăn chay', 'u2'),
      ]),
  } as unknown as Repository<ZcaLearnedFactEntity>;
  const service = new LearnedFactsService(repository);

  const facts = await service.forPrompt('g-1');

  assert.deepEqual(
    facts.map((item) => item.fact),
    ['là mèo đen 10 tuổi'],
  );
});

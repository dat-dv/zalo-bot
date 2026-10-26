import assert from 'node:assert/strict';
import test from 'node:test';
import type { IChannelLearnedFact } from '@zalobot/contracts';
import { groupLearnedFacts, memoryStatusText } from './channel-memory';

function fact(partial: Partial<IChannelLearnedFact>): IChannelLearnedFact {
  return {
    id: 'f',
    channelId: 'g-1',
    subjectKind: 'member',
    subjectUserId: 'u1',
    subjectName: 'Văn Đạt',
    fact: 'x',
    learnedAt: '2026-10-25T20:00:00.000Z',
    ...partial,
  };
}

void test('groupLearnedFacts puts the bot first, then members by name', () => {
  const groups = groupLearnedFacts([
    fact({ id: '1', subjectName: 'Văn Đạt', fact: 'Đi bơi buổi sáng' }),
    fact({
      id: '2',
      subjectKind: 'bot',
      subjectUserId: null,
      subjectName: 'Đen',
      fact: 'Là mèo đen',
    }),
    fact({ id: '3', subjectUserId: 'u2', subjectName: 'Diệu Hằng', fact: 'Ăn chay' }),
    fact({ id: '4', subjectName: 'Văn Đạt', fact: 'Chồng Diệu Hằng' }),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.title, group.facts.map((f) => f.id)]),
    [
      ['Về bot (Đen)', ['2']],
      ['Diệu Hằng', ['3']],
      ['Văn Đạt', ['1', '4']],
    ],
  );
});

void test('memoryStatusText explains Cognee off, the last day and retries', () => {
  assert.match(
    memoryStatusText({
      cogneeEnabled: false,
      lastIngestedDay: null,
      failedDays: 0,
      lastError: null,
    }),
    /chưa bật Cognee/,
  );
  assert.equal(
    memoryStatusText({
      cogneeEnabled: true,
      lastIngestedDay: '2026-10-25',
      failedDays: 2,
      lastError: 'x',
    }),
    'Đã nạp tới ngày 25/10/2026. 2 ngày lỗi, sẽ thử lại đêm sau.',
  );
});

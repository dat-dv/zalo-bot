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

void test('memoryStatusText explains a missing model, counts and pending messages', () => {
  const base = { embeddedMessages: 0, pendingMessages: 0, lastEmbeddedAt: null };
  assert.match(memoryStatusText({ ...base, embedder: 'failed' }), /theo từ khoá/);
  assert.equal(memoryStatusText({ ...base, embedder: 'idle' }), 'Chưa có tin nào để nhớ.');
  assert.equal(
    memoryStatusText({ ...base, embedder: 'ready', embeddedMessages: 1957 }),
    'Đã nhớ 1.957 tin.',
  );
  assert.match(
    memoryStatusText({ ...base, embedder: 'ready', embeddedMessages: 10, pendingMessages: 3 }),
    /^Đã nhớ 10 tin\. 3 tin đang chờ/,
  );
});

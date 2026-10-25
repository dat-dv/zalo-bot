import test from 'node:test';
import assert from 'node:assert/strict';
import type { MemoryLine } from './chat-memory.mapper';
import type { ChatMemoryService, RecentMessagesOptions } from './chat-memory.service';
import { ShortTermMemoryService } from './short-term-memory.service';

void test('ShortTermMemoryService reads the window from the shared message store', async () => {
  const asked: Array<{ channelId: string; options: RecentMessagesOptions }> = [];
  const line: MemoryLine = {
    sentAt: new Date('2026-10-25T10:02:17Z'),
    senderUid: 'u-1',
    senderName: 'Văn Đạt',
    isBot: false,
    text: 'tao dặn rồi mày là con mèo đen 2 mái',
  };
  const chatMemory: Pick<ChatMemoryService, 'getRecent'> = {
    getRecent: (channelId, options) => {
      asked.push({ channelId, options });
      return Promise.resolve([line]);
    },
  };
  const service = new ShortTermMemoryService(chatMemory as ChatMemoryService);

  const lines = await service.getRecent('g-1', { limit: 15, maxAgeDays: 7, excludeMsgId: 'm-1' });

  assert.deepEqual(lines, [line]);
  assert.deepEqual(asked, [
    { channelId: 'g-1', options: { limit: 15, maxAgeDays: 7, excludeMsgId: 'm-1' } },
  ]);
});

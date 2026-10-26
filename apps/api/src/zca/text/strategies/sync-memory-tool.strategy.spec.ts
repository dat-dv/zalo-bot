import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentInput } from '../../../types/agent-input.type';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { CogneeClient } from '../../memory/long-term/cognee.client';
import type { MemorySegmentScheduler } from '../../memory/long-term/memory-segment.scheduler';
import { SyncMemoryToolStrategy } from './sync-memory-tool.strategy';

function createStrategy(options: { cogneeOn?: boolean } = {}) {
  const sent: string[] = [];
  const syncs: string[] = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      sent.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;
  const cognee = { isEnabled: () => options.cogneeOn ?? true } as unknown as CogneeClient;
  const scheduler = {
    requestSync: ({ channelId }: { channelId: string }) => {
      syncs.push(channelId);
      return Promise.resolve(true);
    },
  } as unknown as MemorySegmentScheduler;
  return { strategy: new SyncMemoryToolStrategy(messenger, cognee, scheduler), sent, syncs };
}

function context(longTermMemory: boolean) {
  const input: AgentInput = {
    type: 'text',
    senderId: 'u1',
    chatId: 'g-1',
    displayName: 'Đạt',
    text: '/sync',
    longTermMemory,
  };
  return { input, chatId: 'g-1', senderId: 'u1', displayName: 'Đạt', text: '/sync' };
}

void test('/sync queues this chat and says it is updating', async () => {
  const { strategy, sent, syncs } = createStrategy();
  await strategy.execute(context(true));
  assert.deepEqual(syncs, ['g-1']);
  assert.deepEqual(sent, ['🔄 Đang cập nhật trí nhớ…']);
});

void test('/sync explains a chat without long-term memory or a server without Cognee', async () => {
  const off = createStrategy();
  await off.strategy.execute(context(false));
  assert.deepEqual(off.syncs, []);
  assert.match(off.sent[0], /chưa bật Nhớ lâu dài/);

  const noCognee = createStrategy({ cogneeOn: false });
  await noCognee.strategy.execute(context(true));
  assert.deepEqual(noCognee.syncs, []);
  assert.match(noCognee.sent[0], /chưa bật Cognee/);
});

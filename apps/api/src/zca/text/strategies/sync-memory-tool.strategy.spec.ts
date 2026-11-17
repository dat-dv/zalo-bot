import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentInput } from '../../../types/agent-input.type';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { MemoryEmbeddingScheduler } from '../../memory/long-term/memory-embedding.scheduler';
import { SyncMemoryToolStrategy } from './sync-memory-tool.strategy';

function createStrategy(options: { queued?: boolean } = {}) {
  const sent: string[] = [];
  const syncs: string[] = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      sent.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;
  const scheduler = {
    requestSync: ({ channelId }: { channelId: string }) => {
      syncs.push(channelId);
      return Promise.resolve(options.queued ?? true);
    },
  } as unknown as MemoryEmbeddingScheduler;
  return { strategy: new SyncMemoryToolStrategy(messenger, scheduler), sent, syncs };
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

void test('/sync explains a chat without long-term memory and a queue that is down', async () => {
  const off = createStrategy();
  await off.strategy.execute(context(false));
  assert.deepEqual(off.syncs, []);
  assert.match(off.sent[0], /chưa bật Nhớ lâu dài/);

  const down = createStrategy({ queued: false });
  await down.strategy.execute(context(true));
  assert.match(down.sent[0], /Chưa cập nhật được trí nhớ/);
});

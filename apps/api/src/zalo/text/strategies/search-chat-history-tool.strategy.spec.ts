import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchChatHistoryToolStrategy } from './search-chat-history-tool.strategy';
import type { ZaloService } from '../../zalo.service';
import type { LlmService } from '../../../llm/llm.service';
import type { ChatMemoryService } from '../../../zca/memory/chat-memory.service';
import type { ChatMemorySearchParams } from '../../../zca/memory/chat-memory.query';
import type { MemoryLine } from '../../../zca/memory/chat-memory.mapper';
import type { AgentInput } from '../../types/agent-input.type';

function createHarness(options: { enabled: boolean; lines?: MemoryLine[]; answer?: string }) {
  const sent: string[] = [];
  const searches: Array<{ channelId: string; params: ChatMemorySearchParams }> = [];
  const prompts: string[] = [];

  const zaloService = {
    sendMessage: (_chatId: string, msg: string) => {
      sent.push(msg);
      return Promise.resolve();
    },
    withChatAction: <T>(_chatId: string, fn: () => Promise<T>) => fn(),
  } as unknown as ZaloService;
  const llmService = {
    generate: (prompt: string) => {
      prompts.push(prompt);
      return Promise.resolve({ text: options.answer ?? '' });
    },
  } as unknown as LlmService;
  const chatMemoryService = {
    isEnabled: () => options.enabled,
    getSearchLimit: () => 15,
    search: (channelId: string, params: ChatMemorySearchParams) => {
      searches.push({ channelId, params });
      return Promise.resolve(options.lines ?? []);
    },
  } as unknown as ChatMemoryService;

  const strategy = new SearchChatHistoryToolStrategy(zaloService, llmService, chatMemoryService);
  return { strategy, sent, searches, prompts };
}

const input: AgentInput = {
  type: 'text',
  senderId: 'u-1',
  chatId: 'g-1',
  displayName: 'Đạt',
  text: 'năm ngoái mình đi đâu',
};

void test('SearchChatHistoryToolStrategy explains when chat memory is off', async () => {
  const { strategy, sent, searches } = createHarness({ enabled: false });

  await strategy.execute({
    input,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
  });

  assert.equal(searches.length, 0);
  assert.match(sent[0], /chưa bật tính năng ghi nhớ/);
});

void test('SearchChatHistoryToolStrategy searches the current chat and reports no match', async () => {
  const { strategy, sent, searches, prompts } = createHarness({ enabled: true, lines: [] });

  await strategy.execute({
    input,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
    toolArgs: { keywords: 'đi, du lịch', fromDate: '2025-01-01', toDate: '2025-12-31' },
  });

  assert.equal(searches[0].channelId, 'g-1');
  assert.equal(searches[0].params.keywords, 'đi, du lịch');
  assert.equal(searches[0].params.fromDate, '2025-01-01');
  assert.equal(prompts.length, 0);
  assert.match(sent[0], /từ 01\/01\/2025 đến 31\/12\/2025/);
});

void test('SearchChatHistoryToolStrategy answers from the matched lines only', async () => {
  const lines: MemoryLine[] = [
    {
      sentAt: new Date('2025-07-12T12:00:00Z'),
      senderName: 'Nam',
      isBot: false,
      text: 'Chốt đi Đà Lạt 3 ngày',
    },
  ];
  const { strategy, sent, prompts } = createHarness({
    enabled: true,
    lines,
    answer: 'Năm ngoái nhóm đi Đà Lạt (12/07/2025, Nam chốt).',
  });

  await strategy.execute({
    input,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
    toolArgs: {
      keywords: 'đi, du lịch',
      fromDate: 'not-a-date',
      question: 'năm ngoái mình đi đâu',
    },
  });

  assert.match(prompts[0], /Câu hỏi: năm ngoái mình đi đâu/);
  assert.match(prompts[0], /\[2025-07-12 19:00\] Nam: Chốt đi Đà Lạt 3 ngày/);
  assert.equal(sent[0], 'Năm ngoái nhóm đi Đà Lạt (12/07/2025, Nam chốt).');
});

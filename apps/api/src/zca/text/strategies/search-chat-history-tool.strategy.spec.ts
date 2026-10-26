import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SearchChatHistoryToolStrategy,
  readSearchLimit,
} from './search-chat-history-tool.strategy';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { LlmService } from '../../../llm/llm.service';
import type { ChatMemoryService } from '../../memory/chat-memory.service';
import type { ChatMemorySearchParams } from '../../memory/chat-memory.query';
import type { MemoryLine } from '../../memory/chat-memory.mapper';
import type { AgentInput } from '../../../types/agent-input.type';
import type { CogneeClient } from '../../memory/long-term/cognee.client';

function createHarness(options: { lines?: MemoryLine[]; answer?: string; graph?: string[] }) {
  const sent: string[] = [];
  const searches: Array<{ channelId: string; params: ChatMemorySearchParams }> = [];
  const prompts: string[] = [];

  const zcaMessenger = {
    sendMessage: (_chatId: string, msg: string) => {
      sent.push(msg);
      return Promise.resolve();
    },
    withTyping: <T>(_chatId: string, fn: () => Promise<T>) => fn(),
  } as unknown as ZcaMessengerService;
  const llmService = {
    generate: (prompt: string) => {
      prompts.push(prompt);
      return Promise.resolve({ text: options.answer ?? '' });
    },
  } as unknown as LlmService;
  const chatMemoryService = {
    search: (channelId: string, params: ChatMemorySearchParams) => {
      searches.push({ channelId, params });
      return Promise.resolve(options.lines ?? []);
    },
  } as unknown as ChatMemoryService;

  const recalls: Array<{ dataset: string; query: string; temporal?: boolean }> = [];
  const cognee = options.graph
    ? ({
        isEnabled: () => true,
        recallContext: (dataset: string, query: string, opts: { temporal?: boolean } = {}) => {
          recalls.push({ dataset, query, temporal: opts.temporal });
          return Promise.resolve(options.graph ?? []);
        },
      } as unknown as CogneeClient)
    : undefined;

  const strategy = new SearchChatHistoryToolStrategy(
    zcaMessenger,
    llmService,
    chatMemoryService,
    undefined,
    cognee,
  );
  return { strategy, sent, searches, prompts, recalls };
}

const memoryOff: AgentInput = {
  type: 'text',
  senderId: 'u-1',
  chatId: 'g-1',
  displayName: 'Đạt',
  text: 'năm ngoái mình đi đâu',
};

const input: AgentInput = {
  ...memoryOff,
  messageId: 'm-question',
  longTermMemory: true,
};

void test('SearchChatHistoryToolStrategy explains when chat memory is off', async () => {
  const { strategy, sent, searches } = createHarness({});

  await strategy.execute({
    input: memoryOff,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
  });

  assert.equal(searches.length, 0);
  assert.match(sent[0], /chưa bật ghi nhớ hội thoại/);
});

void test('SearchChatHistoryToolStrategy searches the current chat and reports no match', async () => {
  const { strategy, sent, searches, prompts } = createHarness({ lines: [] });

  await strategy.execute({
    input,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
    toolArgs: {
      keywords: 'đi, du lịch',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
      limit: 7,
    },
  });

  assert.equal(searches[0].channelId, 'g-1');
  assert.equal(searches[0].params.keywords, 'đi, du lịch');
  assert.equal(searches[0].params.fromDate, '2025-01-01');
  assert.equal(searches[0].params.limit, 7, 'uses the limit the agent chose');
  assert.equal(searches[0].params.excludeMsgId, 'm-question', 'skips the asking message');
  assert.equal(prompts.length, 0);
  assert.equal(
    sent[0],
    '🔎 Không thấy tin nào khớp trong lịch sử chat từ 01/01/2025 đến 31/12/2025.',
  );
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

void test('SearchChatHistoryToolStrategy adds the Cognee graph context of the chat dataset', async () => {
  const { strategy, sent, prompts, recalls } = createHarness({
    lines: [],
    graph: ['Nhóm -- went_to -- Đà Lạt (05/2026)'],
    answer: 'Tháng 5 nhóm đi Đà Lạt.',
  });

  await strategy.execute({
    input,
    chatId: 'g-1',
    senderId: 'u-1',
    displayName: 'Đạt',
    text: input.text ?? '',
    toolArgs: { keywords: 'đi, du lịch', fromDate: '2026-05-01', toDate: '2026-05-31' },
  });

  assert.deepEqual(recalls, [
    { dataset: 'zca-g-1', query: 'năm ngoái mình đi đâu', temporal: true },
  ]);
  assert.match(prompts[0], /Ngữ cảnh trí nhớ của cuộc trò chuyện[^\n]*\nNhóm -- went_to -- Đà Lạt/);
  assert.deepEqual(sent, ['Tháng 5 nhóm đi Đà Lạt.']);
});

void test('readSearchLimit keeps the agent limit within bounds, default when missing', () => {
  assert.equal(readSearchLimit(undefined), 15);
  assert.equal(readSearchLimit({ limit: 'abc' }), 15);
  assert.equal(readSearchLimit({ limit: 30 }), 30);
  assert.equal(readSearchLimit({ limit: '8' }), 8);
  assert.equal(readSearchLimit({ limit: 999 }), 50);
  assert.equal(readSearchLimit({ limit: 0 }), 1);
});

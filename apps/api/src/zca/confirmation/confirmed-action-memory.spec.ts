import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceService } from '../../finance/finance.service';
import type { UsersService } from '../../users/users.service';
import type { ChannelNotesService } from '../memory/channel-notes.service';
import type { ChatMemoryService, ConfirmedActionMemory } from '../memory/chat-memory.service';
import { OutgoingMemoryKind, type MemoryKind } from '../memory/memory-kind';
import type { ThreadConfigService } from '../thread-config.service';
import type { ZcaService } from '../zca.service';
import { TransactionConfirmationService } from './transaction-confirmation.service';

interface Setup {
  createTransaction?: () => Promise<unknown>;
  memoryOn?: boolean;
}

/** Confirmation service whose sends record their memory kind and whose memory writes are kept. */
function createService(setup: Setup = {}) {
  const sent: Array<{ text: string; kind: MemoryKind | undefined }> = [];
  const actions: ConfirmedActionMemory[] = [];
  const notes: string[] = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      sent.push({ text, kind: OutgoingMemoryKind.current() });
      return Promise.resolve(true);
    },
    sendMessageWithResult: (_chatId: string, text: string) => {
      sent.push({ text, kind: OutgoingMemoryKind.current() });
      return Promise.resolve({ success: true, msgId: `m-${sent.length}` });
    },
    undoMessage: () => Promise.resolve(true),
  } as unknown as ZcaService;
  const finance = {
    createTransaction: setup.createTransaction ?? (() => Promise.resolve({ amount: 70000 })),
  } as unknown as FinanceService;
  const users = {
    resolveZaloNames: () => Promise.resolve(new Map([['u1', 'Văn Đạt']])),
    banUser: () => Promise.resolve(true),
  } as unknown as UsersService;
  const memoryOn = setup.memoryOn ?? true;
  const threadConfig = {
    findStoredConfig: () =>
      Promise.resolve({
        isListened: true,
        threadType: 'group',
        chatMemory: { enabled: memoryOn, shortTermEnabled: memoryOn },
        confirmationRules: { requiredHearts: 1 },
      }),
  } as unknown as ThreadConfigService;
  const chatMemory = {
    recordAction: (_channelId: string, _type: string, action: ConfirmedActionMemory) => {
      actions.push(action);
      return Promise.resolve();
    },
  } as unknown as ChatMemoryService;
  const channelNotes = {
    add: (_channelId: string, text: string) => {
      notes.push(text);
      return Promise.resolve({ note: { text } });
    },
  } as unknown as ChannelNotesService;
  const service = new TransactionConfirmationService(
    messenger,
    finance,
    undefined,
    undefined,
    undefined,
    users,
    undefined,
    undefined,
    threadConfig,
    chatMemory,
    channelNotes,
  );
  return { service, sent, actions, notes };
}

const EXPENSE = { type: 'expense' as const, amount: 70000, category: 'Khác', note: 'đi bơi' };

void test('a card is tagged `card` and its notices `system`, so they stay out of the memories', async () => {
  const { service, sent } = createService();
  const pending = await service.createPending({ userId: 'u1', chatId: 'c1', payload: EXPENSE });

  await service.handleCommand('u1', 'c1', `cancel ${pending.code}`);

  assert.equal(sent[0].kind, 'card');
  assert.ok(sent.slice(1).every((message) => message.kind === 'system'));
  service.clearAll();
});

void test('only a confirmed action that ran successfully reaches the memory, from its requester', async () => {
  const { service, sent, actions } = createService();
  const pending = await service.createPending({ userId: 'u1', chatId: 'c1', payload: EXPENSE });

  await service.handleCommand('u2', 'c1', `yes ${pending.code}`);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].requesterUid, 'u1');
  assert.equal(actions[0].requesterName, 'Văn Đạt');
  assert.equal(actions[0].actionId, `action:${pending.code}:${pending.createdAt}`);
  assert.match(actions[0].text, /^\(đã duyệt\) Chi 70\.000/);
  assert.doesNotMatch(actions[0].text, /\[\d+\]/);
  assert.equal(sent[sent.length - 1].kind, 'result');
  service.clearAll();
});

void test('a cancelled or failed action never reaches the memory', async () => {
  const cancelled = createService();
  const first = await cancelled.service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: EXPENSE,
  });
  await cancelled.service.handleCommand('u1', 'c1', `cancel ${first.code}`);
  assert.equal(cancelled.actions.length, 0);
  cancelled.service.clearAll();

  const failing = createService({ createTransaction: () => Promise.reject(new Error('DB lỗi')) });
  const second = await failing.service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: EXPENSE,
  });
  await failing.service.handleCommand('u1', 'c1', `yes ${second.code}`);
  assert.equal(failing.actions.length, 0);
  assert.match(failing.sent[failing.sent.length - 1].text, /Chưa thực hiện được: DB lỗi/);
  failing.service.clearAll();
});

void test('nothing is written when the chat has no memory on', async () => {
  const { service, actions } = createService({ memoryOn: false });
  const pending = await service.createPending({ userId: 'u1', chatId: 'c1', payload: EXPENSE });

  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);

  assert.equal(actions.length, 0);
  service.clearAll();
});

void test('banning a user is not remembered', async () => {
  const { service, actions } = createService();
  const pending = await service.createPendingBanUser({
    userId: 'u1',
    chatId: 'c1',
    payload: { targetUserId: 'u9', targetName: 'Spam' },
  });

  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);

  assert.equal(actions.length, 0);
  service.clearAll();
});

void test('an approved note is saved for the chat and remembered as done', async () => {
  const { service, notes, actions } = createService();
  const pending = await service.createPendingRememberNote({
    userId: 'u1',
    chatId: 'c1',
    payload: { text: 'Bot là con mèo đen 2 mái' },
  });

  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);

  assert.deepEqual(notes, ['Bot là con mèo đen 2 mái']);
  assert.match(actions[0]?.text ?? '', /Đã ghi nhớ: Bot là con mèo đen 2 mái/);
  service.clearAll();
});

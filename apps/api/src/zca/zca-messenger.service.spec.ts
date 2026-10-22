import assert from 'node:assert/strict';
import test from 'node:test';
import { ZcaMessengerService } from './zca-messenger.service';

interface SentMessage {
  text: string;
  threadId: string;
}

function createLoggedInZca(sent: SentMessage[] = []) {
  return {
    isLoggedIn: () => true,
    sendMessage: (text: string, threadId: string) => {
      sent.push({ text, threadId });
      return Promise.resolve({ message: { msgId: `msg_${sent.length}`, cliMsgId: 'cli' } });
    },
  };
}

void test('ZcaMessengerService sendMessage returns false when ZCA is not available', async () => {
  const withoutZca = new ZcaMessengerService();
  assert.equal(await withoutZca.sendMessage('12345', 'Hello'), false);

  const loggedOut = new ZcaMessengerService({ isLoggedIn: () => false } as never);
  assert.equal(await loggedOut.sendMessage('12345', 'Hello'), false);
});

void test('ZcaMessengerService sendMessageWithResult sends through ZCA and returns message ids', async () => {
  const sent: SentMessage[] = [];
  const service = new ZcaMessengerService(createLoggedInZca(sent) as never);

  const result = await service.sendMessageWithResult('user_999', 'Xin chào');

  assert.deepEqual(result, { success: true, msgId: 'msg_1', cliMsgId: 'cli' });
  assert.deepEqual(sent, [{ text: 'Xin chào', threadId: 'user_999' }]);
});

void test('ZcaMessengerService sendMessage returns false when ZCA throws', async () => {
  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    sendMessage: () => Promise.reject(new Error('blocked')),
  } as never);

  assert.equal(await service.sendMessage('user_999', 'Xin chào'), false);
});

void test('ZcaMessengerService sendMessage splits messages longer than 1900 characters', async () => {
  const sent: SentMessage[] = [];
  const service = new ZcaMessengerService(createLoggedInZca(sent) as never);
  const p1 = 'A'.repeat(1800);
  const p2 = 'B'.repeat(1700);

  const result = await service.sendMessage('user_123', `${p1}\n\n${p2}`);

  assert.equal(result, true);
  assert.deepEqual(
    sent.map((message) => message.text),
    [p1, p2],
  );
  assert.ok(sent.every((message) => message.threadId === 'user_123'));
});

void test('ZcaMessengerService sendTyping sends a ZCA typing event to the resolved thread type', async () => {
  const typing: Array<{ threadId: string; type: number }> = [];
  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    resolveThreadType: () => 1,
    sendTyping: (threadId: string, type: number) => {
      typing.push({ threadId, type });
      return Promise.resolve({});
    },
  } as never);

  assert.equal(await service.sendTyping('group_1'), true);
  assert.deepEqual(typing, [{ threadId: 'group_1', type: 1 }]);
});

void test('ZcaMessengerService sendTyping is a no-op when ZCA is logged out', async () => {
  const service = new ZcaMessengerService({ isLoggedIn: () => false } as never);
  assert.equal(await service.sendTyping('user_1'), false);
});

void test('ZcaMessengerService withTyping cleans up the typing timer on completion and error', async () => {
  let typingCount = 0;
  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    resolveThreadType: () => 0,
    sendTyping: () => {
      typingCount++;
      return Promise.resolve({});
    },
  } as never);

  const result = await service.withTyping('user_999', () => Promise.resolve('done'));
  assert.equal(result, 'done');
  assert.ok(typingCount >= 1);

  await assert.rejects(
    () => service.withTyping('user_999', () => Promise.reject(new Error('Simulation error'))),
    { message: 'Simulation error' },
  );
});

void test('ZcaMessengerService undoMessage calls zcaService.undo with cached cliMsgId', async () => {
  let undoPayload: { msgId: string; cliMsgId?: string } | undefined;
  let undoThreadId = '';

  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    getCliMsgId: (msgId: string) => Promise.resolve(msgId === 'msg_1' ? 'cli_1' : undefined),
    undo: (payload: { msgId: string; cliMsgId?: string }, threadId: string) => {
      undoPayload = payload;
      undoThreadId = threadId;
      return Promise.resolve({ status: 0 });
    },
  } as never);

  const res = await service.undoMessage('chat_100', 'msg_1');
  assert.equal(res, true);
  assert.equal(undoThreadId, 'chat_100');
  assert.equal(undoPayload?.msgId, 'msg_1');
  assert.equal(undoPayload?.cliMsgId, 'cli_1');
});

void test('ZcaMessengerService undoMessage falls back to deleteMessage (onlyMe=true) when undo fails', async () => {
  let deleteOnlyMe: boolean | undefined;

  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    getCliMsgId: () => Promise.resolve('cli_1'),
    getOwnId: () => 'bot_uid',
    undo: () => Promise.reject(new Error('Lỗi không xác định')),
    deleteMessage: (_dest: unknown, onlyMe?: boolean) => {
      deleteOnlyMe = onlyMe;
      return Promise.resolve({ status: 0 });
    },
  } as never);

  const res = await service.undoMessage('chat_100', 'msg_1');
  assert.equal(res, false);
  assert.equal(deleteOnlyMe, true);
});

void test('ZcaMessengerService deleteMessage delegates to zcaService.deleteMessage', async () => {
  let passedOnlyMe: boolean | undefined;

  const service = new ZcaMessengerService({
    isLoggedIn: () => true,
    getCliMsgId: () => Promise.resolve('cli_1'),
    getOwnId: () => 'bot_uid',
    deleteMessage: (_dest: unknown, onlyMe?: boolean) => {
      passedOnlyMe = onlyMe;
      return Promise.resolve({ status: 0 });
    },
  } as never);

  const res = await service.deleteMessage('chat_100', 'msg_1', undefined, true);
  assert.equal(res, true);
  assert.equal(passedOnlyMe, true);
});

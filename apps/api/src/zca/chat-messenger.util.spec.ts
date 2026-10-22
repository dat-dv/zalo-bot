import test from 'node:test';
import assert from 'node:assert/strict';
import { sendChatText, sendChatTextWithResult, undoChatMessage } from './chat-messenger.util';

void test('sendChatText prefers sendMessageToChat (ZcaService) over sendMessage', async () => {
  const calls: string[] = [];
  const zca = {
    sendMessageToChat: (chatId: string | number, text: string) => {
      calls.push(`toChat:${chatId}:${text}`);
      return Promise.resolve(true);
    },
    sendMessage: () => {
      calls.push('sendMessage');
      return Promise.resolve(true);
    },
  };

  await sendChatText(zca, 'g-1', 'hi');

  assert.deepEqual(calls, ['toChat:g-1:hi']);
});

void test('sendChatText calls sendMessage(chatId, text) on other messengers', async () => {
  const calls: unknown[][] = [];
  const zalo = {
    sendMessage: (...args: never[]) => {
      calls.push(args);
      return Promise.resolve(true);
    },
  };

  await sendChatText(zalo, 'u-1', 'xin chào');

  assert.deepEqual(calls, [['u-1', 'xin chào']]);
  assert.equal(await sendChatText(undefined, 'u-1', 'x'), false);
});

void test('sendChatTextWithResult reads ids and falls back to a plain send', async () => {
  const withResult = {
    sendMessageWithResult: () => Promise.resolve({ success: true, msgId: 42, cliMsgId: 'c-1' }),
  };
  assert.deepEqual(await sendChatTextWithResult(withResult, 'g-1', 'hi'), {
    success: true,
    msgId: '42',
    cliMsgId: 'c-1',
  });

  const plain = { sendMessage: () => Promise.resolve(true) };
  assert.deepEqual(await sendChatTextWithResult(plain, 'g-1', 'hi'), { success: true });
  assert.deepEqual(await sendChatTextWithResult(undefined, 'g-1', 'hi'), { success: false });
});

void test('undoChatMessage is true only when the messenger confirms the recall', async () => {
  const recalls: unknown[][] = [];
  const messenger = {
    undoMessage: (...args: unknown[]) => {
      recalls.push(args);
      return Promise.resolve(true);
    },
  };

  assert.equal(await undoChatMessage(messenger, 'g-1', 'm-1', 'c-1'), true);
  assert.deepEqual(recalls, [['g-1', 'm-1', 'c-1']]);
  assert.equal(await undoChatMessage({}, 'g-1', 'm-1'), false);
});

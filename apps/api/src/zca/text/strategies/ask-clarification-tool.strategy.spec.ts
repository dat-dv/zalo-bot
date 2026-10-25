import assert from 'node:assert/strict';
import test from 'node:test';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import { TextToolType } from '../text-tool.enum';
import type { TextToolContext } from '../text-tool.interface';
import {
  AskClarificationToolStrategy,
  CLARIFICATION_MAX_LENGTH,
} from './ask-clarification-tool.strategy';

function setup() {
  const sent: Array<{ chatId: string | number; text: string }> = [];
  const messenger = {
    sendMessage: (chatId: string | number, text: string) => {
      sent.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;
  return { sent, strategy: new AskClarificationToolStrategy(messenger) };
}

function context(question: unknown): TextToolContext {
  return {
    input: { type: 'text', senderId: 'u1', chatId: 'g1', displayName: 'Đạt' },
    chatId: 'g1',
    senderId: 'u1',
    displayName: 'Đạt',
    text: 'nhắc sinh nhật',
    toolArgs: { question },
  };
}

void test('sends the trimmed question to the chat', async () => {
  const { sent, strategy } = setup();
  assert.equal(strategy.type, TextToolType.ASK_CLARIFICATION);
  await strategy.execute(context('  Sinh nhật ngày nào?  '));
  assert.deepEqual(sent, [{ chatId: 'g1', text: 'Sinh nhật ngày nào?' }]);
});

void test('sends nothing without a question', async () => {
  const { sent, strategy } = setup();
  await strategy.execute(context('   '));
  await strategy.execute(context(42));
  assert.deepEqual(sent, []);
});

void test('cuts an overlong question', async () => {
  const { sent, strategy } = setup();
  await strategy.execute(context('a'.repeat(CLARIFICATION_MAX_LENGTH + 50)));
  assert.equal(sent[0]?.text.length, CLARIFICATION_MAX_LENGTH);
});

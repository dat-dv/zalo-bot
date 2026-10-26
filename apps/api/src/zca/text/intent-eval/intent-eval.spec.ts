import assert from 'node:assert/strict';
import test from 'node:test';
import { TextToolType } from '../text-tool.enum';
import { textToolDefinitionsFor } from '../text-tool.definitions';
import { INTENT_CLASSIFICATION_RULES, buildToolSystemInstruction } from '../text-system-prompt';
import { CHAT, INTENT_EVAL_CASES } from './intent-eval.cases';
import { evalRequest, intentAccuracy, pickedIntent, runIntentEval } from './intent-eval';

void test('every eval case expects a tool the bot offers, or plain chat, and appears once', () => {
  const offered = new Set(textToolDefinitionsFor({ longTermMemory: true }).map((def) => def.name));
  const seen = new Set<string>();
  for (const testCase of INTENT_EVAL_CASES) {
    assert.ok(
      testCase.expect === CHAT || offered.has(testCase.expect),
      `${testCase.text}: ${testCase.expect}`,
    );
    assert.ok(!seen.has(testCase.text), `duplicate case: ${testCase.text}`);
    seen.add(testCase.text);
  }
  // The pairs that broke in the real chats are covered.
  const texts = INTENT_EVAL_CASES.map((testCase) => testCase.text);
  assert.ok(texts.includes('mày là con mèo đen 2 mái 10 tuổi'));
  assert.ok(texts.includes('cút lên mái nhà đi'));
});

void test('the tool prompt carries the classification table with the confusing pairs', () => {
  const prompt = buildToolSystemInstruction({
    profile: '',
    dateTimeSnippet: 'Bây giờ là 00:10 ngày 26/10/2026.',
    longTermMemory: false,
    allowAiChat: true,
    amendableBlock: '',
  });
  assert.ok(prompt.includes(INTENT_CLASSIFICATION_RULES));
  assert.match(
    INTENT_CLASSIFICATION_RULES,
    /"mày là con mèo đen 2 mái" → REMEMBER_NOTE \| "mày là con gì" → trò chuyện/,
  );
  assert.match(
    INTENT_CLASSIFICATION_RULES,
    /"7h tối nhớ mua sữa" → SET_REMINDER \| "nhớ mua sữa" → CREATE_TASK/,
  );
  assert.doesNotMatch(prompt, /SEARCH_CHAT_HISTORY/);
  assert.match(evalRequest().systemInstruction, /SEARCH_CHAT_HISTORY/);
});

void test('pickedIntent takes the first real tool, plain chat, or a provider failure', () => {
  assert.equal(pickedIntent({ text: 'dạ' }), CHAT);
  assert.equal(pickedIntent({ text: 'lỗi', failed: true }), 'FAILED');
  assert.equal(
    pickedIntent({
      toolCalls: [
        { name: TextToolType.ASK_CLARIFICATION, args: {} },
        { name: TextToolType.SET_REMINDER, args: {} },
      ],
    }),
    TextToolType.SET_REMINDER,
  );
  assert.equal(
    pickedIntent({ toolCall: { name: TextToolType.REMEMBER_NOTE, args: {} } }),
    TextToolType.REMEMBER_NOTE,
  );
});

void test('runIntentEval scores answered cases and leaves provider failures out', async () => {
  const answers = new Map([
    ['a', { toolCall: { name: TextToolType.REMEMBER_NOTE, args: {} } }],
    ['b', { text: 'hihi' }],
    ['c', { text: 'lỗi', failed: true }],
  ]);
  const results = await runIntentEval(
    [
      { text: 'a', expect: TextToolType.REMEMBER_NOTE },
      { text: 'b', expect: TextToolType.SET_REMINDER },
      { text: 'c', expect: CHAT },
    ],
    (prompt) => Promise.resolve(answers.get(prompt) ?? { text: '' }),
  );
  assert.deepEqual(
    results.map((result) => [result.got, result.ok]),
    [
      [TextToolType.REMEMBER_NOTE, true],
      [CHAT, false],
      ['FAILED', false],
    ],
  );
  assert.deepEqual(intentAccuracy(results), { correct: 1, answered: 2, failed: 1, ratio: 0.5 });
});

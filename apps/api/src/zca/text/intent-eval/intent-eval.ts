import type { LlmResponse, LlmToolDefinition } from '../../../llm/types/llm.types';
import { getVietnamDateTimeContext } from '../../../common/utils/datetime.util';
import { textToolDefinitionsFor } from '../text-tool.definitions';
import { buildToolSystemInstruction } from '../text-system-prompt';
import { CHAT, type IntentEvalCase, type IntentExpectation } from './intent-eval.cases';

/** What the bot picked for one message: the first tool called, or plain chat. */
export function pickedIntent(response: LlmResponse): string {
  if (response.failed) return 'FAILED';
  const calls = response.toolCalls?.length
    ? response.toolCalls
    : response.toolCall
      ? [response.toolCall]
      : [];
  const first = calls.find((call) => call.name !== 'ASK_CLARIFICATION') ?? calls[0];
  return first ? first.name : CHAT;
}

export interface IntentEvalResult {
  text: string;
  expect: IntentExpectation;
  /** Tool name, `CHAT`, or `FAILED` when every provider failed. */
  got: string;
  ok: boolean;
}

/** The same prompt and tools the bot uses for a message in a chat with every memory on. */
export function evalRequest(now: Date = new Date()): {
  systemInstruction: string;
  tools: LlmToolDefinition[];
} {
  return {
    systemInstruction: buildToolSystemInstruction({
      profile: '',
      dateTimeSnippet: getVietnamDateTimeContext(now, 'Asia/Ho_Chi_Minh').systemInstructionSnippet,
      longTermMemory: true,
      allowAiChat: true,
      amendableBlock: '',
    }),
    tools: textToolDefinitionsFor({ longTermMemory: true }),
  };
}

/** Runs every case through `generate` one after another (free LLMs rate-limit bursts). */
export async function runIntentEval(
  cases: readonly IntentEvalCase[],
  generate: (
    prompt: string,
    tools: LlmToolDefinition[],
    systemInstruction: string,
  ) => Promise<LlmResponse>,
): Promise<IntentEvalResult[]> {
  const { systemInstruction, tools } = evalRequest();
  const results: IntentEvalResult[] = [];
  for (const testCase of cases) {
    const got = pickedIntent(await generate(testCase.text, tools, systemInstruction));
    results.push({
      text: testCase.text,
      expect: testCase.expect,
      got,
      ok: got === String(testCase.expect),
    });
  }
  return results;
}

/** Share of cases answered right, ignoring provider failures (they say nothing about the prompt). */
export function intentAccuracy(results: readonly IntentEvalResult[]): {
  correct: number;
  answered: number;
  failed: number;
  ratio: number;
} {
  const answered = results.filter((result) => result.got !== 'FAILED');
  const correct = answered.filter((result) => result.ok).length;
  return {
    correct,
    answered: answered.length,
    failed: results.length - answered.length,
    ratio: answered.length ? correct / answered.length : 0,
  };
}

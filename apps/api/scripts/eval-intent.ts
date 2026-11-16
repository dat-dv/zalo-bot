/**
 * Measures how well the bot tells reminders, tasks, calendar events, notes and plain chat apart:
 * sends each case of `intent-eval.cases.ts` to the real LLM chain (read from the same env the
 * `llm_providers` table is seeded from: `LLM_PROVIDER`, `LLM_FALLBACK_PROVIDERS`, `GEMINI_*`…, so
 * no database is needed) with the bot's own prompt and tools, and prints right/wrong.
 * Sends no Zalo message and writes nothing.
 *
 *   npm run eval:intent --workspace @zalobot/api                  # .env.local + .env
 *   ENV_FILE=.env.production npm run eval:intent --workspace @zalobot/api
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { projectRoot } from '../src/config/project-root';
import configuration from '../src/config/configuration';
import { LlmService } from '../src/llm/llm.service';
import { GeminiProvider } from '../src/llm/providers/gemini.provider';
import { OpenAiProvider } from '../src/llm/providers/openai.provider';
import { QwenProvider } from '../src/llm/providers/qwen.provider';
import { buildLlmProviderSeed } from '../src/llm/llm-provider-seed';
import { resolveLlmProvider, type LlmChainSource } from '../src/llm/llm-provider-config.service';
import { INTENT_EVAL_CASES } from '../src/zca/text/intent-eval/intent-eval.cases';
import { intentAccuracy, runIntentEval } from '../src/zca/text/intent-eval/intent-eval';

/** Accuracy the prompt must reach before a deploy. */
const TARGET = 0.95;
const CALL_GAP_MS = Number(process.env.EVAL_GAP_MS ?? 4000);
const RETRY_DELAY_MS = 30_000;
const RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (process.env.ENV_FILE)
    dotenv.config({ path: path.resolve(projectRoot(), process.env.ENV_FILE) });
  dotenv.config({ path: path.resolve(projectRoot(), '.env.local') });
  dotenv.config({ path: path.resolve(projectRoot(), '.env') });

  const config = new ConfigService(configuration());
  const chain = buildLlmProviderSeed(process.env).map((row) =>
    resolveLlmProvider(
      { ...row, id: row.name, enabled: true },
      row.apiKey ?? '',
      Boolean(row.apiKey),
    ),
  );
  const source: LlmChainSource = {
    getChain: () => Promise.resolve(chain),
    findResolved: (id) => Promise.resolve(chain.find((provider) => provider.id === id) ?? null),
  };
  const llm = new LlmService(
    source,
    new GeminiProvider(config),
    new OpenAiProvider(config),
    new QwenProvider(config),
  );

  // Free LLM tiers rate-limit bursts: space the calls and retry a failed one after a pause.
  const results = await runIntentEval(INTENT_EVAL_CASES, async (prompt, tools, system) => {
    let response = await llm.generate(prompt, tools, system);
    for (let attempt = 1; response.failed && attempt <= RETRIES; attempt += 1) {
      await sleep(RETRY_DELAY_MS);
      response = await llm.generate(prompt, tools, system);
    }
    await sleep(CALL_GAP_MS);
    return response;
  });
  for (const result of results) {
    const mark = result.got === 'FAILED' ? '??' : result.ok ? 'OK' : 'XX';
    console.log(
      `${mark}  ${result.expect.padEnd(22)} ${String(result.got).padEnd(22)} ${result.text}`,
    );
  }
  const score = intentAccuracy(results);
  console.log(
    `\n${score.correct}/${score.answered} đúng (${(score.ratio * 100).toFixed(1)}%), ` +
      `${score.failed} lỗi gọi LLM. Mục tiêu ${(TARGET * 100).toFixed(0)}%.`,
  );
  if (score.answered === 0 || score.ratio < TARGET) process.exitCode = 1;
}

void main();

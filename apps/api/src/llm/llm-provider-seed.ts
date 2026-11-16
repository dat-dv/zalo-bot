import type { LlmProviderKind } from '@zalobot/contracts';

/** A provider row built from the legacy env chain, API key still in plain text. */
export interface LlmProviderSeedRow {
  name: string;
  kind: LlmProviderKind;
  baseUrl: string | null;
  model: string;
  apiKey: string | null;
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Old `LLM_PROVIDER` aliases, kept so a seeded chain matches what the bot used before. */
const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  ollama: 'qwen',
  'qwen2.5:14b': 'qwen',
  'qwen-14b': 'qwen',
  '9router': 'router',
};

/** Same cleanup as `configuration.ts` `readEnv`: trims and drops wrapping quotes. */
export function readEnvValue(env: EnvSource, name: string): string {
  return (
    env[name]
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim() ?? ''
  );
}

function legacyRow(env: EnvSource, name: string): LlmProviderSeedRow | null {
  const read = (key: string) => readEnvValue(env, key);
  switch (name) {
    case 'router':
      return {
        name,
        kind: 'openai',
        baseUrl: read('ROUTER_BASE_URL') || null,
        model: read('ROUTER_MODEL'),
        apiKey: read('ROUTER_API_KEY') || null,
      };
    case 'gemini':
      return {
        name,
        kind: 'gemini',
        baseUrl: null,
        model: read('GEMINI_MODEL') || 'gemini-3.5-flash-lite',
        apiKey: read('GEMINI_API_KEY') || null,
      };
    case 'openai':
      return {
        name,
        kind: 'openai',
        baseUrl: read('OPENAI_BASE_URL') || null,
        model: read('OPENAI_MODEL') || 'gpt-4o-mini',
        apiKey: read('OPENAI_API_KEY') || null,
      };
    case 'qwen':
      return {
        name,
        kind: 'ollama',
        baseUrl: read('QWEN_BASE_URL') || null,
        model: read('QWEN_MODEL') || 'qwen2.5:14b',
        apiKey: read('QWEN_API_KEY') || null,
      };
    default:
      return null;
  }
}

/**
 * The chain the bot used while it was configured by env (`LLM_PROVIDER` then
 * `LLM_FALLBACK_PROVIDERS`), in call order: aliases resolved, duplicates and unknown names
 * dropped, Gemini alone when nothing usable is left (the old fallback).
 */
export function buildLlmProviderSeed(env: EnvSource): LlmProviderSeedRow[] {
  const primary = readEnvValue(env, 'LLM_PROVIDER') || 'gemini';
  const fallbacks = readEnvValue(env, 'LLM_FALLBACK_PROVIDERS').split(',');
  const rows: LlmProviderSeedRow[] = [];

  for (const raw of [primary, ...fallbacks]) {
    const lowered = raw.trim().toLowerCase();
    if (!lowered) continue;
    const name = LEGACY_ALIASES[lowered] ?? lowered;
    if (rows.some((row) => row.name === name)) continue;
    const row = legacyRow(env, name);
    if (row) rows.push(row);
  }

  if (rows.length > 0) return rows;
  const gemini = legacyRow(env, 'gemini');
  return gemini ? [gemini] : [];
}

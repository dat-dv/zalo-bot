import type { ConfigService } from '@nestjs/config';

export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/** Per-request LLM timeout (`LLM_TIMEOUT_MS`); a hung provider must fail so the chain can move on. */
export function resolveLlmTimeoutMs(configService: ConfigService): number {
  const value = configService.get<number>('llm.timeoutMs');
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LLM_TIMEOUT_MS;
}

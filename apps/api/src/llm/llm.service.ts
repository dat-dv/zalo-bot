import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILlmProviderPingResult, ILlmProviderStatus, LlmPingStatus } from '@zalobot/contracts';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from './types/llm.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import { RouterProvider } from './providers/router.provider';
import { cleanToolArguments } from './utils/tool-arguments.util';

const PING_PROMPT = 'ping';
const PING_SYSTEM_INSTRUCTION = 'Reply with exactly one word: pong.';

/** No text and no tool call: free models sometimes answer empty, which is worth a retry elsewhere. */
function isEmptyResponse(response: LlmResponse): boolean {
  return !response.text?.trim() && !response.toolCall && !(response.toolCalls?.length ?? 0);
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providerMap = new Map<string, ILlmProvider>();
  private readonly warnedUnknownProviders = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly qwenProvider: QwenProvider,
    @Optional() routerProvider?: RouterProvider,
  ) {
    this.providerMap.set(geminiProvider.name, geminiProvider);
    this.providerMap.set(openAiProvider.name, openAiProvider);
    this.providerMap.set(qwenProvider.name, qwenProvider);
    this.providerMap.set('ollama', qwenProvider);
    this.providerMap.set('qwen2.5:14b', qwenProvider);
    this.providerMap.set('qwen-14b', qwenProvider);
    if (routerProvider) {
      this.providerMap.set(routerProvider.name, routerProvider);
      this.providerMap.set('9router', routerProvider);
    }
  }

  /**
   * Tries `LLM_PROVIDER`, then each `LLM_FALLBACK_PROVIDERS` entry, until one answers. A provider
   * counts as failed when it reports `failed` (config, HTTP, network, timeout) or answers empty.
   * When all fail, the last failure is returned so callers keep today's error message.
   */
  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const chain = this.resolveProviderChain();
    let lastResponse: LlmResponse = { text: 'Không thể xử lý yêu cầu lúc này.', failed: true };

    for (const [index, provider] of chain.entries()) {
      this.logger.debug(`Dispatching prompt to LLM provider: ${provider.name}`);
      const response = await provider.generate(prompt, tools, systemInstruction);
      const next = chain[index + 1];

      if (!response.failed && !isEmptyResponse(response)) {
        if (index > 0) {
          this.logger.log(`LLM answered by fallback provider "${provider.name}"`);
        }
        return this.cleanArguments(response);
      }

      lastResponse = response;
      if (next) {
        this.logger.warn(
          `LLM provider "${provider.name}" ${response.failed ? 'failed' : 'answered empty'}, falling back to "${next.name}"`,
        );
      }
    }

    return this.cleanArguments(lastResponse);
  }

  /** The chain `generate` would use right now, in call order. */
  public getProviderStatuses(): ILlmProviderStatus[] {
    return this.resolveProviderChain().map((provider, index) => ({
      name: provider.name,
      role: index === 0 ? 'primary' : 'fallback',
      ...provider.describe(),
    }));
  }

  /**
   * Tests one provider alone: going through `generate` would report OK from a fallback while this
   * provider is down. The provider's error text is dropped on purpose, it stays in the server log.
   * Returns null for a name outside the chain.
   */
  public async pingProvider(name: string): Promise<ILlmProviderPingResult | null> {
    const provider = this.resolveProviderChain().find((link) => link.name === name);
    if (!provider) return null;
    if (!provider.describe().configured) {
      return { name, status: 'not_configured', latencyMs: null };
    }

    const startedAt = performance.now();
    const response = await provider.generate(PING_PROMPT, undefined, PING_SYSTEM_INSTRUCTION);
    const latencyMs = Math.round(performance.now() - startedAt);

    let status: LlmPingStatus = 'ok';
    if (response.failed) status = 'failed';
    else if (isEmptyResponse(response)) status = 'empty';
    return { name, status, latencyMs };
  }

  /** Ordered, de-duplicated providers; unknown names are skipped with one warning each. */
  private resolveProviderChain(): ILlmProvider[] {
    const primary = (this.configService.get<string>('llm.provider') || 'gemini').toLowerCase();
    const fallbacks = this.configService.get<string[]>('llm.fallbackProviders') ?? [];
    const chain: ILlmProvider[] = [];

    for (const name of [primary, ...fallbacks]) {
      const provider = this.providerMap.get(name.trim().toLowerCase());
      if (!provider) {
        if (!this.warnedUnknownProviders.has(name)) {
          this.warnedUnknownProviders.add(name);
          this.logger.warn(`Unknown LLM provider "${name}" in the provider chain, skipped`);
        }
        continue;
      }
      if (!chain.includes(provider)) chain.push(provider);
    }

    // Same as before the chain existed: an unknown primary falls back to Gemini.
    return chain.length > 0 ? chain : [this.geminiProvider];
  }

  private cleanArguments(response: LlmResponse): LlmResponse {
    if (response.toolCall?.args) {
      response.toolCall.args = cleanToolArguments(response.toolCall.args);
    }
    for (const tc of response.toolCalls ?? []) {
      if (tc.args) {
        tc.args = cleanToolArguments(tc.args);
      }
    }
    return response;
  }
}

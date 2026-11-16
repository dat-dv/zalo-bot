import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ILlmProviderPingResult, LlmPingStatus, LlmProviderKind } from '@zalobot/contracts';
import { ILlmClient, LlmResponse, LlmToolDefinition } from './types/llm.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import {
  LlmProviderConfigService,
  type LlmChainSource,
  type ResolvedLlmProvider,
} from './llm-provider-config.service';
import { cleanToolArguments } from './utils/tool-arguments.util';

const PING_PROMPT = 'ping';
const PING_SYSTEM_INSTRUCTION = 'Reply with exactly one word: pong.';
const NO_PROVIDER_MESSAGE = 'Bot chưa được cấu hình AI nào.';

/** No text and no tool call: free models sometimes answer empty, which is worth a retry elsewhere. */
function isEmptyResponse(response: LlmResponse): boolean {
  return !response.text?.trim() && !response.toolCall && !(response.toolCalls?.length ?? 0);
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** Partial on purpose: a hand-edited database could hold a kind with no client. */
  private readonly clients: Partial<Record<string, ILlmClient>>;
  private warnedEmptyChain = false;

  constructor(
    @Inject(LlmProviderConfigService) private readonly providerConfig: LlmChainSource,
    geminiProvider: GeminiProvider,
    openAiProvider: OpenAiProvider,
    qwenProvider: QwenProvider,
  ) {
    const clients: Record<LlmProviderKind, ILlmClient> = {
      gemini: geminiProvider,
      openai: openAiProvider,
      ollama: qwenProvider,
    };
    this.clients = clients;
  }

  /**
   * Tries each enabled provider of the dashboard-configured chain in order until one answers. A
   * provider counts as failed when it reports `failed` (config, HTTP, network, timeout) or
   * answers empty. When all fail, the last failure is returned so callers keep its message.
   */
  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const chain = await this.providerConfig.getChain();
    if (chain.length === 0) {
      if (!this.warnedEmptyChain) {
        this.warnedEmptyChain = true;
        this.logger.warn('No LLM provider is enabled; add one on the dashboard Settings page.');
      }
      return { text: NO_PROVIDER_MESSAGE, failed: true };
    }
    this.warnedEmptyChain = false;

    let lastResponse: LlmResponse = { text: 'Không thể xử lý yêu cầu lúc này.', failed: true };
    for (const [index, provider] of chain.entries()) {
      this.logger.debug(`Dispatching prompt to LLM provider: ${provider.name}`);
      const response = await this.call(provider, prompt, tools, systemInstruction);
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

  /**
   * Tests one provider alone (turned-off ones too): going through `generate` would report OK
   * from a fallback while this provider is down. The provider's error text is dropped on
   * purpose, it stays in the server log. Returns null for an unknown id.
   */
  public async pingProvider(id: string): Promise<ILlmProviderPingResult | null> {
    const provider = await this.providerConfig.findResolved(id);
    if (!provider) return null;
    const { name } = provider;
    if (!provider.configured) {
      return { name, status: 'not_configured', latencyMs: null };
    }

    const startedAt = performance.now();
    const response = await this.call(provider, PING_PROMPT, undefined, PING_SYSTEM_INSTRUCTION);
    const latencyMs = Math.round(performance.now() - startedAt);

    let status: LlmPingStatus = 'ok';
    if (response.failed) status = 'failed';
    else if (isEmptyResponse(response)) status = 'empty';
    return { name, status, latencyMs };
  }

  private call(
    provider: ResolvedLlmProvider,
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const client = this.clients[provider.kind];
    if (!client) {
      this.logger.warn(`LLM provider "${provider.name}" has unknown kind "${provider.kind}"`);
      return Promise.resolve({ text: 'Không thể xử lý yêu cầu lúc này.', failed: true });
    }
    return client.generate(provider.call, prompt, tools, systemInstruction);
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

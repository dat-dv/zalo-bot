import { Inject, Injectable, Logger } from '@nestjs/common';
import { LlmProviderConfigService, type LlmChainSource } from './llm-provider-config.service';
import type { ResolvedLlmProvider } from './llm-provider-config.service';

/** Google's OpenAI-compatible endpoint, so a Gemini row accepts the same request body. */
export const GEMINI_OPENAI_CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/**
 * Per provider. Longer than the chat's `LLM_TIMEOUT_MS`: building the memory graph of one chunk
 * is a much bigger answer than a chat reply.
 */
export const LLM_PROXY_TIMEOUT_MS = 180_000;

/** Whole request across the chain; passed to the route's request timeout. */
export const LLM_PROXY_REQUEST_TIMEOUT_MS = 600_000;

export interface LlmProxyTarget {
  name: string;
  url: string;
  apiKey: string;
  model: string;
}

export interface LlmProxyResult {
  status: number;
  body: unknown;
}

type RecordBody = Record<string, unknown>;

function isRecord(value: unknown): value is RecordBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function openAiError(message: string): { error: { message: string; type: string } } {
  return { error: { message, type: 'zalobot_llm_proxy' } };
}

/**
 * Where a chain row takes an OpenAI chat-completions body, or null when it cannot: not
 * configured, or a native Ollama `/api/chat` URL whose format is different.
 */
export function proxyTargetFor(provider: ResolvedLlmProvider): LlmProxyTarget | null {
  if (!provider.configured) return null;
  const { apiKey, model } = provider.call;
  const baseUrl = provider.call.baseUrl.replace(/\/+$/, '');
  let url: string | null = null;
  if (provider.kind === 'gemini') {
    url = GEMINI_OPENAI_CHAT_URL;
  } else if (baseUrl.endsWith('/chat/completions')) {
    url = baseUrl;
  } else if (provider.kind === 'openai' || baseUrl.endsWith('/v1')) {
    url = `${baseUrl}/chat/completions`;
  }
  return url ? { name: provider.name, url, apiKey, model } : null;
}

/** A 2xx answer worth returning: a first choice with text or tool calls. */
export function hasUsableChoice(body: unknown): boolean {
  if (!isRecord(body) || !Array.isArray(body.choices)) return false;
  const first: unknown = body.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return false;
  const { content, tool_calls: toolCalls } = first.message;
  if (typeof content === 'string' && content.trim()) return true;
  if (Array.isArray(content) && content.length > 0) return true;
  return Array.isArray(toolCalls) && toolCalls.length > 0;
}

/** Shape check of the incoming body; returns an error message or null. */
export function validateProxyBody(body: unknown): string | null {
  if (!isRecord(body)) return 'Request body must be a JSON object.';
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return '`messages` must be a non-empty array.';
  }
  if (body.stream === true) return 'Streaming is not supported by this endpoint.';
  return null;
}

/**
 * OpenAI-compatible chat completions over the dashboard chain, for Cognee (the chat-memory
 * container) so memory uses the same AIs, keys and fallback as the bot. The body is forwarded
 * as is (messages, tools, response_format…) with only `model` replaced by each row's model,
 * so Cognee's structured output needs no translation. Prompts are never logged.
 */
@Injectable()
export class LlmProxyService {
  private readonly logger = new Logger(LlmProxyService.name);
  private readonly warnedSkipped = new Set<string>();

  constructor(@Inject(LlmProviderConfigService) private readonly providerConfig: LlmChainSource) {}

  public async chatCompletions(body: unknown): Promise<LlmProxyResult> {
    const invalid = validateProxyBody(body);
    if (invalid || !isRecord(body)) {
      return { status: 400, body: openAiError(invalid ?? 'Invalid request body.') };
    }

    const targets = (await this.providerConfig.getChain()).flatMap((provider) => {
      const target = proxyTargetFor(provider);
      if (!target && !this.warnedSkipped.has(provider.id)) {
        this.warnedSkipped.add(provider.id);
        this.logger.warn(
          `LLM provider "${provider.name}" skipped for memory calls: not configured or not OpenAI-compatible.`,
        );
      }
      return target ? [target] : [];
    });
    if (targets.length === 0) {
      return {
        status: 503,
        body: openAiError('No enabled OpenAI-compatible AI in the dashboard chain.'),
      };
    }

    let last: LlmProxyResult = { status: 502, body: openAiError('Every AI of the chain failed.') };
    for (const [index, target] of targets.entries()) {
      last = await this.forward(target, body);
      if (last.status >= 200 && last.status < 300 && hasUsableChoice(last.body)) {
        if (index > 0) this.logger.log(`Memory LLM call answered by fallback "${target.name}".`);
        return last;
      }
      const next = targets[index + 1];
      if (next) {
        this.logger.warn(
          `Memory LLM call: "${target.name}" answered ${last.status}, falling back to "${next.name}".`,
        );
      }
    }
    // A 2xx without a usable choice is still a failure for the caller to retry.
    if (last.status >= 200 && last.status < 300) {
      return { status: 502, body: openAiError('The AI answered without any choice.') };
    }
    return last;
  }

  private async forward(target: LlmProxyTarget, body: RecordBody): Promise<LlmProxyResult> {
    const startedAt = performance.now();
    try {
      const response = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {}),
        },
        body: JSON.stringify({ ...body, model: target.model }),
        signal: AbortSignal.timeout(LLM_PROXY_TIMEOUT_MS),
      });
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = openAiError(text.slice(0, 500) || `HTTP ${response.status}`);
      }
      this.logger.log(
        `Memory LLM call via "${target.name}" -> ${response.status} (${Math.round(performance.now() - startedAt)}ms)`,
      );
      return { status: response.status, body: parsed };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Memory LLM call via "${target.name}" failed: ${message}`);
      return { status: 504, body: openAiError(`AI "${target.name}" did not answer.`) };
    }
  }
}

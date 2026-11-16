import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmClient, LlmCallConfig, LlmResponse, LlmToolDefinition } from '../types/llm.types';
import { cleanToolArguments, normalizeSchemaTypes } from '../utils/tool-arguments.util';
import { resolveLlmTimeoutMs } from '../utils/llm-timeout.util';

/** Any OpenAI-compatible `/chat/completions` endpoint (OpenAI itself, LLM routers…). */
@Injectable()
export class OpenAiProvider implements ILlmClient {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  public async generate(
    config: LlmCallConfig,
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const { apiKey, model } = config;
    const baseUrl = config.baseUrl.replace(/\/+$/, '');

    // No model would leave the choice to the endpoint, which a router may not serve.
    if (!apiKey || !model || !baseUrl) {
      this.logger.warn(
        'OpenAI-compatible base URL, API key or model is missing. Skipping LLM call.',
      );
      return { text: 'Chưa cấu hình API Key cho OpenAI.', failed: true };
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: normalizeSchemaTypes(t.parameters),
        },
      }));
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(resolveLlmTimeoutMs(this.configService)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenAI API error (${response.status}): ${errorText}`);
        return { text: 'Có lỗi khi kết nối tới mô hình AI.', failed: true };
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              function?: {
                name: string;
                arguments: string;
              };
            }>;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };

      // `cached` > 0 shows the static prompt prefix was served from the provider's prompt cache.
      const usage = data.usage;
      if (usage) {
        this.logger.debug(
          `OpenAI tokens: prompt=${usage.prompt_tokens ?? 0} cached=${usage.prompt_tokens_details?.cached_tokens ?? 0} output=${usage.completion_tokens ?? 0}`,
        );
      }

      const message = data.choices?.[0]?.message;

      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCalls = message.tool_calls.map((toolCall) => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(toolCall.function?.arguments || '{}') as Record<
              string,
              unknown
            >;
          } catch {
            parsedArgs = {};
          }
          return {
            name: toolCall.function?.name || '',
            args: cleanToolArguments(parsedArgs),
          };
        });

        return {
          toolCall: toolCalls[0],
          toolCalls,
        };
      }

      return {
        text: message?.content || '',
      };
    } catch (err) {
      this.logger.error(`Failed to call OpenAI API: ${(err as Error).message}`);
      return { text: 'Không thể xử lý yêu cầu lúc này.', failed: true };
    }
  }
}

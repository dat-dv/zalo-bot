import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from '../types/llm.types';
import { cleanToolArguments, normalizeSchemaTypes } from '../utils/tool-arguments.util';

@Injectable()
export class OpenAiProvider implements ILlmProvider {
  public readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const apiKey = this.configService.get<string>('llm.openai.apiKey') || '';
    const model = this.configService.get<string>('llm.openai.model') || 'gpt-4o-mini';
    const baseUrl = (
      this.configService.get<string>('llm.openai.baseUrl') || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');

    if (!apiKey) {
      this.logger.warn('OpenAI API key is missing. Skipping LLM call.');
      return { text: 'Chưa cấu hình API Key cho OpenAI.' };
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenAI API error (${response.status}): ${errorText}`);
        return { text: 'Có lỗi khi kết nối tới mô hình AI.' };
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
      };

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
      return { text: 'Không thể xử lý yêu cầu lúc này.' };
    }
  }
}

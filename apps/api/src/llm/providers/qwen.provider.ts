import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from '../types/llm.types';

@Injectable()
export class QwenProvider implements ILlmProvider {
  public readonly name = 'qwen';
  private readonly logger = new Logger(QwenProvider.name);

  constructor(private readonly configService: ConfigService) {}

  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const rawBaseUrl = (
      this.configService.get<string>('llm.qwen.baseUrl') || 'http://localhost:11434'
    ).replace(/\/+$/, '');
    const model = this.configService.get<string>('llm.qwen.model') || 'qwen2.5:14b';
    const apiKey = this.configService.get<string>('llm.qwen.apiKey') || '';

    // Determine target endpoint: support both native Ollama (/api/chat) and OpenAI-compatible (/v1/chat/completions)
    let endpoint = rawBaseUrl;
    let isOpenAiFormat = false;

    if (endpoint.endsWith('/v1')) {
      endpoint = `${endpoint}/chat/completions`;
      isOpenAiFormat = true;
    } else if (endpoint.endsWith('/chat/completions')) {
      isOpenAiFormat = true;
    } else if (!endpoint.endsWith('/api/chat')) {
      endpoint = `${endpoint}/api/chat`;
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

    if (!isOpenAiFormat) {
      body.stream = false;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Qwen / Ollama error (${response.status}): ${errorText}`);
        if (response.status === 404) {
          return {
            text: `Model "${model}" chưa được tải. Hãy chạy "ollama pull ${model}" trên máy chủ.`,
          };
        }
        return { text: 'Có lỗi khi kết nối tới mô hình Qwen.' };
      }

      const data = (await response.json()) as {
        message?: {
          content?: string;
          tool_calls?: Array<{
            function?: {
              name: string;
              arguments?: unknown;
            };
          }>;
        };
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              function?: {
                name: string;
                arguments?: unknown;
              };
            }>;
          };
        }>;
      };

      const message = data.message || data.choices?.[0]?.message;

      // 1. Check native tool calls from Ollama or OpenAI format
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        let parsedArgs: Record<string, unknown> = {};
        const rawArgs = toolCall.function?.arguments;

        if (typeof rawArgs === 'string') {
          try {
            parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
          } catch {
            parsedArgs = {};
          }
        } else if (typeof rawArgs === 'object' && rawArgs !== null) {
          parsedArgs = rawArgs as Record<string, unknown>;
        }

        return {
          toolCall: {
            name: toolCall.function?.name || '',
            args: parsedArgs,
          },
        };
      }

      const content = message?.content || '';

      // 2. Fallback: Parse <tool_call> tags if Qwen outputs raw tags in text
      if (content.includes('<tool_call>')) {
        const match = content.match(/<tool_call>\s*({[\s\S]*?})\s*<\/tool_call>/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]) as {
              name?: string;
              arguments?: Record<string, unknown>;
              args?: Record<string, unknown>;
            };
            if (parsed.name) {
              return {
                toolCall: {
                  name: parsed.name,
                  args: parsed.arguments || parsed.args || {},
                },
              };
            }
          } catch {
            // Ignore parse failure, return text
          }
        }
      }

      return {
        text: content,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.logger.error(
        `Failed to connect to Qwen/Ollama at ${endpoint}: ${errorMsg}. Make sure Ollama is running.`,
      );
      return {
        text: 'Không thể kết nối tới mô hình Qwen 14B (Ollama). Vui lòng đảm bảo Ollama đang hoạt động.',
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from '../types/llm.types';

@Injectable()
export class GeminiProvider implements ILlmProvider {
  public readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const apiKey = this.configService.get<string>('llm.gemini.apiKey') || '';
    const model = this.configService.get<string>('llm.gemini.model') || 'gemini-2.5-flash';

    if (!apiKey) {
      this.logger.warn('Gemini API key is missing. Skipping LLM call.');
      return { text: 'Chưa cấu hình API Key cho Gemini.' };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools && tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini API error (${response.status}): ${errorText}`);
        return { text: 'Có lỗi khi kết nối tới mô hình AI.' };
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: {
                name: string;
                args?: Record<string, unknown>;
              };
            }>;
          };
        }>;
      };

      const parts = data.candidates?.[0]?.content?.parts || [];

      // Check if model called a tool
      const functionCallPart = parts.find((p) => p.functionCall);
      if (functionCallPart?.functionCall) {
        return {
          toolCall: {
            name: functionCallPart.functionCall.name,
            args: functionCallPart.functionCall.args || {},
          },
        };
      }

      // Otherwise return plain text
      const textPart = parts.find((p) => p.text);
      return {
        text: textPart?.text || '',
      };
    } catch (err) {
      this.logger.error(`Failed to call Gemini API: ${(err as Error).message}`);
      return { text: 'Không thể xử lý yêu cầu lúc này.' };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from '../types/llm.types';
import { OpenAiProvider } from './openai.provider';

/**
 * An OpenAI-compatible LLM router (e.g. 9router) configured apart from `OPENAI_*`, so a real
 * OpenAI account can still be another link of the provider chain.
 */
@Injectable()
export class RouterProvider implements ILlmProvider {
  public readonly name = 'router';
  private readonly logger = new Logger(RouterProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiProvider,
  ) {}

  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const baseUrl = this.configService.get<string>('llm.router.baseUrl') || '';
    const apiKey = this.configService.get<string>('llm.router.apiKey') || '';
    const model = this.configService.get<string>('llm.router.model') || '';
    // No model would silently fall back to the OpenAI default, which a router may not serve.
    if (!baseUrl || !apiKey || !model) {
      this.logger.warn('LLM router base URL, API key or model is missing. Skipping LLM call.');
      return { text: 'Chưa cấu hình LLM router.', failed: true };
    }

    return this.openAiProvider.generateWithConfig(
      { baseUrl, apiKey, model },
      prompt,
      tools,
      systemInstruction,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmProvider, LlmResponse, LlmToolDefinition } from './types/llm.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import { cleanToolArguments } from './utils/tool-arguments.util';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providerMap = new Map<string, ILlmProvider>();

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly qwenProvider: QwenProvider,
  ) {
    this.providerMap.set(geminiProvider.name, geminiProvider);
    this.providerMap.set(openAiProvider.name, openAiProvider);
    this.providerMap.set(qwenProvider.name, qwenProvider);
    this.providerMap.set('ollama', qwenProvider);
    this.providerMap.set('qwen2.5:14b', qwenProvider);
    this.providerMap.set('qwen-14b', qwenProvider);
  }

  public async generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse> {
    const configuredProvider = this.configService.get<string>('llm.provider') || 'gemini';

    const provider = this.providerMap.get(configuredProvider.toLowerCase()) || this.geminiProvider;

    this.logger.debug(
      `Dispatching prompt to LLM provider: ${provider.name} (configured: ${configuredProvider})`,
    );

    const response = await provider.generate(prompt, tools, systemInstruction);

    if (response.toolCall?.args) {
      response.toolCall.args = cleanToolArguments(response.toolCall.args);
    }

    return response;
  }
}

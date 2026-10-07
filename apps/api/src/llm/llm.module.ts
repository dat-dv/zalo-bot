import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  providers: [GeminiProvider, OpenAiProvider, LlmService],
  exports: [LlmService],
})
export class LlmModule {}

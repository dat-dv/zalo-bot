import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';
import { RouterProvider } from './providers/router.provider';

@Module({
  providers: [GeminiProvider, OpenAiProvider, QwenProvider, RouterProvider, LlmService],
  exports: [LlmService],
})
export class LlmModule {}

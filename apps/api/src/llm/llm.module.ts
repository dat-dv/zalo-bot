import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmProviderEntity } from '../database/entities/llm-provider.entity';
import { LlmProviderConfigService } from './llm-provider-config.service';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { QwenProvider } from './providers/qwen.provider';

@Module({
  imports: [TypeOrmModule.forFeature([LlmProviderEntity])],
  providers: [GeminiProvider, OpenAiProvider, QwenProvider, LlmProviderConfigService, LlmService],
  exports: [LlmService, LlmProviderConfigService],
})
export class LlmModule {}

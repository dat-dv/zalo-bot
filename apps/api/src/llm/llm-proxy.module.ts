import { Module } from '@nestjs/common';
import { LlmModule } from './llm.module';
import { LlmProxyController } from './llm-proxy.controller';
import { LlmProxyService } from './llm-proxy.service';

/** The internal OpenAI-compatible endpoint Cognee calls instead of an AI provider directly. */
@Module({
  imports: [LlmModule],
  controllers: [LlmProxyController],
  providers: [LlmProxyService],
})
export class LlmProxyModule {}

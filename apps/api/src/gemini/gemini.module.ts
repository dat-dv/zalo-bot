import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ConversationHistoryService } from './services/conversation-history.service';

@Module({
  providers: [GeminiService, ConversationHistoryService],
  exports: [GeminiService, ConversationHistoryService],
})
export class GeminiModule {}

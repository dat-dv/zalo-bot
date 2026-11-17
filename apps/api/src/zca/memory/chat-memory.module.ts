import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { OcrModule } from '../../ocr/ocr.module';
import { ChannelNotesService } from './channel-notes.service';
import { ChatMemoryService } from './chat-memory.service';
import { ImageTextMemoryService } from './image-text-memory.service';
import { LearnedFactsService } from './learned-facts.service';
import { LocalEmbedder } from './long-term/local-embedder';

/** Standalone so modules outside ZcaModule can use it without a module cycle. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ZcaMessageEntity, ZcaChannelNoteEntity, ZcaLearnedFactEntity]),
    OcrModule,
  ],
  providers: [
    ChatMemoryService,
    ImageTextMemoryService,
    ChannelNotesService,
    LearnedFactsService,
    LocalEmbedder,
  ],
  exports: [
    ChatMemoryService,
    ImageTextMemoryService,
    ChannelNotesService,
    LearnedFactsService,
    LocalEmbedder,
  ],
})
export class ChatMemoryModule {}

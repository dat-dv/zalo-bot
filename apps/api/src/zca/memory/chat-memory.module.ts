import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { ZcaMemoryIngestionEntity } from '../../database/entities/zca-memory-ingestion.entity';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { OcrModule } from '../../ocr/ocr.module';
import { ChannelNotesService } from './channel-notes.service';
import { ChatMemoryService } from './chat-memory.service';
import { ImageTextMemoryService } from './image-text-memory.service';
import { LearnedFactsService } from './learned-facts.service';
import { ShortTermMemoryService } from './short-term-memory.service';
import { CogneeClient } from './long-term/cognee.client';

/** Standalone so modules outside ZcaModule can use it without a module cycle. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ZcaMessageEntity,
      ZcaMemoryIngestionEntity,
      ZcaChannelNoteEntity,
      ZcaLearnedFactEntity,
    ]),
    OcrModule,
  ],
  providers: [
    ChatMemoryService,
    ShortTermMemoryService,
    ImageTextMemoryService,
    ChannelNotesService,
    LearnedFactsService,
    CogneeClient,
  ],
  exports: [
    ChatMemoryService,
    ShortTermMemoryService,
    ImageTextMemoryService,
    ChannelNotesService,
    LearnedFactsService,
    CogneeClient,
  ],
})
export class ChatMemoryModule {}

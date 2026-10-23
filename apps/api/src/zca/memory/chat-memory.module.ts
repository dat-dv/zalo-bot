import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { OcrModule } from '../../ocr/ocr.module';
import { ChatMemoryService } from './chat-memory.service';
import { ImageTextMemoryService } from './image-text-memory.service';
import { ShortTermMemoryService } from './short-term-memory.service';

/** Standalone so modules outside ZcaModule can use it without a module cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([ZcaMessageEntity]), OcrModule],
  providers: [ChatMemoryService, ShortTermMemoryService, ImageTextMemoryService],
  exports: [ChatMemoryService, ShortTermMemoryService, ImageTextMemoryService],
})
export class ChatMemoryModule {}

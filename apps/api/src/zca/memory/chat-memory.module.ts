import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { ChatMemoryService } from './chat-memory.service';
import { ShortTermMemoryService } from './short-term-memory.service';

/** Standalone so modules outside ZcaModule can use it without a module cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([ZcaMessageEntity])],
  providers: [ChatMemoryService, ShortTermMemoryService],
  exports: [ChatMemoryService, ShortTermMemoryService],
})
export class ChatMemoryModule {}

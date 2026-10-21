import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { ChatMemoryService } from './chat-memory.service';

/** Standalone so both ZcaModule (writes) and ZaloModule (reads) use it without a module cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([ZcaMessageEntity])],
  providers: [ChatMemoryService],
  exports: [ChatMemoryService],
})
export class ChatMemoryModule {}

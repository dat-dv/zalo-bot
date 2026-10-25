import { Injectable } from '@nestjs/common';
import type { MemoryLine } from './chat-memory.mapper';
import { ChatMemoryService, type RecentMessagesOptions } from './chat-memory.service';

/**
 * Short-term chat memory: the latest conversation messages of a chat for the prompt. Reads the
 * same `zca_messages` rows as the long-term memory (one store, filtered by `MemoryKind` and age);
 * the former Redis list `zca:short_memory:<threadId>` is no longer written and simply expires.
 */
@Injectable()
export class ShortTermMemoryService {
  constructor(private readonly chatMemory: ChatMemoryService) {}

  public getRecent(channelId: string, options: RecentMessagesOptions): Promise<MemoryLine[]> {
    return this.chatMemory.getRecent(channelId, options);
  }
}

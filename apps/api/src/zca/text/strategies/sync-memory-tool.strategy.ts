import { Injectable, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { MemoryEmbeddingScheduler } from '../../memory/long-term/memory-embedding.scheduler';

/**
 * `/sync`: embeds this chat's messages that are not searchable by meaning yet at once, instead of
 * waiting for the chat to go quiet. The result is posted when the queued job is done.
 */
@Injectable()
export class SyncMemoryToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SYNC_MEMORY;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    @Optional() private readonly scheduler?: MemoryEmbeddingScheduler,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const { chatId } = context;
    if (!context.input.longTermMemory) {
      await this.zcaMessenger.sendMessage(
        chatId,
        '🧠 Kênh này chưa bật Nhớ lâu dài. Admin bật trong "Cấu hình kênh" trên dashboard.',
      );
      return;
    }
    const queued = (await this.scheduler?.requestSync({ channelId: chatId })) ?? false;
    await this.zcaMessenger.sendMessage(
      chatId,
      queued ? '🔄 Đang cập nhật trí nhớ…' : '⚠️ Chưa cập nhật được trí nhớ lúc này, thử lại sau.',
    );
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CogneeClient } from '../../memory/long-term/cognee.client';
import { MemorySegmentScheduler } from '../../memory/long-term/memory-segment.scheduler';

/**
 * `/sync`: sends this chat's past pending days and today's new messages to Cognee at once,
 * instead of waiting for the chat to go quiet. The result is posted when the queued job is done.
 */
@Injectable()
export class SyncMemoryToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SYNC_MEMORY;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    @Optional() private readonly cognee?: CogneeClient,
    @Optional() private readonly scheduler?: MemorySegmentScheduler,
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
    if (!this.cognee?.isEnabled() || !this.scheduler) {
      await this.zcaMessenger.sendMessage(
        chatId,
        '🧠 Máy chủ chưa bật Cognee nên chưa có trí nhớ để cập nhật; bot vẫn tìm lại tin theo từ khoá.',
      );
      return;
    }
    const queued = await this.scheduler.requestSync({ channelId: chatId });
    await this.zcaMessenger.sendMessage(
      chatId,
      queued ? '🔄 Đang cập nhật trí nhớ…' : '⚠️ Chưa cập nhật được trí nhớ lúc này, thử lại sau.',
    );
  }
}

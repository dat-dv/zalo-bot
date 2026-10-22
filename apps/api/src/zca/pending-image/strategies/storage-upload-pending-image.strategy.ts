import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../../zca.service';
import { sendChatText, type ChatMessenger } from '../../chat-messenger.util';
import { PendingImageActionService } from '../pending-image-action.service';
import { MediaStorageService } from '../../../receipt-storage/media-storage.service';
import {
  buildChannelStorageTarget,
  type ChannelStorageTarget,
} from '../../../google/channel-storage.util';
import { ThreadConfigService } from '../../thread-config.service';
import { fetchImageBuffer } from '../../../common/utils/image-fetcher.util';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';
import { isStorageUploadInstruction } from '../../zca-bot-feature.service';

@Injectable()
export class StorageUploadPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(StorageUploadPendingImageStrategy.name);

  private readonly option2Regex =
    /^(?:2|lưu\s*(?:drive|ảnh|anh|photo|lên\s*drive)|luu\s*(?:drive|anh|photo|len\s*drive))(?:\s+.*)?$/i;

  constructor(
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ChatMessenger,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
  ) {}

  private async storageTarget(chatId: string | number): Promise<ChannelStorageTarget> {
    return this.threadConfigService
      ? this.threadConfigService.getStorageTarget(String(chatId))
      : buildChannelStorageTarget(String(chatId));
  }

  public canHandle(text: string): boolean {
    return isStorageUploadInstruction(text) || this.option2Regex.test(text.trim());
  }

  private async notify(chatId: string, text: string): Promise<void> {
    await sendChatText(this.zcaService, chatId, text);
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    if (this.pendingImageActionService) {
      await this.pendingImageActionService.clearPending(context.senderId);
    }

    if (!this.mediaStorageService) {
      await this.notify(
        context.chatId,
        '☁️ Tính năng lưu trữ ảnh lên Google Drive đang được phát triển.',
      );
      return true;
    }

    try {
      const urls = context.pending.receiptUrls?.length
        ? context.pending.receiptUrls
        : [context.pending.receiptUrl];
      const total = urls.length;

      await this.notify(
        context.chatId,
        total > 1
          ? `⏳ Đang tải ${total} ảnh lên Google Drive & Google Photos dùng chung...`
          : '⏳ Đang tải ảnh lên Google Drive & Google Photos dùng chung...',
      );

      const target = await this.storageTarget(context.chatId);
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const buffer = await fetchImageBuffer(url);
        const dualResult = await this.mediaStorageService.uploadImage(
          context.senderId,
          buffer,
          target,
        );
        const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'image');
        const prefix = total > 1 ? `[Ảnh ${i + 1}/${total}]\n` : '';
        await this.notify(context.chatId, `${prefix}${summary}`);
      }
      return true;
    } catch (err) {
      this.logger.error(`Failed to dual upload image: ${(err as Error).message}`);
      await this.notify(
        context.chatId,
        `⚠️ Không thể lưu trữ ảnh lên Google: ${(err as Error).message}`,
      );
      return true;
    }
  }
}

import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../../zca.service';
import { PendingImageActionService } from '../pending-image-action.service';
import { MediaStorageService } from '../../../receipt-storage/media-storage.service';
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
    private readonly zcaService?: ZcaService | { sendMessage?: (a: unknown, b?: unknown) => Promise<unknown>; sendMessageToChat?: (chatId: string | number, text: string) => Promise<unknown> },
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
  ) {}

  public canHandle(text: string): boolean {
    return isStorageUploadInstruction(text) || this.option2Regex.test(text.trim());
  }

  private async notify(chatId: string, text: string): Promise<void> {
    if (!this.zcaService) return;
    if ('sendMessageToChat' in this.zcaService && typeof this.zcaService.sendMessageToChat === 'function') {
      await this.zcaService.sendMessageToChat(chatId, text);
    } else if (typeof (this.zcaService as any).isLoggedIn === 'function') {
      await this.zcaService.sendMessage(text, chatId);
    } else if (typeof this.zcaService.sendMessage === 'function') {
      await (this.zcaService as unknown as { sendMessage(c: string, t: string): Promise<unknown> }).sendMessage(chatId, text);
    }
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

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const buffer = await fetchImageBuffer(url);
        const dualResult = await this.mediaStorageService.uploadImage(context.senderId, buffer, {
          channelId: context.chatId,
        });
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

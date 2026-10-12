import { Injectable, Logger, Optional } from '@nestjs/common';
import { ZaloService } from '../../zalo.service';
import { PendingImageActionService } from '../../pending-image-action.service';
import { MediaStorageService } from '../../../receipt-storage/media-storage.service';
import { fetchImageBuffer } from '../../../common/utils/image-fetcher.util';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';

@Injectable()
export class StorageUploadPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(StorageUploadPendingImageStrategy.name);

  private readonly option2Regex =
    /^(?:2|lưu\s*(?:drive|ảnh|anh|photo|lên\s*drive)|luu\s*(?:drive|anh|photo|len\s*drive))(?:\s+.*)?$/i;

  constructor(
    private readonly zaloService: ZaloService,
    private readonly pendingImageActionService: PendingImageActionService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
  ) {}

  public canHandle(text: string): boolean {
    return this.option2Regex.test(text.trim());
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    await this.pendingImageActionService.clearPending(context.senderId);

    if (!this.mediaStorageService) {
      await this.zaloService.sendMessage(
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

      await this.zaloService.sendMessage(
        context.chatId,
        total > 1
          ? `⏳ Đang tải ${total} ảnh lên Google Drive & Google Photos dùng chung...`
          : '⏳ Đang tải ảnh lên Google Drive & Google Photos dùng chung...',
      );

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const buffer = await fetchImageBuffer(url);
        const dualResult = await this.mediaStorageService.uploadImage(context.senderId, buffer);
        const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'image');
        const prefix = total > 1 ? `[Ảnh ${i + 1}/${total}]\n` : '';
        await this.zaloService.sendMessage(context.chatId, `${prefix}${summary}`);
      }
      return true;
    } catch (err) {
      this.logger.error(`Failed to dual upload image: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể lưu trữ ảnh lên Google: ${(err as Error).message}`,
      );
      return true;
    }
  }
}

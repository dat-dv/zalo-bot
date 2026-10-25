import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../../zca.service';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { PendingImageActionService } from '../pending-image-action.service';
import { LlmService } from '../../../llm/llm.service';
import { OcrService } from '../../../ocr/ocr.service';
import { MediaStorageService } from '../../../receipt-storage/media-storage.service';
import {
  buildChannelStorageTarget,
  type ChannelStorageTarget,
} from '../../../google/channel-storage.util';
import { ThreadConfigService } from '../../thread-config.service';
import { TextToolFactory } from '../../text/text-tool.factory';
import { TextToolType } from '../../text/text-tool.enum';
import { ZALO_TOOL_DEFINITIONS } from '../../text/text-tool.definitions';
import { ZALO_PLAIN_TEXT_INSTRUCTION } from '../../text/zalo-plain-text.util';
import { fetchImageBuffer } from '../../../common/utils/image-fetcher.util';
import { getVietnamDateTimeContext } from '../../../common/utils/datetime.util';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';

@Injectable()
export class CreateBillPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(CreateBillPendingImageStrategy.name);

  private readonly option1Regex = /^(?:1|tạo\s*bill|tao\s*bill)(?:\s+([\s\S]*))?$/i;

  constructor(
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?:
      | ZcaService
      | {
          sendMessage?: (a: unknown, b?: unknown) => Promise<unknown>;
          sendMessageToChat?: (chatId: string | number, text: string) => Promise<unknown>;
        },
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly llmService?: LlmService,
    @Optional() private readonly toolFactory?: TextToolFactory,
    @Optional() private readonly ocrService?: OcrService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
    @Optional() private readonly zcaMessenger?: ZcaMessengerService,
  ) {}

  private async storageTarget(chatId: string | number): Promise<ChannelStorageTarget> {
    return this.threadConfigService
      ? this.threadConfigService.getStorageTarget(String(chatId))
      : buildChannelStorageTarget(String(chatId));
  }

  public canHandle(text: string): boolean {
    return this.option1Regex.test(text.trim());
  }

  private async notify(chatId: string, text: string): Promise<void> {
    if (!this.zcaService) return;
    if (
      'sendMessageToChat' in this.zcaService &&
      typeof this.zcaService.sendMessageToChat === 'function'
    ) {
      await this.zcaService.sendMessageToChat(chatId, text);
    } else if (
      typeof (this.zcaService as unknown as { isLoggedIn?: () => boolean }).isLoggedIn ===
      'function'
    ) {
      await this.zcaService.sendMessage(text, chatId);
    } else if (typeof this.zcaService.sendMessage === 'function') {
      await (
        this.zcaService as unknown as { sendMessage(c: string, t: string): Promise<unknown> }
      ).sendMessage(chatId, text);
    }
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    const match = this.option1Regex.exec(context.text.trim());
    const userNote = match?.[1]?.trim() || '';

    if (this.pendingImageActionService) {
      await this.pendingImageActionService.clearPending(context.senderId);
    }

    await this.notify(context.chatId, '🔍 Đang đọc hoá đơn...');

    let ocrText = '';
    let activeReceiptUrl = context.pending.receiptUrl;

    try {
      const buffer = await fetchImageBuffer(context.pending.receiptUrl);
      if (this.ocrService) {
        ocrText = await this.ocrService.extractTextFromBuffer(buffer);
      }

      if (this.mediaStorageService) {
        try {
          const uploadResult = await this.mediaStorageService.uploadBill(
            context.senderId,
            buffer,
            await this.storageTarget(context.chatId),
            { note: userNote },
          );
          if (uploadResult.drive?.webViewLink) {
            activeReceiptUrl = uploadResult.drive.webViewLink;
          }
        } catch (upErr) {
          this.logger.warn(
            `Could not upload bill to Google Drive/Photos: ${(upErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to read/OCR receipt image: ${(err as Error).message}`);
    }

    const dtContext = getVietnamDateTimeContext(new Date());
    const prompt =
      `Người dùng tải lên một ảnh hóa đơn và chọn [1] TẠO BILL / GHI NHẬN CHI TIÊU.\n` +
      `Ảnh hóa đơn đã được lưu tại: ${activeReceiptUrl}\n` +
      `Ghi chú bổ sung từ người dùng: ${userNote ? `"${userNote}"` : '(không có ghi chú thêm)'}\n\n` +
      `Nội dung văn bản bóc tách từ hóa đơn qua Tesseract OCR:\n` +
      `"""\n` +
      `${ocrText || '(Không nhận diện được nội dung chữ rõ ràng từ ảnh)'}\n` +
      `"""\n\n` +
      `Nhiệm vụ của bạn:\n` +
      `- Phân tích nội dung hóa đơn kết hợp ghi chú của người dùng để gọi công cụ RECORD_TRANSACTION.\n` +
      `- Trích xuất: type ('expense'), amount (tổng số tiền thanh toán từ bill hoặc ghi chú, kiểu number), ` +
      `category (Ăn uống, Mua sắm, Đi lại, Nhà cửa, Sức khỏe, Khác...), ` +
      `note (chi tiết món ăn/nội dung chi tiêu kết hợp ghi chú người dùng), ` +
      `placeName (tên quán/cửa hàng/siêu thị nếu có trên bill), ` +
      `occurredAt (thời gian ghi trên hóa đơn nếu có, quy đổi sang ISO 8601 dựa trên mốc hiện tại ${dtContext.formattedDateTime} - ${dtContext.isoLocal}).\n` +
      `- Gán trường receiptUrl: "${activeReceiptUrl}".\n` +
      `- Gọi công cụ RECORD_TRANSACTION với các tham số trên để tạo yêu cầu xác nhận.`;

    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo.\n\n` +
      `${dtContext.systemInstructionSnippet}\n\n` +
      `Nhiệm vụ: Phân tích hóa đơn đã OCR để gọi công cụ RECORD_TRANSACTION chính xác.\n` +
      `QUY TẮC: Mọi tham số truyền vào arguments PHẢI là giá trị phẳng (primitive: string, number). Luôn truyền đúng receiptUrl: "${activeReceiptUrl}".\n\n` +
      ZALO_PLAIN_TEXT_INSTRUCTION;

    if (!this.llmService || !this.toolFactory) {
      await this.notify(context.chatId, '⚠️ AI chưa sẵn sàng nên chưa ghi được hoá đơn.');
      return true;
    }

    try {
      const runner = () =>
        this.llmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction);
      const response = this.zcaMessenger
        ? await this.zcaMessenger.withTyping(context.chatId, runner)
        : await runner();

      const toolCall = response.toolCall;
      if (toolCall && toolCall.name === (TextToolType.RECORD_TRANSACTION as string)) {
        if (!toolCall.args.receiptUrl) {
          toolCall.args.receiptUrl = context.pending.receiptUrl;
        }
        if (userNote && !toolCall.args.note) {
          toolCall.args.note = userNote;
        }
        const recordStrategy = this.toolFactory.getStrategy(TextToolType.RECORD_TRANSACTION);
        await recordStrategy.execute({
          input: context.input,
          chatId: context.chatId,
          senderId: context.senderId,
          displayName: context.displayName || '',
          text: context.text,
          toolArgs: toolCall.args,
        });
        return true;
      }

      await this.notify(
        context.chatId,
        response.text ||
          '⚠️ Không đọc được số tiền trên hoá đơn. Nhắn lại khoản chi, vd "Ăn trưa 85k".',
      );
      return true;
    } catch (err) {
      this.logger.error(`Failed to process bill image via LLM: ${(err as Error).message}`);
      await this.notify(context.chatId, '⚠️ Lỗi khi đọc hoá đơn. Gửi lại ảnh để thử lại.');
      return true;
    }
  }
}

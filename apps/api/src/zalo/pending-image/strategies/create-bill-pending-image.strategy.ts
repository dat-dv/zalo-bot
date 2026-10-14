import { Injectable, Logger, Optional } from '@nestjs/common';
import { ZaloService } from '../../zalo.service';
import { PendingImageActionService } from '../../pending-image-action.service';
import { LlmService } from '../../../llm/llm.service';
import { OcrService } from '../../../ocr/ocr.service';
import { MediaStorageService } from '../../../receipt-storage/media-storage.service';
import { TextToolFactory } from '../../text/text-tool.factory';
import { TextToolType } from '../../text/text-tool.enum';
import { ZALO_TOOL_DEFINITIONS } from '../../text/text-tool.definitions';
import { fetchImageBuffer } from '../../../common/utils/image-fetcher.util';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';

@Injectable()
export class CreateBillPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(CreateBillPendingImageStrategy.name);

  private readonly option1Regex = /^(?:1|tạo\s*bill|tao\s*bill)(?:\s+([\s\S]*))?$/i;

  constructor(
    private readonly zaloService: ZaloService,
    private readonly pendingImageActionService: PendingImageActionService,
    private readonly llmService: LlmService,
    private readonly toolFactory: TextToolFactory,
    @Optional() private readonly ocrService?: OcrService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
  ) {}

  public canHandle(text: string): boolean {
    return this.option1Regex.test(text.trim());
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    const match = this.option1Regex.exec(context.text.trim());
    const userNote = match?.[1]?.trim() || '';

    await this.pendingImageActionService.clearPending(context.senderId);

    await this.zaloService.sendMessage(
      context.chatId,
      '🔍 Đang quét và bóc tách thông tin hóa đơn bằng Tesseract OCR...',
    );

    let ocrText = '';
    let activeReceiptUrl = context.pending.receiptUrl;

    try {
      const buffer = await fetchImageBuffer(context.pending.receiptUrl);
      if (this.ocrService) {
        ocrText = await this.ocrService.extractTextFromBuffer(buffer);
      }

      if (this.mediaStorageService) {
        try {
          const uploadResult = await this.mediaStorageService.uploadBill(context.senderId, buffer, {
            note: userNote,
            channelId: context.chatId,
          });
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

    const now = new Date().toISOString();
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
      `occurredAt (thời gian ghi trên hóa đơn nếu có, quy đổi sang ISO 8601 dựa trên mốc hiện tại ${now}).\n` +
      `- Gán trường receiptUrl: "${activeReceiptUrl}".\n` +
      `- Gọi công cụ RECORD_TRANSACTION với các tham số trên để tạo yêu cầu xác nhận.`;

    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo. Thời gian hiện tại là: ${now}.\n` +
      `Nhiệm vụ: Phân tích hóa đơn đã OCR để gọi công cụ RECORD_TRANSACTION chính xác.\n` +
      `QUY TẮC: Mọi tham số truyền vào arguments PHẢI là giá trị phẳng (primitive: string, number). Luôn truyền đúng receiptUrl: "${activeReceiptUrl}".`;

    try {
      const response = await this.zaloService.withChatAction(context.chatId, () =>
        this.llmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction),
      );

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

      await this.zaloService.sendMessage(
        context.chatId,
        response.text ||
          '⚠️ Không thể trích xuất chính xác số tiền từ hóa đơn. Bạn vui lòng nhắn lại thông tin chi tiêu (Ví dụ: "Ăn trưa 85k").',
      );
      return true;
    } catch (err) {
      this.logger.error(`Failed to process bill image via LLM: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra trong quá trình phân tích hóa đơn. Vui lòng thử lại.',
      );
      return true;
    }
  }
}

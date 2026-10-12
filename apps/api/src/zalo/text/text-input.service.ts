import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentInput } from '../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { ZALO_TOOL_DEFINITIONS } from './text-tool.definitions';
import { LlmService } from '../../llm/llm.service';
import { ZaloService } from '../zalo.service';
import { TransactionConfirmationService } from '../transaction-confirmation.service';
import { cleanBotMention } from './bot-mention.util';
import { PendingImageActionService } from '../pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { ReceiptImageStorageService } from '../../receipt-storage/receipt-image-storage.service';

@Injectable()
export class TextInputService {
  private readonly logger = new Logger(TextInputService.name);

  constructor(
    private readonly toolFactory: TextToolFactory,
    private readonly llmService: LlmService,
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly ocrService?: OcrService,
    @Optional() private readonly receiptStorageService?: ReceiptImageStorageService,
  ) {}

  public async process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void> {
    const rawText = input.text?.trim() || '';
    const botName =
      this.configService?.get<string>('zalo.botName') ||
      process.env.BOT_NAME ||
      process.env.ZALO_BOT_NAME ||
      'Bot';
    const text = cleanBotMention(rawText, botName);
    input.text = text;
    const chatId = input.chatId || input.senderId;
    const senderId = input.senderId;
    const displayName = input.displayName;

    // 1. Explicit tool override
    if (toolTypeOverride) {
      const strategy = this.toolFactory.getStrategy(toolTypeOverride);
      await strategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
      return;
    }

    // 2. Pending Transaction Confirmation fast-path ("yes 123", "cancel 123", etc.)
    const handledConfirmation = await this.confirmationService.handleCommand(
      senderId,
      chatId,
      text,
    );
    if (handledConfirmation) {
      return;
    }

    // 3. Pending Image Action ("1", "1 ghi chú", "2", "hủy")
    if (this.pendingImageActionService) {
      const handledImage = await this.handlePendingImageAction(
        input,
        senderId,
        chatId,
        displayName,
        text,
      );
      if (handledImage) {
        return;
      }
    }

    // 2. Fast-path for deterministic commands (/start, /help, /echo, /ping, /reset)
    const fastPath = this.toolFactory.resolveFastPathToolType(text);
    if (fastPath) {
      const strategy = this.toolFactory.getStrategy(fastPath);
      await strategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
      return;
    }

    // 3. AI / LLM Tool Calling for natural language processing
    const now = new Date().toISOString();
    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo. Thời gian hiện tại là: ${now}.\n` +
      'Nhiệm vụ của bạn:\n' +
      '- Phân tích yêu cầu của người dùng để gọi công cụ (tool call) phù hợp nhất.\n' +
      '- Về công nợ ("nợ a 100k", "cho Nam vay 200k", "mai trả nợ"): gọi MANAGE_DEBT, xác định chính xác direction (receivable: người ta nợ mình, payable: mình nợ người ta), counterparty, amount, occurredAt (nếu có) và dueAt (nếu có).\n' +
      '- Về thu chi ("ăn trưa 45k", "tiền lương 15tr", "tối qua cà phê 15k"): gọi RECORD_TRANSACTION, xác định type (income, expense), category, amount và occurredAt (nếu có đề cập thời gian trong quá khứ/tương lai, tính chuẩn ISO theo giờ hiện tại).\n' +
      '- Về xóa giao dịch thu chi ("xóa giao dịch có ID...", "hủy khoản chi ăn sáng", "xóa giao dịch gần nhất"): gọi DELETE_TRANSACTION, trích xuất transactionId (UUID nếu có) hoặc query.\n' +
      '- Về nhắc nhở ("mai 9h họp", "15 phút nữa nhắc tắt bếp"): gọi SET_REMINDER, tính toán thời điểm ISO chính xác dựa trên giờ hiện tại.\n' +
      '- Về báo cáo chi tiêu ("hôm nay tiêu bao nhiêu", "báo cáo tài chính"): gọi GET_REPORT.\n' +
      '- Về lịch hẹn Google Calendar ("mai 14h họp dự án", "hẹn cà phê thứ 6 lúc 19h"): gọi CREATE_CALENDAR_EVENT, tính toán startDateTime và endDateTime theo chuẩn ISO 8601.\n' +
      '- Về tra cứu lịch hẹn ("lịch hôm nay", "ngày mai có lịch gì không", "xem lịch tuần này"): gọi LIST_CALENDAR_EVENTS.\n' +
      '- Về xóa lịch hẹn ("hủy lịch họp chiều nay"): gọi DELETE_CALENDAR_EVENT.\n' +
      '- Về việc cần làm ("thêm việc nộp báo cáo", "cần mua sữa chua"): gọi CREATE_TASK, xác định title, due, notes.\n' +
      '- Về tra cứu việc cần làm ("danh sách việc cần làm", "còn việc gì chưa xong"): gọi LIST_TASKS.\n' +
      '- Về hoàn thành việc ("đã xong việc nộp báo cáo"): gọi COMPLETE_TASK.\n' +
      '- Về kết nối Google ("kết nối google", "đăng nhập google"): gọi LOGIN_GOOGLE.\n' +
      '- Nếu người dùng chỉ chào hỏi hoặc trò chuyện, hãy trả lời tự nhiên, ngắn gọn, thân thiện bằng tiếng Việt.\n\n' +
      'QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n' +
      '- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object (ví dụ đúng: {"amount": 15000, "category": "Ăn uống", "type": "expense", "note": "uống cà phê"}, KHÔNG ĐƯỢC: {"amount": {"amount": 15000}}).';

    try {
      const response = await this.zaloService.withChatAction(chatId, () =>
        this.llmService.generate(text, ZALO_TOOL_DEFINITIONS, systemInstruction),
      );

      const toolCall = response.toolCall;

      if (toolCall) {
        this.logger.log(
          `LLM resolved tool "${toolCall.name}" with args: ${JSON.stringify(toolCall.args)}`,
        );

        let strategy;
        try {
          strategy = this.toolFactory.getStrategy(toolCall.name as TextToolType);
        } catch {
          this.logger.warn(
            `Strategy for tool "${toolCall.name}" not found. Falling back to CONVERSATION.`,
          );
          strategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
        }

        await strategy.execute({
          input,
          chatId,
          senderId,
          displayName,
          text,
          toolArgs: toolCall.args,
        });
        return;
      }

      // Plain AI conversational reply
      const conversationStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await conversationStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
        aiReplyText: response.text,
      });
    } catch (err) {
      this.logger.error(`Error in LLM text processing: ${(err as Error).message}`);
      // Fallback to conversation strategy
      const fallbackStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await fallbackStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
    }
  }

  private async handlePendingImageAction(
    input: AgentInput,
    senderId: string,
    chatId: string,
    displayName: string | undefined,
    text: string,
  ): Promise<boolean> {
    if (!this.pendingImageActionService) return false;

    const pending = await this.pendingImageActionService.getPending(senderId);
    if (!pending) return false;

    const trimmed = text.trim();

    // 1. Kiểm tra lệnh hủy
    if (/^(?:hủy|huy|cancel|bỏ\s*qua|bo\s*qua)$/i.test(trimmed)) {
      await this.pendingImageActionService.clearPending(senderId);
      await this.zaloService.sendMessage(chatId, '❌ Đã hủy yêu cầu xử lý hình ảnh hóa đơn.');
      return true;
    }

    // 2. Kiểm tra Option 2: Lưu lên Drive
    if (/^(?:2|lưu\s*drive|luu\s*drive)(?:\s+.*)?$/i.test(trimmed)) {
      await this.pendingImageActionService.clearPending(senderId);
      await this.zaloService.sendMessage(
        chatId,
        '☁️ Tính năng lưu trữ ảnh lên Google Drive đang được phát triển.',
      );
      return true;
    }

    // 3. Kiểm tra Option 1: Tạo bill
    const option1Match = /^(?:1|tạo\s*bill|tao\s*bill)(?:\s+([\s\S]*))?$/i.exec(trimmed);
    if (option1Match) {
      const userNote = option1Match[1]?.trim() || '';
      await this.zaloService.sendMessage(
        chatId,
        '🔍 Đang quét và bóc tách thông tin hóa đơn bằng Tesseract OCR...',
      );

      let ocrText = '';
      if (this.receiptStorageService && this.ocrService) {
        try {
          const buffer = await this.receiptStorageService.read(senderId, pending.receiptUrl);
          ocrText = await this.ocrService.extractTextFromBuffer(buffer);
        } catch (err) {
          this.logger.warn(`Failed to read/OCR receipt image: ${(err as Error).message}`);
        }
      }

      const now = new Date().toISOString();
      const prompt =
        `Người dùng tải lên một ảnh hóa đơn và chọn [1] TẠO BILL / GHI NHẬN CHI TIÊU.\n` +
        `Ảnh hóa đơn đã được lưu tại: ${pending.receiptUrl}\n` +
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
        `- Gán trường receiptUrl: "${pending.receiptUrl}".\n` +
        `- Gọi công cụ RECORD_TRANSACTION với các tham số trên để tạo yêu cầu xác nhận.`;

      const systemInstruction =
        `Bạn là trợ lý cá nhân thông minh trên Zalo. Thời gian hiện tại là: ${now}.\n` +
        `Nhiệm vụ: Phân tích hóa đơn đã OCR để gọi công cụ RECORD_TRANSACTION chính xác.\n` +
        `QUY TẮC: Mọi tham số truyền vào arguments PHẢI là giá trị phẳng (primitive: string, number). Luôn truyền đúng receiptUrl: "${pending.receiptUrl}".`;

      try {
        const response = await this.zaloService.withChatAction(chatId, () =>
          this.llmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction),
        );

        const toolCall = response.toolCall;
        if (toolCall && toolCall.name === TextToolType.RECORD_TRANSACTION) {
          if (!toolCall.args.receiptUrl) {
            toolCall.args.receiptUrl = pending.receiptUrl;
          }
          if (userNote && !toolCall.args.note) {
            toolCall.args.note = userNote;
          }

          const strategy = this.toolFactory.getStrategy(TextToolType.RECORD_TRANSACTION);
          await strategy.execute({
            input,
            chatId,
            senderId,
            displayName,
            text,
            toolArgs: toolCall.args,
          });

          await this.pendingImageActionService.clearPending(senderId);
          return true;
        }

        // Nếu LLM không gọi được RECORD_TRANSACTION (do OCR mờ hoặc thiếu thông tin)
        await this.zaloService.sendMessage(
          chatId,
          response.text ||
            '⚠️ Không thể trích xuất chính xác số tiền từ hóa đơn. Bạn vui lòng nhắn lại thông tin chi tiêu (Ví dụ: "Ăn trưa 85k").',
        );
        await this.pendingImageActionService.clearPending(senderId);
        return true;
      } catch (err) {
        this.logger.error(`Error processing OCR with LLM: ${(err as Error).message}`);
        await this.zaloService.sendMessage(
          chatId,
          '⚠️ Có lỗi xảy ra trong quá trình phân tích hóa đơn. Vui lòng thử lại.',
        );
        await this.pendingImageActionService.clearPending(senderId);
        return true;
      }
    }

    // Nếu người dùng nhắn text bất kỳ mà không phải 1, 2, hủy
    await this.zaloService.sendMessage(
      chatId,
      `⚠️ Bạn đang có 1 ảnh hóa đơn chờ xử lý:\n\n1️⃣ Tạo bill (Gõ: "1" hoặc "1 <ghi chú>")\n2️⃣ Lưu Google Drive (Gõ: "2")\n\n👉 Hoặc gõ "hủy" để tiếp tục cuộc trò chuyện bình thường.`,
    );
    return true;
  }
}

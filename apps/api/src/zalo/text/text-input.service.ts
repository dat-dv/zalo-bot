import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentInput } from '../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { ZALO_TOOL_DEFINITIONS } from './text-tool.definitions';
import { LlmService } from '../../llm/llm.service';
import { ZaloService } from '../zalo.service';
import { TransactionConfirmationService, PendingAction } from '../transaction-confirmation.service';
import { cleanBotMention } from './bot-mention.util';
import { PendingImageActionService } from '../pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';

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
    @Optional() private readonly mediaStorageService?: MediaStorageService,
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

    // Bỏ qua nếu tin nhắn ảnh nhưng không có nội dung text hợp lệ sau khi làm sạch mention
    if (!text && input.type === 'image') {
      return;
    }

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

    // 2. Pending Transaction Confirmation fast-path ("yes 123", "cancel 123", "edit 123 ...", etc.)
    const handledConfirmation = await this.confirmationService.handleCommand(
      senderId,
      chatId,
      text,
      async (pending, instruction) => {
        await this.handleEditPendingAction(input, pending, instruction);
      },
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

    // Nếu người dùng chỉ gõ số "1" hoặc "2" đơn lẻ nhưng hiện không có ảnh nào chờ xử lý (tránh LLM gọi nhầm tool)
    if (/^[12]$/.test(text.trim())) {
      await this.zaloService.sendMessage(
        chatId,
        '💡 Hiện không có hình ảnh hoặc giao dịch nào đang chờ xử lý. Bạn có thể gửi ảnh mới hoặc nhập yêu cầu cụ thể (Ví dụ: "ăn trưa 45k", "mai 9h họp").',
      );
      return;
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
      '- Về tạo địa điểm / nơi chốn ("tạo nơi chốn Landmark 81", "thêm địa điểm aeon", "lưu nơi chốn Bến Thành"): gọi CREATE_PLACE, xác định name.\n' +
      '- Về KẾT NỐI / ĐĂNG NHẬP tài khoản Google (chỉ khi người dùng nói rõ muốn "kết nối google", "đăng nhập google", "liên kết tài khoản google", "đổi tài khoản gmail"): gọi LOGIN_GOOGLE. KHÔNG dùng LOGIN_GOOGLE khi người dùng hỏi đường dẫn, link, folder.\n' +
      '- Về kho lưu trữ hình ảnh/hóa đơn/video của bot: Bot tự động lưu tất cả ảnh/hóa đơn/video người dùng gửi lên Google Drive (thư mục zalobot/bill, zalobot/image, zalobot/video) và Google Photos (album "ZaloBot - Hóa đơn", "ZaloBot - Hình ảnh", "ZaloBot - Video"). Khi người dùng hỏi nơi lưu ảnh, link xem ảnh/hóa đơn/video, đường dẫn folder, link drive, link album: gọi GET_STORAGE_LINKS, xác định type (bill/image/video/all).\n' +
      '- Nếu người dùng chỉ chào hỏi hoặc trò chuyện, hãy trả lời tự nhiên, ngắn gọn, thân thiện bằng tiếng Việt.\n\n' +
      'QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n' +
      '- TÁCH CÁC HÀNH ĐỘNG ĐỘC LẬP: Khi người dùng đưa ra một câu chứa NHIỀU YÊU CẦU / NHIỀU HÀNH ĐỘNG ĐỘC LẬP (ví dụ: "tối nay đi ăn tối hết 80k ở bến thành sau đó đi uống nước 90k ở aeon", hoặc vừa ăn uống vừa tạo lịch, nhiều khoản chi tiêu trong cùng 1 câu), bạn PHẢI gọi đồng thời NHIỀU TOOL CALLS tương ứng cho từng hành động riêng biệt. Tuyệt đối không gộp chung vào 1 tool hay bỏ sót bất kỳ hành động nào.\n' +
      '- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object (ví dụ đúng: {"amount": 15000, "category": "Ăn uống", "type": "expense", "note": "uống cà phê"}, KHÔNG ĐƯỢC: {"amount": {"amount": 15000}}).';

    try {
      const response = await this.zaloService.withChatAction(chatId, () =>
        this.llmService.generate(text, ZALO_TOOL_DEFINITIONS, systemInstruction),
      );

      const toolCalls =
        response.toolCalls && response.toolCalls.length > 0
          ? response.toolCalls
          : response.toolCall
            ? [response.toolCall]
            : [];

      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
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
        }
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

    // 1. Kiểm tra lệnh hủy (hỗ trợ cả hủy và huỷ)
    if (
      /^(?:hủy|huỷ|huy|cancel|bỏ\s*qua|bo\s*qua|dừng|dung|không|khong|ko)(?:\s+(?:ảnh|anh|nhé|nhe|ạ|a))?$/i.test(
        trimmed,
      )
    ) {
      await this.pendingImageActionService.clearPending(senderId);
      await this.zaloService.sendMessage(chatId, '❌ Đã hủy yêu cầu xử lý hình ảnh.');
      return true;
    }

    // 2. Kiểm tra Option 2: Lưu lên Drive & Photos
    if (
      /^(?:2|lưu\s*(?:drive|ảnh|anh|photo|lên\s*drive)|luu\s*(?:drive|anh|photo|len\s*drive))(?:\s+.*)?$/i.test(
        trimmed,
      )
    ) {
      await this.pendingImageActionService.clearPending(senderId);

      if (this.mediaStorageService) {
        try {
          const urls = pending.receiptUrls?.length ? pending.receiptUrls : [pending.receiptUrl];
          const total = urls.length;

          await this.zaloService.sendMessage(
            chatId,
            total > 1
              ? `⏳ Đang tải ${total} ảnh lên Google Drive & Google Photos dùng chung...`
              : '⏳ Đang tải ảnh lên Google Drive & Google Photos dùng chung...',
          );

          for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const buffer = await this.getImageBuffer(url);
            const dualResult = await this.mediaStorageService.uploadImage(senderId, buffer);
            const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'image');
            const prefix = total > 1 ? `[Ảnh ${i + 1}/${total}]\n` : '';
            await this.zaloService.sendMessage(chatId, `${prefix}${summary}`);
          }
          return true;
        } catch (err) {
          this.logger.error(`Failed to dual upload image: ${(err as Error).message}`);
          await this.zaloService.sendMessage(
            chatId,
            `⚠️ Không thể lưu trữ ảnh lên Google: ${(err as Error).message}`,
          );
          return true;
        }
      }

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
      let activeReceiptUrl = pending.receiptUrl;

      try {
        const buffer = await this.getImageBuffer(pending.receiptUrl);
        if (this.ocrService) {
          ocrText = await this.ocrService.extractTextFromBuffer(buffer);
        }

        if (this.mediaStorageService) {
          try {
            const uploadResult = await this.mediaStorageService.uploadBill(senderId, buffer, {
              note: userNote,
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
        const response = await this.zaloService.withChatAction(chatId, () =>
          this.llmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction),
        );

        const toolCall = response.toolCall;
        if (toolCall && toolCall.name === (TextToolType.RECORD_TRANSACTION as string)) {
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

    // Nếu người dùng nhắn nội dung khác (không chọn 1, 2 hay lệnh hủy):
    // Tự động xóa pending ảnh và cho người dùng làm tiếp cuộc trò chuyện bình thường.
    await this.pendingImageActionService.clearPending(senderId);
    return false;
  }

  public async handleEditPendingAction(
    input: AgentInput,
    pending: PendingAction,
    instruction: string,
  ): Promise<void> {
    const chatId = input.chatId || input.senderId;
    const senderId = input.senderId;
    const displayName = input.displayName;
    const now = new Date().toISOString();

    const previousInfoLines: string[] = [
      `- Loại thao tác (Tool Call trước đó): ${pending.actionType}`,
      `- Tiêu đề: ${pending.title}`,
    ];
    if (pending.rawPrompt) {
      previousInfoLines.push(`- Yêu cầu ban đầu của người dùng: "${pending.rawPrompt}"`);
    }
    previousInfoLines.push(`- Dữ liệu tham số hiện tại:`, JSON.stringify(pending.payload, null, 2));

    const prompt =
      `Người dùng đang chỉnh sửa / cung cấp lại ngữ cảnh cho yêu cầu thao tác đang chờ xác nhận (mã: ${pending.code}).\n\n` +
      `[NGỮ CẢNH THAO TÁC TRƯỚC ĐÓ]\n` +
      `${previousInfoLines.join('\n')}\n\n` +
      `[YÊU CẦU ĐIỀU CHỈNH / CONTEXT MỚI TỪ NGƯỜI DÙNG]\n` +
      `"${instruction}"\n\n` +
      `Nhiệm vụ của bạn:\n` +
      `- Phân tích kỹ yêu cầu điều chỉnh của người dùng dựa trên ngữ cảnh và dữ liệu tham số hiện tại.\n` +
      `- Giữ nguyên các thông tin cũ nếu người dùng không yêu cầu thay đổi.\n` +
      `- Cập nhật, thay đổi hoặc bổ sung các trường thông tin theo đúng yêu cầu mới của người dùng.\n` +
      `- Gọi lại công cụ (tool call) phù hợp nhất (${pending.actionType} hoặc công cụ tương ứng) với các tham số đã cập nhật hoàn chỉnh để tạo yêu cầu xác nhận mới.\n` +
      `- Nếu người dùng đổi ý sang hành động khác, hãy gọi công cụ phù hợp với ý định mới.\n\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.`;

    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo. Thời gian hiện tại là: ${now}.\n` +
      `Nhiệm vụ: Cập nhật thông tin thao tác dựa trên ngữ cảnh thao tác trước đó và yêu cầu điều chỉnh của người dùng để gọi công cụ phù hợp.\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.`;

    try {
      const response = await this.zaloService.withChatAction(chatId, () =>
        this.llmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction),
      );

      const toolCall = response.toolCall;
      if (toolCall) {
        this.logger.log(
          `LLM resolved updated tool "${toolCall.name}" with args: ${JSON.stringify(toolCall.args)}`,
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
          text: instruction,
          toolArgs: toolCall.args,
        });
        return;
      }

      // Plain AI conversational reply if LLM didn't return a tool call
      const conversationStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await conversationStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text: instruction,
        aiReplyText: response.text,
      });
    } catch (err) {
      this.logger.error(`Failed to handle edit pending action: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        chatId,
        `⚠️ Có lỗi xảy ra khi xử lý điều chỉnh yêu cầu: ${(err as Error).message}`,
      );
    }
  }

  private async getImageBuffer(url: string): Promise<Buffer> {
    if (!url) {
      throw new Error('Đường dẫn ảnh không tồn tại.');
    }
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1] || url;
      return Buffer.from(base64Data, 'base64');
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Tải ảnh thất bại: HTTP ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return Buffer.from(url);
  }
}

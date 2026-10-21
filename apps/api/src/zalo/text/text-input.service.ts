import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentInput } from '../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import {
  ZALO_TOOL_DEFINITIONS,
  isTextToolType,
  selectToolDefinitions,
} from './text-tool.definitions';
import { LlmService } from '../../llm/llm.service';
import { ZaloService } from '../zalo.service';
import {
  TransactionConfirmationService,
  PendingAction,
} from '../../zca/confirmation/transaction-confirmation.service';
import { cleanBotMention } from './bot-mention.util';
import { PendingImageActionService } from '../../zca/pending-image/pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';

import { PendingImageActionDispatcher } from '../../zca/pending-image/pending-image-dispatcher.service';
import { CancelPendingImageStrategy } from '../../zca/pending-image/strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from '../../zca/pending-image/strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from '../../zca/pending-image/strategies/create-bill-pending-image.strategy';
import { getVietnamDateTimeContext } from '../../common/utils/datetime.util';
import { ChatMemoryService } from '../../zca/memory/chat-memory.service';
import { formatMemoryLine } from '../../zca/memory/chat-memory.mapper';

/**
 * Appended to the prompt when free chat is allowed. Without it the tool-heavy prompt makes the
 * LLM treat general questions as out of scope and refuse ("em chỉ là trợ lý tài chính").
 */
const CHIT_CHAT_INSTRUCTION =
  'TRÒ CHUYỆN TỰ DO:\n' +
  '- Ngoài các tác vụ có công cụ, bạn ĐƯỢC PHÉP và NÊN trả lời mọi câu hỏi tổng quát (kiến thức, giải trí, phim ảnh, âm nhạc, ẩm thực, du lịch, học tập, tư vấn...) một cách tự nhiên, hữu ích, ngắn gọn bằng tiếng Việt.\n' +
  '- KHÔNG từ chối với lý do bạn "chỉ là trợ lý tài chính / lịch hẹn / công việc".\n' +
  '- Với câu hỏi cần dữ liệu thời gian thực (lịch chiếu, giá cả, thời tiết, tin tức): trả lời bằng kiến thức bạn có, nói ngắn gọn rằng thông tin có thể chưa cập nhật và gợi ý nguồn để kiểm tra.\n' +
  '- Chỉ gọi công cụ khi người dùng thực sự yêu cầu một thao tác có công cụ tương ứng.';

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
    @Optional() private pendingImageDispatcher?: PendingImageActionDispatcher,
    @Optional() private readonly chatMemoryService?: ChatMemoryService,
  ) {
    if (!this.pendingImageDispatcher && this.pendingImageActionService) {
      // Auto-wire default strategies when dispatcher is not injected (e.g. in standalone tests)
      const cancelStrategy = new CancelPendingImageStrategy(
        this.zaloService,
        this.pendingImageActionService,
      );
      const storageStrategy = new StorageUploadPendingImageStrategy(
        this.zaloService,
        this.pendingImageActionService,
        this.mediaStorageService,
      );
      const billStrategy = new CreateBillPendingImageStrategy(
        this.zaloService,
        this.pendingImageActionService,
        this.llmService,
        this.toolFactory,
        this.ocrService,
        this.mediaStorageService,
      );
      this.pendingImageDispatcher = new PendingImageActionDispatcher(
        cancelStrategy,
        storageStrategy,
        billStrategy,
        this.pendingImageActionService,
      );
    }
  }

  public async process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void> {
    const rawText = input.text?.trim() || '';
    const botName =
      this.configService?.get<string>('zalo.botName') ||
      process.env.BOT_NAME ||
      process.env.ZALO_BOT_NAME ||
      'Bot';
    const text = cleanBotMention(rawText, botName, input.triggerPrefixes);
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

    // 3. Pending Image Action ("1", "1 ghi chú", "2", "hủy") via Strategy Dispatcher
    if (this.pendingImageDispatcher) {
      const handledImage = await this.pendingImageDispatcher.dispatch(
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
    const timeZone =
      this.configService?.get<string>('timezone') ||
      process.env.DEFAULT_TIMEZONE ||
      'Asia/Ho_Chi_Minh';
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);
    const recentContext = await this.buildRecentContextBlock(chatId, input.messageId, timeZone);
    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo.\n\n` +
      `${dtContext.systemInstructionSnippet}\n\n` +
      'Nhiệm vụ của bạn:\n' +
      '- Phân tích yêu cầu của người dùng để gọi công cụ (tool call) phù hợp nhất.\n' +
      '- Về công nợ ("nợ a 100k", "cho Nam vay 200k", "mai trả nợ"): gọi MANAGE_DEBT, xác định chính xác direction (receivable: người ta nợ mình, payable: mình nợ người ta), counterparty, amount, occurredAt (nếu có) và dueAt (nếu có).\n' +
      '- Về thu chi ("ăn trưa 45k", "tiền lương 15tr", "tối qua cà phê 15k"): gọi RECORD_TRANSACTION, xác định type (income, expense), category, amount, occurredAt (thời gian nếu có đề cập trong quá khứ/tương lai, tính chuẩn ISO theo giờ hiện tại), placeName (địa điểm/nơi chốn nếu có), paymentMethod (phương thức thanh toán nếu có).\n' +
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
      '- Về chuyện đã trao đổi trong cuộc chat này trước đây ("năm ngoái mình đi đâu", "hôm trước Nam nói gì", "tháng 5 nhóm hẹn ở đâu"): gọi SEARCH_CHAT_HISTORY, sinh keywords gồm từ khóa và từ đồng nghĩa, tính fromDate/toDate (YYYY-MM-DD) nếu câu hỏi có mốc thời gian.\n' +
      '- Về kho lưu trữ hình ảnh/hóa đơn/video của bot: Bot tự động lưu tất cả ảnh/hóa đơn/video người dùng gửi lên Google Drive (thư mục zalobot/bill, zalobot/image, zalobot/video) và Google Photos (album "ZaloBot - Hóa đơn", "ZaloBot - Hình ảnh", "ZaloBot - Video"). Khi người dùng hỏi nơi lưu ảnh, link xem ảnh/hóa đơn/video, đường dẫn folder, link drive, link album: gọi GET_STORAGE_LINKS, xác định type (bill/image/video/all).\n' +
      '- Nếu người dùng chỉ chào hỏi hoặc trò chuyện, hãy trả lời tự nhiên, ngắn gọn, thân thiện bằng tiếng Việt.\n\n' +
      'QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n' +
      '- TÁCH CÁC HÀNH ĐỘNG ĐỘC LẬP: Khi người dùng đưa ra một câu chứa NHIỀU YÊU CẦU / NHIỀU HÀNH ĐỘNG ĐỘC LẬP (ví dụ: "tối nay đi ăn tối hết 80k ở bến thành sau đó đi uống nước 90k ở aeon", hoặc vừa ăn uống vừa tạo lịch, nhiều khoản chi tiêu trong cùng 1 câu), bạn PHẢI gọi đồng thời NHIỀU TOOL CALLS tương ứng cho từng hành động riêng biệt. Tuyệt đối không gộp chung vào 1 tool hay bỏ sót bất kỳ hành động nào.\n' +
      '- KẾ THỪA NGỮ CẢNH DÙNG CHUNG: Khi câu chứa nhiều hành động/giao dịch cùng chia sẻ ngữ cảnh chung (như địa điểm "ở...", thời gian "hôm nay...", hoặc phương thức thanh toán "chuyển khoản/tiền mặt..."), ví dụ: "hôm nay mua cà phê 13k và mua nước cam 20k ở đối diện ctgroup", bạn PHẢI điền đầy đủ các thông tin dùng chung đó (thời gian occurredAt, địa điểm placeName: "đối diện ctgroup", phương thức paymentMethod) cho TẤT CẢ các tool call tương ứng của các giao dịch đó, không được bỏ sót ở bất kỳ giao dịch nào. Nếu từng hành động có địa điểm hoặc thời gian riêng (ví dụ: "ở bến thành... sau đó ở aeon...") thì giữ đúng thông tin riêng của từng hành động.\n' +
      '- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object (ví dụ đúng: {"amount": 15000, "category": "Ăn uống", "type": "expense", "note": "uống cà phê"}, KHÔNG ĐƯỢC: {"amount": {"amount": 15000}}).' +
      (input.allowAiChat !== false ? `\n\n${CHIT_CHAT_INSTRUCTION}` : '') +
      recentContext;

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
        this.propagateSharedTransactionContext(toolCalls);
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
            if (input.allowAiChat === false) {
              return;
            }
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

      // Plain AI conversational reply; free chat disabled (allowAiChat === false) means stay silent.
      if (input.allowAiChat === false) {
        this.logger.debug(
          `[TextInputService] allowAiChat is disabled in thread ${chatId}. Remaining silent.`,
        );
        return;
      }

      // A tool-free second pass answers without the tool catalog biasing the reply toward refusals;
      // the first pass text stays as fallback.
      const chitChatReply = await this.zaloService.withChatAction(chatId, () =>
        this.generateChitChatReply(text, dtContext.systemInstructionSnippet + recentContext),
      );

      const conversationStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await conversationStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
        aiReplyText: chitChatReply ?? response.text,
      });
    } catch (err) {
      this.logger.error(`Error in LLM text processing: ${(err as Error).message}`);
      if (input.allowAiChat === false) {
        return;
      }
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

  public async handleEditPendingAction(
    input: AgentInput,
    pending: PendingAction,
    instruction: string,
  ): Promise<void> {
    const chatId = input.chatId || input.senderId;
    const senderId = input.senderId;
    const displayName = input.displayName;

    // An edit may only re-issue the same kind of action: exposing every tool here would let any
    // group member reach unrelated tools (storage links, reports...) through "edit <code> ...".
    const editTool = isTextToolType(pending.actionType) ? pending.actionType : undefined;
    if (!editTool) {
      await this.zaloService.sendMessage(
        chatId,
        `⚠️ Yêu cầu mã "${pending.code}" không hỗ trợ chỉnh sửa. Vui lòng gõ "cancel ${pending.code}" và tạo lại yêu cầu mới.`,
      );
      return;
    }

    const timeZone =
      this.configService?.get<string>('timezone') ||
      process.env.DEFAULT_TIMEZONE ||
      'Asia/Ho_Chi_Minh';
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);

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
      `- Gọi lại công cụ ${editTool} với các tham số đã cập nhật hoàn chỉnh để tạo yêu cầu xác nhận mới.\n\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.`;

    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo.\n\n` +
      `${dtContext.systemInstructionSnippet}\n\n` +
      `Nhiệm vụ: Cập nhật thông tin thao tác dựa trên ngữ cảnh thao tác trước đó và yêu cầu điều chỉnh của người dùng để gọi công cụ phù hợp.\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.`;

    try {
      const response = await this.zaloService.withChatAction(chatId, () =>
        this.llmService.generate(prompt, selectToolDefinitions([editTool]), systemInstruction),
      );

      const toolCall = response.toolCall;
      if (toolCall && toolCall.name !== editTool) {
        this.logger.warn(
          `[TextInputService] Edit of "${pending.code}" resolved tool "${toolCall.name}" instead of "${editTool}". Skipping.`,
        );
        return;
      }
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
          if (input.allowAiChat === false) {
            return;
          }
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
      if (input.allowAiChat === false) {
        return;
      }
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

  /**
   * Short-term chat memory: the latest messages of this chat, so follow-ups ("thế tháng 5 thì
   * sao?") make sense. Empty when chat memory is off or the chat is not a listened ZCA thread.
   * The block forbids tool calls on its content, so old messages are never recorded twice.
   */
  private async buildRecentContextBlock(
    chatId: string,
    currentMessageId: string | undefined,
    timeZone: string,
  ): Promise<string> {
    const memory = this.chatMemoryService;
    if (!memory?.isEnabled()) return '';
    const size = memory.getContextWindowSize();
    if (size === 0) return '';
    const lines = await memory.getRecentWindow(chatId, size, currentMessageId);
    if (lines.length === 0) return '';
    return (
      '\n\nNGỮ CẢNH GẦN ĐÂY CỦA CUỘC CHAT (chỉ để hiểu câu hỏi hiện tại; TUYỆT ĐỐI KHÔNG gọi tool ' +
      'cho các yêu cầu nằm trong khối này, chúng đã được xử lý trước đó):\n' +
      lines.map((line) => formatMemoryLine(line, timeZone)).join('\n')
    );
  }

  /** Tool-free free-chat reply; `undefined` when empty or failed so the caller can fall back. */
  private async generateChitChatReply(
    text: string,
    dateTimeSnippet: string,
  ): Promise<string | undefined> {
    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo.\n\n` +
      `${dateTimeSnippet}\n\n` +
      'Hãy trả lời tin nhắn của người dùng một cách tự nhiên, thân thiện, ngắn gọn bằng tiếng Việt.\n\n' +
      CHIT_CHAT_INSTRUCTION;
    try {
      const response = await this.llmService.generate(text, undefined, systemInstruction);
      const reply = response.text?.trim();
      return reply ? reply : undefined;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      this.logger.warn(`[TextInputService] Chit-chat generation failed: ${message}`);
      return undefined;
    }
  }

  private propagateSharedTransactionContext(
    toolCalls: Array<{ name: string; args?: Record<string, unknown> }>,
  ): void {
    if (!toolCalls || toolCalls.length <= 1) return;

    const txCalls = toolCalls.filter(
      (tc) =>
        tc.name === (TextToolType.RECORD_TRANSACTION as string) &&
        tc.args &&
        typeof tc.args === 'object',
    );

    if (txCalls.length <= 1) return;

    // 1. Kiểm tra ngữ cảnh thời gian giữa các giao dịch
    const occurredTimes = txCalls
      .map((tc) => (typeof tc.args?.occurredAt === 'string' ? tc.args.occurredAt.trim() : ''))
      .filter(Boolean);
    const uniqueTimes = Array.from(new Set(occurredTimes));
    const isSameTimeContext = uniqueTimes.length <= 1;

    // 2. Kế thừa occurredAt nếu chỉ có đúng 1 mốc thời gian duy nhất cho cả câu
    if (uniqueTimes.length === 1 && occurredTimes.length < txCalls.length) {
      const sharedTime = uniqueTimes[0];
      for (const tc of txCalls) {
        if (tc.args && !tc.args.occurredAt) {
          tc.args.occurredAt = sharedTime;
        }
      }
    }

    // 3. Kế thừa placeName nếu các giao dịch trong cùng ngữ cảnh thời gian và chỉ có đúng 1 địa điểm được nêu
    if (isSameTimeContext) {
      const placeNames = txCalls
        .map((tc) => (typeof tc.args?.placeName === 'string' ? tc.args.placeName.trim() : ''))
        .filter(Boolean);
      const uniquePlaces = Array.from(new Set(placeNames.map((p) => p.toLowerCase())));

      if (uniquePlaces.length === 1 && placeNames.length < txCalls.length) {
        const sharedPlace = placeNames[0];
        for (const tc of txCalls) {
          if (tc.args && (!tc.args.placeName || !(tc.args.placeName as string).trim())) {
            tc.args.placeName = sharedPlace;
          }
        }
      }

      // 4. Kế thừa paymentMethod tương tự
      const paymentMethods = txCalls
        .map((tc) =>
          typeof tc.args?.paymentMethod === 'string' ? tc.args.paymentMethod.trim() : '',
        )
        .filter(Boolean);
      const uniquePayments = Array.from(new Set(paymentMethods.map((p) => p.toLowerCase())));

      if (uniquePayments.length === 1 && paymentMethods.length < txCalls.length) {
        const sharedPayment = paymentMethods[0];
        for (const tc of txCalls) {
          if (tc.args && (!tc.args.paymentMethod || !(tc.args.paymentMethod as string).trim())) {
            tc.args.paymentMethod = sharedPayment;
          }
        }
      }
    }
  }
}

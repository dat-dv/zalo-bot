import { Injectable, Logger } from '@nestjs/common';
import { AgentInput } from '../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { ZALO_TOOL_DEFINITIONS } from './text-tool.definitions';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class TextInputService {
  private readonly logger = new Logger(TextInputService.name);

  constructor(
    private readonly toolFactory: TextToolFactory,
    private readonly llmService: LlmService,
  ) {}

  public async process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void> {
    const text = input.text?.trim() || '';
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
      '- Về công nợ ("nợ a 100k", "cho Nam vay 200k"): gọi MANAGE_DEBT, xác định chính xác direction (receivable: người ta nợ mình, payable: mình nợ người ta), counterparty và amount.\n' +
      '- Về thu chi ("ăn trưa 45k", "tiền lương 15tr"): gọi RECORD_TRANSACTION, xác định type (income, expense), category và amount.\n' +
      '- Về nhắc nhở ("mai 9h họp", "15 phút nữa nhắc tắt bếp"): gọi SET_REMINDER, tính toán thời điểm ISO chính xác dựa trên giờ hiện tại.\n' +
      '- Về báo cáo chi tiêu ("hôm nay tiêu bao nhiêu", "báo cáo tài chính"): gọi GET_REPORT.\n' +
      '- Về lịch hẹn Google Calendar ("mai 14h họp dự án", "hẹn cà phê thứ 6 lúc 19h"): gọi CREATE_CALENDAR_EVENT, tính toán startDateTime và endDateTime theo chuẩn ISO 8601.\n' +
      '- Về tra cứu lịch hẹn ("lịch hôm nay", "ngày mai có lịch gì không", "xem lịch tuần này"): gọi LIST_CALENDAR_EVENTS.\n' +
      '- Về xóa lịch hẹn ("hủy lịch họp chiều nay"): gọi DELETE_CALENDAR_EVENT.\n' +
      '- Về việc cần làm ("thêm việc nộp báo cáo", "cần mua sữa chua"): gọi CREATE_TASK, xác định title, due, notes.\n' +
      '- Về tra cứu việc cần làm ("danh sách việc cần làm", "còn việc gì chưa xong"): gọi LIST_TASKS.\n' +
      '- Về hoàn thành việc ("đã xong việc nộp báo cáo"): gọi COMPLETE_TASK.\n' +
      '- Về kết nối Google ("kết nối google", "đăng nhập google"): gọi LOGIN_GOOGLE.\n' +
      '- Về tạo mã mời (Admin): gọi CREATE_INVITE_LINK.\n' +
      '- Nếu người dùng chỉ chào hỏi hoặc trò chuyện, hãy trả lời tự nhiên, ngắn gọn, thân thiện bằng tiếng Việt.';

    try {
      const response = await this.llmService.generate(
        text,
        ZALO_TOOL_DEFINITIONS,
        systemInstruction,
      );

      if (response.toolCall) {
        this.logger.log(
          `LLM resolved tool "${response.toolCall.name}" with args: ${JSON.stringify(response.toolCall.args)}`,
        );

        let strategy;
        try {
          strategy = this.toolFactory.getStrategy(response.toolCall.name as TextToolType);
        } catch {
          this.logger.warn(
            `Strategy for tool "${response.toolCall.name}" not found. Falling back to CONVERSATION.`,
          );
          strategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
        }

        await strategy.execute({
          input,
          chatId,
          senderId,
          displayName,
          text,
          toolArgs: response.toolCall.args,
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
}

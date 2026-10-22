import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { LlmService } from '../../../llm/llm.service';
import { ChatMemoryService } from '../../memory/chat-memory.service';
import { formatMemoryLine, type MemoryLine } from '../../memory/chat-memory.mapper';
import { normalizeDate } from '../../memory/chat-memory.query';
import { getVietnamDateTimeContext } from '../../../common/utils/datetime.util';

function readStringArg(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** `dd/mm/yyyy` for replies; the tool arguments use ISO dates. */
function toDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function describeRange(fromDate?: string, toDate?: string): string {
  if (fromDate && toDate) return ` từ ${toDisplayDate(fromDate)} đến ${toDisplayDate(toDate)}`;
  if (fromDate) return ` từ ${toDisplayDate(fromDate)}`;
  if (toDate) return ` đến ${toDisplayDate(toDate)}`;
  return '';
}

/**
 * Answers questions about past conversations of the current Zalo chat from the chat memory.
 * Read-only: no pending action. Only the matched snippets (never the whole history) reach the LLM.
 */
@Injectable()
export class SearchChatHistoryToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SEARCH_CHAT_HISTORY;
  private readonly logger = new Logger(SearchChatHistoryToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly llmService: LlmService,
    @Optional() private readonly chatMemoryService?: ChatMemoryService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const { chatId } = context;
    const memory = this.chatMemoryService;
    const settings = context.input.longTermMemory;
    if (!memory || !settings) {
      await this.zcaMessenger.sendMessage(
        chatId,
        '🧠 Kênh này chưa bật ghi nhớ hội thoại nên chưa tra lại được chuyện cũ. Admin bật trong "Cấu hình kênh" trên dashboard.',
      );
      return;
    }

    const keywords = readStringArg(context.toolArgs, 'keywords');
    const question = readStringArg(context.toolArgs, 'question') || context.text;
    const fromDate = normalizeDate(readStringArg(context.toolArgs, 'fromDate'));
    const toDate = normalizeDate(readStringArg(context.toolArgs, 'toDate'));
    const timeZone = this.configService?.get<string>('timezone') || 'Asia/Ho_Chi_Minh';

    let lines: MemoryLine[];
    try {
      lines = await this.zcaMessenger.withChatAction(chatId, () =>
        memory.search(chatId, {
          keywords: keywords || question,
          fromDate,
          toDate,
          limit: settings.searchLimit,
          timeZone,
          excludeMsgId: context.input.messageId,
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        `[SearchChatHistory] Search failed in ${chatId}: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      await this.zcaMessenger.sendMessage(
        chatId,
        '⚠️ Không tra được lịch sử chat lúc này, bạn thử lại sau nhé.',
      );
      return;
    }

    if (lines.length === 0) {
      await this.zcaMessenger.sendMessage(
        chatId,
        `🔎 Mình không tìm thấy trong lịch sử chat${describeRange(fromDate, toDate)} nội dung nào khớp với câu hỏi này.`,
      );
      return;
    }

    const transcript = lines.map((line) => formatMemoryLine(line, timeZone)).join('\n');
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);
    const systemInstruction =
      'Bạn là trợ lý trên Zalo, trả lời câu hỏi về những gì đã trao đổi trong cuộc trò chuyện này.\n\n' +
      `${dtContext.systemInstructionSnippet}\n\n` +
      'QUY TẮC:\n' +
      '- CHỈ dựa vào các đoạn tin nhắn được cung cấp; không bịa thêm.\n' +
      '- Nêu rõ ngày (dd/mm/yyyy) và người nói khi trả lời.\n' +
      '- Nếu đoạn tin nhắn không đủ để trả lời chắc chắn, nói rõ là không chắc hoặc không thấy.\n' +
      '- Trả lời ngắn gọn bằng tiếng Việt, dạng gạch đầu dòng nếu có nhiều ý.';
    const prompt =
      `Câu hỏi: ${question}\n\n` +
      `Các đoạn tin nhắn liên quan${describeRange(fromDate, toDate)} (định dạng [ngày giờ] người gửi: nội dung):\n` +
      transcript;

    const response = await this.zcaMessenger.withChatAction(chatId, () =>
      this.llmService.generate(prompt, undefined, systemInstruction),
    );
    const answer = response.text?.trim();
    await this.zcaMessenger.sendMessage(
      chatId,
      answer || '🔎 Mình tìm thấy vài tin nhắn liên quan nhưng chưa tổng hợp được câu trả lời.',
    );
  }
}

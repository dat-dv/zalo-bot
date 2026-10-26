import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHAT_MEMORY_LIMITS } from '@zalobot/contracts';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { LlmService } from '../../../llm/llm.service';
import { ChatMemoryService } from '../../memory/chat-memory.service';
import { formatMemoryLine, type MemoryLine } from '../../memory/chat-memory.mapper';
import { normalizeDate } from '../../memory/chat-memory.query';
import { getVietnamDateTimeContext } from '../../../common/utils/datetime.util';
import { ZALO_PLAIN_TEXT_INSTRUCTION } from '../zalo-plain-text.util';
import { CogneeClient, cogneeDatasetName } from '../../memory/long-term/cognee.client';

/** Graph context added to the prompt; the keyword lines carry the exact quotes. */
const COGNEE_CONTEXT_MAX_CHARS = 6000;

function readStringArg(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Messages to fetch: the agent's `limit` within the bounds, the default when it gave none. */
export function readSearchLimit(args: Record<string, unknown> | undefined): number {
  const value = args?.limit;
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return CHAT_MEMORY_LIMITS.SEARCH_LIMIT_DEFAULT;
  return Math.min(
    CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MAX,
    Math.max(CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN, Math.round(number)),
  );
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
 * Read-only: no pending action. Combines the keyword search (exact lines, also today's messages
 * not yet in Cognee) with Cognee's graph context of the chat's dataset when Cognee is on; without
 * Cognee, or when it fails, the keyword search alone answers as before.
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
    @Optional() private readonly cognee?: CogneeClient,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const { chatId } = context;
    const memory = this.chatMemoryService;
    if (!memory || !context.input.longTermMemory) {
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
    let graph: string[];
    try {
      [lines, graph] = await this.zcaMessenger.withTyping(chatId, () =>
        Promise.all([
          memory.search(chatId, {
            keywords: keywords || question,
            fromDate,
            toDate,
            limit: readSearchLimit(context.toolArgs),
            timeZone,
            excludeMsgId: context.input.messageId,
          }),
          this.recallGraph(chatId, question, Boolean(fromDate || toDate)),
        ]),
      );
    } catch (err: unknown) {
      this.logger.error(
        `[SearchChatHistory] Search failed in ${chatId}: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      await this.zcaMessenger.sendMessage(
        chatId,
        '⚠️ Không tra được lịch sử chat lúc này, thử lại sau.',
      );
      return;
    }

    if (lines.length === 0 && graph.length === 0) {
      await this.zcaMessenger.sendMessage(
        chatId,
        `🔎 Không thấy tin nào khớp trong lịch sử chat${describeRange(fromDate, toDate)}.`,
      );
      return;
    }

    const transcript = lines.map((line) => formatMemoryLine(line, timeZone)).join('\n');
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);
    const systemInstruction =
      'Bạn là trợ lý trên Zalo, trả lời câu hỏi về những gì đã trao đổi trong cuộc trò chuyện này.\n\n' +
      `${dtContext.systemInstructionSnippet}\n\n` +
      'QUY TẮC:\n' +
      '- CHỈ dựa vào các đoạn tin nhắn và ngữ cảnh trí nhớ được cung cấp; không bịa thêm.\n' +
      '- Ngữ cảnh trí nhớ được rút từ nhật ký từng ngày; khi nó và tin nhắn gốc khác nhau thì tin nhắn gốc đúng hơn.\n' +
      '- Nêu rõ ngày (dd/mm/yyyy) và người nói khi trả lời.\n' +
      '- Nếu đoạn tin nhắn không đủ để trả lời chắc chắn, nói rõ là không chắc hoặc không thấy.\n' +
      '- Trả lời ngắn gọn bằng tiếng Việt, dạng gạch đầu dòng nếu có nhiều ý.\n\n' +
      ZALO_PLAIN_TEXT_INSTRUCTION;
    const graphBlock =
      graph.length > 0
        ? `\n\nNgữ cảnh trí nhớ của cuộc trò chuyện (rút từ nhật ký các ngày trước):\n` +
          graph.join('\n---\n').slice(0, COGNEE_CONTEXT_MAX_CHARS)
        : '';
    const prompt =
      `Câu hỏi: ${question}\n\n` +
      `Các đoạn tin nhắn liên quan${describeRange(fromDate, toDate)} (định dạng [ngày giờ] người gửi: nội dung):\n` +
      (transcript || '(không có)') +
      graphBlock;

    const response = await this.zcaMessenger.withTyping(chatId, () =>
      this.llmService.generate(prompt, undefined, systemInstruction),
    );
    const answer = response.text?.trim();
    await this.zcaMessenger.sendMessage(
      chatId,
      answer || '🔎 Có vài tin liên quan nhưng chưa tổng hợp được câu trả lời.',
    );
  }

  /** Cognee's graph context for the question; `[]` when Cognee is off or fails. */
  private async recallGraph(
    chatId: string,
    question: string,
    temporal: boolean,
  ): Promise<string[]> {
    if (!this.cognee?.isEnabled()) return [];
    return this.cognee.recallContext(cogneeDatasetName(chatId), question, { temporal });
  }
}

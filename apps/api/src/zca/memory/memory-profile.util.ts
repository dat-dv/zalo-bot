import type { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import type { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { formatMemoryLine, type MemoryLine } from './chat-memory.mapper';

/**
 * Opening line of every chat prompt. The default persona yields to what the chat told the bot,
 * so "mày là con mèo đen" holds in every reply of the chat.
 */
export const BOT_IDENTITY_LINE =
  'Bạn là trợ lý cá nhân thông minh trên Zalo. Nếu phần ĐIỀU ĐƯỢC DẶN bên dưới mô tả bạn khác ' +
  'đi (tên gọi, tính cách, cách xưng hô) thì luôn theo phần đó.';

/** Memory answers must not replace the tools for numbers that can have changed since. */
export const CURRENT_DATA_RULE =
  '- Số liệu hiện tại (tiền, công nợ, lịch, việc cần làm, lời nhắc) luôn tra bằng công cụ; ' +
  'không lấy từ trí nhớ hay ngữ cảnh cũ vì có thể đã thay đổi.';

/**
 * Identity numbers and secrets seen in notes or recalled chat lines are not read out unprompted
 * (2026-11-17: "có dữ liệu camera gì k" got a member's ID card number). A direct question for that
 * piece goes to `SEARCH_CHAT_HISTORY`, which keeps answering it.
 */
export const PERSONAL_DATA_RULE =
  '- Không tự nêu số CCCD/CMND/hộ chiếu, số tài khoản, số thẻ, mật khẩu hay mã OTP thấy trong ' +
  'phần ghi nhớ hoặc đoạn chat gợi nhớ; chỉ nêu khi người dùng hỏi đích danh đúng thông tin đó.';

/**
 * Lines of this chat close in meaning to the message being answered, recalled automatically for
 * a free-chat reply (`ChatMemoryService.recallRecent`). Empty when nothing was recalled.
 */
export function buildAutoRecallBlock(lines: readonly MemoryLine[], timeZone: string): string {
  if (lines.length === 0) return '';
  return (
    'ĐOẠN CHAT GẦN ĐÂY CÓ THỂ LIÊN QUAN (trong cuộc chat này, 24 giờ qua; chỉ dùng nếu thật sự ' +
    'liên quan tới tin đang trả lời, không chép lại nguyên văn, không nói là "theo trí nhớ"):\n' +
    lines.map((line) => formatMemoryLine(line, timeZone)).join('\n') +
    `\n${CURRENT_DATA_RULE}\n${PERSONAL_DATA_RULE}`
  );
}

/**
 * The chat's notes (always) and the learned facts about the bot (`LearnedFactsService.forPrompt`
 * keeps member facts out). Notes carry short ids `[n1]` so `REMEMBER_NOTE` can replace one. Empty when the
 * chat has neither.
 */
export function buildMemoryProfileBlock(
  notes: readonly Pick<ZcaChannelNoteEntity, 'text'>[],
  facts: readonly Pick<ZcaLearnedFactEntity, 'subjectKind' | 'subjectName' | 'fact'>[],
): string {
  const parts: string[] = [];
  if (notes.length > 0) {
    parts.push(
      'ĐIỀU ĐƯỢC DẶN TRONG CUỘC CHAT NÀY (luôn làm theo, ưu tiên hơn mô tả mặc định ở trên):\n' +
        notes.map((note, index) => `[n${index + 1}] ${note.text}`).join('\n'),
    );
  }
  if (facts.length > 0) {
    parts.push(
      'ĐIỀU BOT TỰ RÚT RA TỪ CÁC CUỘC TRÒ CHUYỆN TRƯỚC (có thể sai; nếu mâu thuẫn với điều được ' +
        'dặn thì theo điều được dặn):\n' +
        facts
          .map((fact) =>
            fact.subjectKind === 'bot'
              ? `- Về bạn: ${fact.fact}`
              : `- ${fact.subjectName}: ${fact.fact}`,
          )
          .join('\n'),
    );
  }
  return parts.join('\n\n');
}

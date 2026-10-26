import type { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import type { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';

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
 * The chat's notes (always) and the learned facts about the bot and the people in the current
 * conversation. Notes carry short ids `[n1]` so `REMEMBER_NOTE` can replace one. Empty when the
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

import { LEARNED_FACTS_LIMITS } from '@zalobot/contracts';
import type { LearnedFactSubject } from '../learned-facts.service';

/** Graph context handed to the LLM per subject; enough for a few stable facts. */
export const FACT_CONTEXT_MAX_CHARS = 6000;

/** The question asked to Cognee about one subject. */
export function factRecallQuery(subject: LearnedFactSubject, botName: string): string {
  return subject.kind === 'bot'
    ? `Những điều mọi người đã nói về bot ${botName} (tên gọi, tính cách, là con gì, cách xưng hô)`
    : `Những điều đã biết về ${subject.name}: quan hệ với người khác, sở thích, thói quen, công việc, nơi ở`;
}

export const LEARNED_FACTS_SYSTEM_INSTRUCTION =
  'Bạn rút ra các thông tin ỔN ĐỊNH về một đối tượng từ ngữ cảnh trích từ nhật ký trò chuyện của ' +
  'một nhóm Zalo. Chỉ giữ điều đúng lâu dài (quan hệ, sở thích, thói quen, ăn uống, công việc, nơi ' +
  'ở; với bot: tên gọi, tính cách, là con gì, cách xưng hô mà mọi người dặn). BỎ QUA câu đùa, chửi, ' +
  'đe doạ, mệnh lệnh nhất thời ("cút lên mái nhà", "tí tao lên ăn"), số tiền, lịch hẹn, việc cần ' +
  'làm và mọi điều chỉ đúng trong một ngày. Không suy đoán ngoài ngữ cảnh. Mỗi ý một câu ngắn bằng ' +
  'tiếng Việt, không lặp chủ ngữ là tên đối tượng. Trả về DUY NHẤT JSON dạng ' +
  '{"facts": ["...", "..."]}; không có gì chắc chắn thì {"facts": []}.';

export function buildLearnedFactsPrompt(
  subject: LearnedFactSubject,
  botName: string,
  contexts: readonly string[],
  deletedFacts: readonly string[],
): string {
  const who = subject.kind === 'bot' ? `bot "${botName}" (chính bạn)` : `"${subject.name}"`;
  const context = contexts.join('\n---\n').slice(0, FACT_CONTEXT_MAX_CHARS);
  const deleted =
    deletedFacts.length > 0
      ? `\n\nKHÔNG đưa lại các ý đã bị người dùng xoá:\n${deletedFacts.map((f) => `- ${f}`).join('\n')}`
      : '';
  return (
    `Đối tượng: ${who}. Tối đa ${LEARNED_FACTS_LIMITS.MAX_PER_SUBJECT} ý.\n\n` +
    `NGỮ CẢNH:\n${context}${deleted}`
  );
}

/** The `facts` array of the LLM reply (JSON, possibly inside a code fence or extra text). */
export function parseLearnedFacts(reply: string | undefined): string[] {
  if (!reply) return [];
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(reply.slice(start, end + 1));
    if (typeof parsed !== 'object' || parsed === null || !('facts' in parsed)) return [];
    const facts = parsed.facts;
    if (!Array.isArray(facts)) return [];
    return facts.filter((fact): fact is string => typeof fact === 'string' && fact.trim() !== '');
  } catch {
    return [];
  }
}

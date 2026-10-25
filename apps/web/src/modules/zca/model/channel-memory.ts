import axios from 'axios';
import {
  CHANNEL_NOTES_LIMITS,
  type IApiErrorResponse,
  type IChannelLearnedFact,
  type IChannelMemoryStatus,
} from '@zalobot/contracts';

/** Learned facts of one subject (the bot first, then members by name). */
export interface LearnedFactGroup {
  key: string;
  title: string;
  facts: IChannelLearnedFact[];
}

export function groupLearnedFacts(facts: readonly IChannelLearnedFact[]): LearnedFactGroup[] {
  const groups = new Map<string, LearnedFactGroup>();
  for (const fact of facts) {
    const key =
      fact.subjectKind === 'bot' ? 'bot' : `member:${fact.subjectUserId ?? fact.subjectName}`;
    const title = fact.subjectKind === 'bot' ? `Về bot (${fact.subjectName})` : fact.subjectName;
    const group = groups.get(key) ?? { key, title, facts: [] };
    group.facts.push(fact);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === 'bot') return -1;
    if (b.key === 'bot') return 1;
    return a.title.localeCompare(b.title, 'vi');
  });
}

/** The API's Vietnamese message (notes limit, too long...) or a fallback. */
export function apiErrorText(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<IApiErrorResponse>(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ') || fallback;
  return message || fallback;
}

/** Client-side check before saving a note; the API checks the same limits. */
export function noteTextError(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Nhập điều cần bot nhớ.';
  if (clean.length > CHANNEL_NOTES_LIMITS.MAX_CHARS) {
    return `Tối đa ${CHANNEL_NOTES_LIMITS.MAX_CHARS} ký tự.`;
  }
  return null;
}

/** One line about the nightly job for the long-term memory card. */
export function memoryStatusText(status: IChannelMemoryStatus | undefined): string {
  if (!status) return '';
  if (!status.cogneeEnabled) {
    return 'Máy chủ chưa bật Cognee: bot chỉ tra lại chuyện cũ theo từ khoá, chưa tự học.';
  }
  const last = status.lastIngestedDay
    ? `Đã nạp tới ngày ${status.lastIngestedDay.split('-').reverse().join('/')}.`
    : 'Chưa nạp ngày nào (job chạy lúc 03:00 mỗi đêm).';
  const failed = status.failedDays > 0 ? ` ${status.failedDays} ngày lỗi, sẽ thử lại đêm sau.` : '';
  return `${last}${failed}`;
}

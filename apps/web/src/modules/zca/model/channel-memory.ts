import axios from 'axios';
import {
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

const COUNT_FORMAT = new Intl.NumberFormat('vi-VN');

/** One line about how far the chat's messages are searchable by meaning. */
export function memoryStatusText(status: IChannelMemoryStatus | undefined): string {
  if (!status) return '';
  if (status.embedder === 'failed') {
    return 'Chưa nạp được model trí nhớ trên máy chủ: bot tạm tra lại chuyện cũ theo từ khoá.';
  }
  const total = status.embeddedMessages + status.pendingMessages;
  if (total === 0) return 'Chưa có tin nào để nhớ.';
  const embedded = `Đã nhớ ${COUNT_FORMAT.format(status.embeddedMessages)} tin.`;
  const pending =
    status.pendingMessages > 0
      ? ` ${COUNT_FORMAT.format(status.pendingMessages)} tin đang chờ, xong trong khoảng 1 phút (hoặc gõ /sync).`
      : '';
  return `${embedded}${pending}`;
}

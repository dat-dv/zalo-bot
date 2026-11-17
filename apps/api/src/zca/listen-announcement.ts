import type { ThreadBotConfig } from '@zalobot/contracts';

/** What the announcement needs from a thread config. */
export type ListenAnnouncementConfig = Pick<
  ThreadBotConfig,
  'threadType' | 'directInteraction' | 'chatMemory'
>;

function quoted(prefixes: readonly string[]): string {
  return prefixes.map((prefix) => `"${prefix}"`).join(', ');
}

/** How to address the bot in this chat. */
function callLine(config: ListenAnnouncementConfig, botName: string): string {
  if (config.threadType !== 'group') {
    return '💬 Gọi bot: nhắn thẳng việc cần làm trong cuộc trò chuyện này.';
  }
  const prefixes = (config.directInteraction?.triggerPrefixes ?? []).filter(
    (prefix) => prefix.trim().length > 0,
  );
  const extra = prefixes.length > 0 ? ` hoặc bắt đầu tin bằng ${quoted(prefixes)}` : '';
  return `💬 Gọi bot: tag @${botName}${extra} rồi nói việc cần làm (người được admin cấp quyền).`;
}

function memoryLines(config: ListenAnnouncementConfig): string[] {
  const memory = config.chatMemory;
  if (!memory?.enabled) {
    return [
      '🧠 Trí nhớ: ĐANG TẮT. Bot không lưu tin nhắn của cuộc trò chuyện này. Admin bật "Nhớ lâu dài" trong Cấu hình kênh trên dashboard.',
    ];
  }
  const lines = [
    '🧠 Trí nhớ: ĐANG BẬT',
    '- Từ bây giờ bot lưu nguyên văn mọi tin của cuộc trò chuyện này (kể cả của người không dùng bot) để trả lời khi được hỏi chuyện cũ, ví dụ "@bot hôm trước hẹn ăn gì?".',
    '- Tin mới được nhớ theo ý nghĩa khoảng 20 giây sau khi ngớt tin; gõ /sync để nạp ngay.',
  ];
  if (memory.readImageText) lines.push('- Bot đọc cả chữ trong ảnh để nhớ cùng ảnh.');
  lines.push('- Chỉ nhớ trong cuộc trò chuyện này. Tin thu hồi trên Zalo thì bot quên.');
  return lines;
}

/**
 * Message the bot posts into a chat when it starts listening to it, so members know it listens,
 * what it remembers (from the chat's memory switches) and how to talk to it. Plain text for Zalo.
 */
export function buildListenAnnouncement(config: ListenAnnouncementConfig, botName: string): string {
  return [
    '👋 Bot đã bắt đầu lắng nghe cuộc trò chuyện này.',
    callLine(config, botName),
    '',
    ...memoryLines(config),
    '',
    '📌 Dặn bot điều cần luôn nhớ: "@bot nhớ là …"; bảo quên: "@bot quên vụ … đi".',
  ].join('\n');
}

import type { ThreadChatMemoryConfig } from '@zalobot/contracts';

/** One titled block of the "bot started listening" dialog. */
export interface ListenStartedSection {
  title: string;
  lines: string[];
}

/** `true` when a save turned listening on (it was off in the stored config). */
export function didStartListening(wasListened: boolean, isListened: boolean): boolean {
  return !wasListened && isListened;
}

/**
 * What the dialog shown after a save that turned listening on says, from the chat's memory
 * switches. Same facts as the message the bot posts in the chat (`buildListenAnnouncement` in the
 * API), written for the admin.
 */
export function listenStartedSections(memory: ThreadChatMemoryConfig): ListenStartedSection[] {
  const listening: ListenStartedSection = {
    title: '👂 Lắng nghe',
    lines: [
      'Tài khoản Zalo của bot nhận và xử lý tin trong cuộc trò chuyện này, theo quyền gọi bot đã cấu hình.',
      'Bot nhắn một tin vào cuộc trò chuyện để mọi người biết bot đang nghe và trí nhớ đang thế nào (cần tài khoản Zalo đang đăng nhập). Bật lại trong 10 phút thì không nhắn lần nữa.',
    ],
  };
  const remember: ListenStartedSection = memory.enabled
    ? {
        title: '🧠 Nhớ lâu dài: đang bật',
        lines: [
          'Bot lưu nguyên văn mọi tin của cuộc trò chuyện từ bây giờ, kể cả của người không dùng bot.',
          'Khoảng 20 giây sau khi ngớt tin, tin mới được nhớ theo ý nghĩa bằng model chạy trên máy chủ (không gọi AI bên ngoài); gõ /sync để nạp ngay.',
          'Hỏi lại chuyện cũ bằng cách gọi bot, ví dụ "@bot hôm trước hẹn ăn gì?". Chỉ các đoạn tìm được mới được gửi cho AI để viết câu trả lời.',
          'Chỉ nhớ trong cuộc trò chuyện này. Tin thu hồi trên Zalo thì bot quên.',
        ],
      }
    : {
        title: '🧠 Nhớ lâu dài: đang tắt',
        lines: [
          'Bot không lưu tin nhắn của cuộc trò chuyện này nên không trả lời được câu hỏi về chuyện cũ.',
          'Muốn bot nhớ, bật "Nhớ lâu dài" trong mục 🧠 Trí nhớ rồi bấm Lưu.',
        ],
      };
  const photos: ListenStartedSection = {
    title:
      memory.enabled && memory.readImageText
        ? '🖼️ Đọc chữ trong ảnh: đang bật'
        : '🖼️ Đọc chữ trong ảnh: không dùng',
    lines: [
      memory.enabled && memory.readImageText
        ? 'Chữ trong ảnh được đọc ngay trên máy chủ và nhớ cùng tin ảnh.'
        : 'Ảnh chỉ được nhớ là ảnh (chỉ có tác dụng khi bật Nhớ lâu dài).',
    ],
  };
  const notes: ListenStartedSection = {
    title: '📌 Ghi nhớ',
    lines: [
      'Không cần bật gì: dặn trong chat "@bot nhớ là …" để bot luôn nhớ, "@bot quên vụ … đi" để xoá.',
    ],
  };
  return [listening, remember, photos, notes];
}

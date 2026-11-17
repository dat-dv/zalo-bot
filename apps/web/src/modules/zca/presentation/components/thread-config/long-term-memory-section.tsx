'use client';

import type { ThreadBotConfig } from '@zalobot/contracts';
import { useThreadMemoryStatusQuery } from '../../../api/zca-query';
import { memoryStatusText } from '../../../model/channel-memory';
import { ConfigSectionCard } from './config-section-card';
import { LearnedFactsPanel } from './learned-facts-panel';

interface LongTermMemorySectionProps {
  threadId: string;
  form: ThreadBotConfig;
  onChange: (form: ThreadBotConfig) => void;
}

/** What the long-term memory keeps and shows the AI, so admins know before turning it on. */
const HOW_IT_WORKS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Lưu gì',
    text: 'mọi tin của kênh từ lúc bật. Ảnh lưu nhãn, chú thích và chữ trong ảnh (khi bật Đọc chữ trong ảnh); file chỉ lưu tên. Thẻ xác nhận và thông báo của bot không được nhớ; thao tác chỉ được nhớ khi đã duyệt và chạy xong.',
  },
  {
    title: 'Khi nào nạp',
    text: 'khoảng 20 giây sau khi kênh ngớt tin (chậm nhất 2 phút), các tin mới được xử lý để tìm được theo ý nghĩa, bằng model chạy ngay trên máy chủ (không gọi AI bên ngoài); gõ /sync để nạp ngay. Tin vừa nhắn tìm được theo từ khoá ngay lập tức.',
  },
  {
    title: 'Hỏi thế nào',
    text: 'gọi bot rồi hỏi chuyện cũ, ví dụ "@bot tháng 5 nhóm hẹn ở đâu?". Bot tìm theo ý nghĩa cùng theo từ khoá, rồi AI đang dùng viết câu trả lời kèm ngày và người nói.',
  },
  {
    title: 'Phạm vi',
    text: 'chỉ trong kênh này, kênh khác không đọc được. Tin bị thu hồi trên Zalo bị xoá khỏi trí nhớ ngay.',
  },
  {
    title: 'Hạn chế',
    text: 'chỉ nhớ từ lúc bật; câu hỏi cần nối nhiều chuyện xa nhau (ai hay đi với ai, rồi người đó làm gì) có thể trả lời thiếu.',
  },
];

/**
 * Every message stored for questions about the past and embedded on the server (no LLM), how far
 * that went, and the facts learned earlier. How many past messages a question looks at is the
 * agent's choice, not a setting.
 */
export function LongTermMemorySection({ threadId, form, onChange }: LongTermMemorySectionProps) {
  const memory = form.chatMemory;
  const status = useThreadMemoryStatusQuery(threadId, memory.enabled);
  return (
    <ConfigSectionCard
      description='Nhớ chuyện cũ để hỏi lại, ví dụ "@bot hôm trước Nam nói gửi file gì?"'
      enabled={memory.enabled}
      icon="🧠"
      onEnabledChange={(enabled) => onChange({ ...form, chatMemory: { ...memory, enabled } })}
      title="Nhớ lâu dài"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Bot lưu nguyên văn mọi tin nhắn của kênh (kể cả mật khẩu, số tài khoản), kể cả của người
        không dùng bot. Tin nằm trên máy chủ; khi có người hỏi chuyện cũ, các đoạn liên quan được gửi
        tới AI đang dùng để viết câu trả lời. Tắt thì ngừng lưu và ngừng tra cứu; dữ liệu đã lưu vẫn
        được giữ.
      </p>
      {memory.enabled && status.data && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {memoryStatusText(status.data)}
        </p>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cách hoạt động</p>
        <ul className="mt-1.5 grid list-disc gap-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
          {HOW_IT_WORKS.map((point) => (
            <li key={point.title}>
              <span className="font-medium text-slate-700 dark:text-slate-200">{point.title}:</span>{' '}
              {point.text}
            </li>
          ))}
        </ul>
      </div>
      <LearnedFactsPanel threadId={threadId} />
    </ConfigSectionCard>
  );
}

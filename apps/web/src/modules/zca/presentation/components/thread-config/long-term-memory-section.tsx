'use client';

import type { ThreadBotConfig } from '@zalobot/contracts';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';
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
    text: 'kênh im lặng khoảng 3 phút (nói liên tục thì chậm nhất 15 phút) là các tin mới được gửi sang Cognee; gõ /sync để nạp ngay. Lúc 03:00 mỗi đêm bot nạp lại cả ngày hôm trước thành một bản cho gọn, rồi tự học vài điều về bot và những người hay nói (nếu bật bên dưới). Tin được gửi đúng như đã nhắn, không che gì.',
  },
  {
    title: 'Hỏi thế nào',
    text: 'gọi bot rồi hỏi chuyện cũ, ví dụ "@bot tháng 5 nhóm hẹn ở đâu?". Bot dùng trí nhớ Cognee cùng tìm theo từ khoá, trả lời kèm ngày và người nói.',
  },
  {
    title: 'Phạm vi',
    text: 'chỉ trong kênh này, kênh khác không đọc được. Tin bị thu hồi trên Zalo bị xoá khỏi trí nhớ: tin hôm nay thì nạp lại ngay, ngày cũ thì nạp lại vào đêm sau.',
  },
  {
    title: 'Hạn chế',
    text: 'chỉ nhớ từ lúc bật; tin vừa nhắn chỉ tìm được theo từ khoá cho tới lần nạp kế tiếp. Điều tự học có thể sai, xoá được bên dưới.',
  },
];

/**
 * Every message stored for questions about the past, the Cognee memory (fed minutes after a chat
 * goes quiet, rebuilt nightly) and what the bot
 * learned. How many past messages a question looks at is the agent's choice, not a setting.
 */
export function LongTermMemorySection({ threadId, form, onChange }: LongTermMemorySectionProps) {
  const memory = form.chatMemory;
  return (
    <ConfigSectionCard
      description='Nhớ chuyện cũ để hỏi lại, ví dụ "@bot hôm trước Nam nói gửi file gì?", và tự học về mọi người'
      enabled={memory.enabled}
      icon="🧠"
      onEnabledChange={(enabled) => onChange({ ...form, chatMemory: { ...memory, enabled } })}
      title="Nhớ lâu dài"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot, và vài phút sau gửi nguyên
        văn (kể cả mật khẩu, số tài khoản) tới AI dựng trí nhớ (Cognee, qua dịch vụ AI đang cấu hình
        trên máy chủ). Tắt thì ngừng lưu, ngừng nạp và ngừng tra cứu; dữ liệu đã lưu vẫn được giữ.
      </p>
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
      <ConfigToggleRow
        checked={memory.learnPeople}
        description="Mỗi đêm rút ra vài điều ổn định về bot và những người hay nói (dùng ngay, xoá được)."
        onChange={(learnPeople) => onChange({ ...form, chatMemory: { ...memory, learnPeople } })}
        title="Tự học về mọi người"
      />
      <LearnedFactsPanel threadId={threadId} />
    </ConfigSectionCard>
  );
}

'use client';

import { CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import type { ChatMemoryDraft } from '../../../model/thread-config-form';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';

interface LongTermMemorySectionProps {
  form: ThreadBotConfig;
  draft: ChatMemoryDraft;
  onChange: (form: ThreadBotConfig) => void;
  onDraftChange: (draft: ChatMemoryDraft) => void;
  /** Normalizes the typed numbers once the user leaves a field. */
  onDraftCommit: () => void;
}

/** What the long-term memory keeps and shows the AI, so admins know before turning it on. */
const HOW_IT_WORKS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Lưu gì',
    text: 'mọi tin của kênh từ lúc bật, cả tin bot trả lời. Ảnh và file chỉ lưu nhãn và tên, không lưu link. Không tự xoá theo thời gian.',
  },
  {
    title: 'Hỏi thế nào',
    text: 'gọi bot rồi hỏi chuyện cũ, ví dụ "@bot tháng 5 nhóm hẹn ở đâu?". Bot tìm theo từ khoá (không phân biệt dấu) và mốc thời gian trong câu hỏi.',
  },
  {
    title: 'AI thấy gì',
    text: 'chỉ các đoạn tìm được, không bao giờ cả lịch sử. Câu trả lời ghi rõ ngày và người nói.',
  },
  {
    title: 'Phạm vi',
    text: 'chỉ tra trong kênh này, kênh khác không đọc được. Tin bị thu hồi trên Zalo bị xoá khỏi trí nhớ.',
  },
  {
    title: 'Hạn chế',
    text: 'chỉ nhớ từ lúc bật. Câu hỏi tổng hợp kiểu "cả năm đi những đâu" có thể trả lời thiếu, vì bot tìm theo từ khoá.',
  },
];

/** Every message stored for questions about the past; independent of the short-term memory. */
export function LongTermMemorySection({
  form,
  draft,
  onChange,
  onDraftChange,
  onDraftCommit,
}: LongTermMemorySectionProps) {
  const memory = form.chatMemory;
  return (
    <ConfigSectionCard
      description='Lưu tin nhắn của kênh để hỏi lại chuyện cũ, ví dụ "@bot hôm trước Nam nói gửi file gì?"'
      enabled={memory.enabled}
      icon="🧠"
      onEnabledChange={(enabled) => onChange({ ...form, chatMemory: { ...memory, enabled } })}
      title="Trí nhớ dài hạn"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot. Tắt thì ngừng lưu và ngừng
        tra cứu, tin đã lưu vẫn được giữ.
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
      <ConfigField
        className="sm:max-w-[50%]"
        hint="Tăng lên nếu bot hay trả lời thiếu. Mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng gửi cho AI"
        label="Số kết quả mỗi lần tra"
        max={CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MAX}
        min={CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN}
        onBlur={onDraftCommit}
        onChange={(e) => onDraftChange({ ...draft, searchLimit: e.target.value })}
        type="number"
        value={draft.searchLimit}
      />
    </ConfigSectionCard>
  );
}

'use client';

import { CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import type { ChatMemoryDraft } from '../../../model/thread-config-form';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';
import { LearnedFactsPanel } from './learned-facts-panel';

interface LongTermMemorySectionProps {
  threadId: string;
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
    text: 'mọi tin của kênh từ lúc bật. Ảnh lưu nhãn, chú thích và chữ trong ảnh (khi bật Đọc chữ trong ảnh); file chỉ lưu tên. Thẻ xác nhận và thông báo của bot không được nhớ; thao tác chỉ được nhớ khi đã duyệt và chạy xong.',
  },
  {
    title: 'Mỗi đêm',
    text: 'lúc 03:00 bot gửi chat từng ngày của kênh (lời người nói và thao tác đã duyệt) sang Cognee để dựng trí nhớ theo kênh, rồi tự học vài điều về bot và những người hay nói (nếu bật bên dưới).',
  },
  {
    title: 'Hỏi thế nào',
    text: 'gọi bot rồi hỏi chuyện cũ, ví dụ "@bot tháng 5 nhóm hẹn ở đâu?". Bot dùng trí nhớ Cognee cùng tìm theo từ khoá, trả lời kèm ngày và người nói.',
  },
  {
    title: 'Phạm vi',
    text: 'chỉ trong kênh này, kênh khác không đọc được. Tin bị thu hồi trên Zalo bị xoá khỏi trí nhớ, ngày đó được nạp lại vào đêm sau.',
  },
  {
    title: 'Hạn chế',
    text: 'chỉ nhớ từ lúc bật; tin hôm nay chỉ tìm được theo từ khoá cho tới đêm nay. Điều tự học có thể sai, xoá được bên dưới.',
  },
];

/**
 * Every message stored for questions about the past, the nightly Cognee memory and what the bot
 * learned; independent of the short-term memory.
 */
export function LongTermMemorySection({
  threadId,
  form,
  draft,
  onChange,
  onDraftChange,
  onDraftCommit,
}: LongTermMemorySectionProps) {
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
        Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot. Mỗi đêm toàn bộ chat trong
        ngày được gửi tới AI dựng trí nhớ (Cognee, qua dịch vụ AI đang cấu hình trên máy chủ). Tắt
        thì ngừng lưu, ngừng nạp và ngừng tra cứu; dữ liệu đã lưu vẫn được giữ.
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
      <details className="text-xs text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          Nâng cao
        </summary>
        <div className="mt-3">
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
        </div>
      </details>
    </ConfigSectionCard>
  );
}

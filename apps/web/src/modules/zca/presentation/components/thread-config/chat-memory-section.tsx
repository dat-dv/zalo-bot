'use client';

import { CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import type { ChatMemoryDraft } from '../../../model/thread-config-form';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';

interface ChatMemorySectionProps {
  form: ThreadBotConfig;
  draft: ChatMemoryDraft;
  onChange: (form: ThreadBotConfig) => void;
  onDraftChange: (draft: ChatMemoryDraft) => void;
  /** Normalizes the typed numbers once the user leaves a field. */
  onDraftCommit: () => void;
}

export function ChatMemorySection({
  form,
  draft,
  onChange,
  onDraftChange,
  onDraftCommit,
}: ChatMemorySectionProps) {
  return (
    <ConfigSectionCard
      description='Lưu tin nhắn của kênh để hỏi lại chuyện cũ, ví dụ "@bot hôm trước Nam nói gửi file gì?"'
      enabled={form.chatMemory.enabled}
      icon="🧠"
      onEnabledChange={(enabled) =>
        onChange({ ...form, chatMemory: { ...form.chatMemory, enabled } })
      }
      title="Trí nhớ hội thoại"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot. Tắt thì ngừng lưu và ngừng
        tra cứu, tin đã lưu vẫn được giữ.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ConfigField
          hint="Đưa vào prompt để bot hiểu câu nối tiếp; 0 = tắt"
          label="Số tin ngữ cảnh gần đây"
          max={CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX}
          min={0}
          onBlur={onDraftCommit}
          onChange={(e) => onDraftChange({ ...draft, contextWindow: e.target.value })}
          type="number"
          value={draft.contextWindow}
        />
        <ConfigField
          hint="Mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng gửi cho AI"
          label="Số kết quả mỗi lần tra"
          max={CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MAX}
          min={CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN}
          onBlur={onDraftCommit}
          onChange={(e) => onDraftChange({ ...draft, searchLimit: e.target.value })}
          type="number"
          value={draft.searchLimit}
        />
      </div>
    </ConfigSectionCard>
  );
}

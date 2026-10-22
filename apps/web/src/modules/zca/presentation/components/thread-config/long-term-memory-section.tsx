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
      <ConfigField
        className="sm:max-w-[50%]"
        hint="Mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng gửi cho AI"
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

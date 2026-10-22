'use client';

import { CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import type { ChatMemoryDraft } from '../../../model/thread-config-form';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';

interface ShortTermMemorySectionProps {
  form: ThreadBotConfig;
  draft: ChatMemoryDraft;
  onChange: (form: ThreadBotConfig) => void;
  onDraftChange: (draft: ChatMemoryDraft) => void;
  /** Normalizes the typed numbers once the user leaves a field. */
  onDraftCommit: () => void;
}

/** Latest messages added to every bot turn; independent of the long-term memory. */
export function ShortTermMemorySection({
  form,
  draft,
  onChange,
  onDraftChange,
  onDraftCommit,
}: ShortTermMemorySectionProps) {
  const memory = form.chatMemory;
  return (
    <ConfigSectionCard
      description='Nhớ vài tin gần nhất để bot hiểu "còn cái kia?", "ghi giúp cái đó"'
      enabled={memory.shortTermEnabled}
      icon="💬"
      onEnabledChange={(shortTermEnabled) =>
        onChange({ ...form, chatMemory: { ...memory, shortTermEnabled } })
      }
      title="Trí nhớ ngắn hạn"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Các tin gần nhất của mọi người trong kênh được gửi cho AI ở mỗi lượt bot trả lời. Bot tự
        quên sau 24 giờ không có tin mới.
      </p>
      <ConfigField
        className="sm:max-w-[50%]"
        hint="Số tin gần nhất đưa vào prompt ở mỗi lượt"
        label="Số tin gần đây"
        max={CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX}
        min={CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MIN}
        onBlur={onDraftCommit}
        onChange={(e) => onDraftChange({ ...draft, contextWindow: e.target.value })}
        type="number"
        value={draft.contextWindow}
      />
    </ConfigSectionCard>
  );
}

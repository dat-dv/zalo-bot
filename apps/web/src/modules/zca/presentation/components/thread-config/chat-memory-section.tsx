'use client';

import { useState } from 'react';
import { CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import { contextWindowAfterToggle, type ChatMemoryDraft } from '../../../model/thread-config-form';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';

interface ChatMemorySectionProps {
  form: ThreadBotConfig;
  draft: ChatMemoryDraft;
  onChange: (form: ThreadBotConfig) => void;
  onDraftChange: (draft: ChatMemoryDraft) => void;
  /** Normalizes the typed numbers once the user leaves a field. */
  onDraftCommit: () => void;
}

/**
 * The main switch stores the thread's messages; the follow-up window and the history search are
 * two separate uses of them, so each gets its own block.
 */
export function ChatMemorySection({
  form,
  draft,
  onChange,
  onDraftChange,
  onDraftCommit,
}: ChatMemorySectionProps) {
  const memory = form.chatMemory;
  // Size to restore when the follow-up window is turned back on.
  const [lastContextWindow, setLastContextWindow] = useState(memory.contextWindow);
  const contextWindowOn = memory.contextWindow > 0;

  const toggleContextWindow = (enabled: boolean) => {
    if (!enabled) setLastContextWindow(memory.contextWindow);
    const contextWindow = contextWindowAfterToggle(enabled, lastContextWindow);
    onChange({ ...form, chatMemory: { ...memory, contextWindow } });
    onDraftChange({ ...draft, contextWindow: String(contextWindow) });
  };

  return (
    <ConfigSectionCard
      description="Lưu tin nhắn của kênh để bot hiểu câu nối tiếp và tra lại chuyện cũ"
      enabled={memory.enabled}
      icon="🧠"
      onEnabledChange={(enabled) => onChange({ ...form, chatMemory: { ...memory, enabled } })}
      title="Trí nhớ hội thoại"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot. Tắt thì ngừng lưu và ngừng
        tra cứu, tin đã lưu vẫn được giữ.
      </p>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <ConfigToggleRow
          checked={contextWindowOn}
          description='Gắn vài tin gần nhất vào mỗi lượt để bot hiểu "còn cái kia?", "ghi giúp cái đó"'
          onChange={toggleContextWindow}
          title="Hiểu câu nối tiếp"
        />
        {contextWindowOn && (
          <ConfigField
            className="sm:max-w-[50%]"
            hint="Số tin gần nhất đưa vào prompt ở mỗi lượt"
            label="Số tin gần đây"
            max={CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX}
            min={1}
            onBlur={onDraftCommit}
            onChange={(e) => onDraftChange({ ...draft, contextWindow: e.target.value })}
            type="number"
            value={draft.contextWindow}
          />
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Tra lại chuyện cũ
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Khi hỏi &quot;@bot hôm trước Nam nói gửi file gì?&quot;, bot tìm trong tin đã lưu
          </p>
        </div>
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
      </div>
    </ConfigSectionCard>
  );
}

'use client';

import type { ThreadBotConfig, ThreadDirectInteractionConfig } from '@zalobot/contracts';
import type { ThreadKind } from '../../../model/thread-config-form';
import { TriggerPrefixInput } from '../trigger-prefix-input';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';

interface DirectInteractionSectionProps {
  form: ThreadBotConfig;
  threadType: ThreadKind;
  onChange: (form: ThreadBotConfig) => void;
}

export function DirectInteractionSection({
  form,
  threadType,
  onChange,
}: DirectInteractionSectionProps) {
  const direct = form.directInteraction;
  const setDirect = (patch: Partial<ThreadDirectInteractionConfig>) =>
    onChange({ ...form, directInteraction: { ...direct, ...patch } });

  return (
    <ConfigSectionCard
      description="Cho phép trò chuyện, hỏi đáp AI, thực hiện lệnh tra cứu và xử lý yêu cầu trực tiếp"
      enabled={direct.enabled}
      icon="🤖"
      onEnabledChange={(enabled) => setDirect({ enabled })}
      title="Tương tác Bot trực tiếp (AI Trợ lý & Lệnh bot)"
    >
      <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        {threadType === 'group'
          ? 'Trong nhóm, bot chỉ phản hồi khi được @mention hoặc tin nhắn bắt đầu bằng một tiền tố bên dưới. Ảnh không kèm chữ chỉ được lưu; muốn bot đọc ảnh hãy reply ảnh và @Bot.'
          : 'Chat riêng với bot: mọi tin nhắn chữ đều được xử lý, không cần @mention. Ảnh không kèm chữ chỉ được lưu.'}
      </p>
      <ConfigToggleRow
        checked={direct.allowAiChat ?? false}
        description="Khi được gọi (@Bot, tiền tố hoặc chat riêng), AI trả lời tự nhiên cả các câu hỏi tổng quát ngoài tác vụ tài chính/lịch"
        onChange={(allowAiChat) => setDirect({ allowAiChat })}
        title="Cho phép AI trò chuyện tự do (Chit-chat)"
      />
      <ConfigToggleRow
        checked={direct.allowSelf ?? false}
        description="Cho phép bot phản hồi tin nhắn gửi từ chính tài khoản Zalo của bot (hữu ích khi bạn tự nhắn tin để test bot)"
        onChange={(allowSelf) => setDirect({ allowSelf })}
        title="Phản hồi tin nhắn tự gửi (Self-listen / isSelf)"
      />
      <TriggerPrefixInput
        onChange={(triggerPrefixes) => setDirect({ triggerPrefixes })}
        value={direct.triggerPrefixes}
      />
    </ConfigSectionCard>
  );
}

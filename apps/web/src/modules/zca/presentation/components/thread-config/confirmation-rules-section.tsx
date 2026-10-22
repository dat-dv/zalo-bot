'use client';

import type { ThreadBotConfig, ThreadConfirmationConfig } from '@zalobot/contracts';
import { ConfigField } from './config-field';
import { ConfigSectionCard } from './config-section-card';

interface ConfirmationRulesSectionProps {
  form: ThreadBotConfig;
  onChange: (form: ThreadBotConfig) => void;
}

export function ConfirmationRulesSection({ form, onChange }: ConfirmationRulesSectionProps) {
  const rules = form.confirmationRules;
  const setRules = (patch: Partial<ThreadConfirmationConfig>) =>
    onChange({ ...form, confirmationRules: { ...rules, ...patch } });

  return (
    <ConfigSectionCard
      description="Thả tim (❤️) để duyệt, thả phẫn nộ (😡) hoặc soạn `cancel` để hủy bỏ"
      enabled={rules.allowReactions}
      icon="❤️"
      onEnabledChange={(allowReactions) => setRules({ allowReactions })}
      title="Quy tắc xác nhận qua Reaction & Thao tác"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ConfigField
          hint="Gợi ý: 1 tim cho chat cá nhân, 3 - 5 tim cho nhóm biểu quyết"
          label="Số tim tối thiểu để duyệt"
          max={50}
          min={1}
          onChange={(e) => setRules({ requiredHearts: Math.max(1, parseInt(e.target.value) || 1) })}
          type="number"
          value={rules.requiredHearts}
        />
        <ConfigField
          hint="Hết thời gian yêu cầu sẽ tự động bị hủy"
          label="Thời gian chờ xác nhận (phút)"
          max={60}
          min={1}
          onChange={(e) => setRules({ timeoutMinutes: Math.max(1, parseInt(e.target.value) || 5) })}
          type="number"
          value={rules.timeoutMinutes}
        />
      </div>
    </ConfigSectionCard>
  );
}

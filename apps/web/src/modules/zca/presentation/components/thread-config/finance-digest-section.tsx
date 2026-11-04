'use client';

import type { ThreadBotConfig } from '@zalobot/contracts';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';

interface FinanceDigestSectionProps {
  form: ThreadBotConfig;
  onChange: (form: ThreadBotConfig) => void;
}

/** Scheduled finance summary posted into the chat. */
export function FinanceDigestSection({ form, onChange }: FinanceDigestSectionProps) {
  const digest = form.financeDigest;
  const enabled = digest.weekly || digest.monthly;

  return (
    <ConfigSectionCard
      description="Bot tự gửi tổng thu chi, danh mục chi nhiều nhất và công nợ vào kênh này"
      enabled={enabled}
      icon="📅"
      onEnabledChange={(on) => onChange({ ...form, financeDigest: { weekly: on, monthly: on } })}
      title="Tóm tắt tài chính"
    >
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Số liệu lấy từ toàn bộ sổ chung, gồm cả khoản ghi ở chat riêng và nhóm khác. Mọi thành viên
        của kênh này đều đọc được.
      </p>
      <ConfigToggleRow
        checked={digest.weekly}
        description="8:00 thứ 2, cho tuần trước"
        title="Hằng tuần"
        onChange={(weekly) => onChange({ ...form, financeDigest: { ...digest, weekly } })}
      />
      <ConfigToggleRow
        checked={digest.monthly}
        description="8:00 ngày 1, cho tháng trước"
        title="Hằng tháng"
        onChange={(monthly) => onChange({ ...form, financeDigest: { ...digest, monthly } })}
      />
    </ConfigSectionCard>
  );
}

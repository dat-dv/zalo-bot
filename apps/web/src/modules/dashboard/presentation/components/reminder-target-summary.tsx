'use client';

import type { IReminderTargetUser, ReminderTargetMode } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

interface ReminderTargetSummaryProps {
  chatName?: string;
  users?: readonly IReminderTargetUser[];
  mode?: ReminderTargetMode;
}

/** "Nhà mình · 👤 Trí, Đạt · Nhắn riêng": where a reminder goes, under its time in the tables. */
export function ReminderTargetSummary({ chatName, users, mode }: ReminderTargetSummaryProps) {
  const { t } = useLocale();
  const names = (users ?? []).map((user) => user.name).join(', ');
  const parts = [
    chatName,
    names && `👤 ${names}`,
    names && mode === 'direct' ? t('reminderTarget.mode.direct') : '',
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span
      className="max-w-[220px] truncate text-[11px] text-slate-500 dark:text-slate-400"
      title={parts.join(' · ')}
    >
      {parts.join(' · ')}
    </span>
  );
}

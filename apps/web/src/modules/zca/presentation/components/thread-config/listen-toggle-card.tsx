'use client';

import { ConfigSwitch } from './config-switch';

const TITLE = 'Kích hoạt Bot lắng nghe (Master Toggle)';

interface ListenToggleCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ListenToggleCard({ checked, onChange }: ListenToggleCardProps) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{TITLE}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Khi bật, tài khoản Zalo cá nhân sẽ đóng vai trò Bot tiếp nhận và xử lý tin nhắn trong hội
          thoại này.
        </p>
      </div>
      <ConfigSwitch checked={checked} label={TITLE} onChange={onChange} size="lg" tone="emerald" />
    </section>
  );
}

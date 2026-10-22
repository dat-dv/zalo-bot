'use client';

import { ConfigSwitch } from './config-switch';

interface ConfigToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'md' | 'sm';
  className?: string;
}

/** Secondary on/off option inside a section: text wraps, the switch keeps its size. */
export function ConfigToggleRow({
  title,
  description,
  checked,
  onChange,
  size = 'sm',
  className = '',
}: ConfigToggleRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ConfigSwitch checked={checked} label={title} onChange={onChange} size={size} />
    </div>
  );
}

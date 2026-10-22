'use client';

import type { ReactNode } from 'react';
import { ConfigSwitch } from './config-switch';

interface ConfigSectionCardProps {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Shown only while the section is enabled. */
  children?: ReactNode;
}

export function ConfigSectionCard({
  icon,
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: ConfigSectionCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="text-lg">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <ConfigSwitch checked={enabled} label={title} onChange={onEnabledChange} />
      </div>
      {enabled && children && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </section>
  );
}

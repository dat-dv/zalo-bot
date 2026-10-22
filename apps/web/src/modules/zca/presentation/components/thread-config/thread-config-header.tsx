'use client';

import Link from 'next/link';
import type { ThreadKind } from '../../../model/thread-config-form';

interface ThreadConfigHeaderProps {
  threadId: string;
  threadName: string;
  threadType: ThreadKind;
  backHref: string;
}

export function ThreadConfigHeader({
  threadId,
  threadName,
  threadType,
  backHref,
}: ThreadConfigHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <Link
        className="w-fit text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        href={backHref}
      >
        ← Zalo & Người dùng
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {threadName ? threadName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1
              className="truncate text-lg font-bold text-slate-900 dark:text-slate-100"
              title={threadName || undefined}
            >
              {threadName || 'Cuộc trò chuyện'}
            </h1>
            <span
              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                threadType === 'group'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
              }`}
            >
              {threadType === 'group' ? 'Nhóm' : 'Cá nhân'}
            </span>
          </div>
          <p className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">
            ID: {threadId}
          </p>
        </div>
      </div>
    </header>
  );
}

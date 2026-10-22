'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { APP_ROUTES } from '@zalobot/contracts';
import { useZcaThreadConfigQuery, useZcaThreadsQuery } from '../api/zca-query';
import { ThreadConfigForm } from '../presentation/components/thread-config/thread-config-form';
import { ThreadConfigHeader } from '../presentation/components/thread-config/thread-config-header';
import { readChatTableReturnHref } from './use-chat-table-url-state';

const PANEL =
  'flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';

/** Bot configuration of one Zalo chat, opened from "Cấu hình" in the /zca table. */
export function ThreadConfigScreen() {
  const threadId = useSearchParams().get('id')?.trim() || null;
  const [backHref, setBackHref] = useState<string>(APP_ROUTES.zca);
  useEffect(() => setBackHref(readChatTableReturnHref()), []);

  const threadsQuery = useZcaThreadsQuery({ enabled: Boolean(threadId) });
  const configQuery = useZcaThreadConfigQuery(threadId);
  const thread = threadsQuery.data?.find((item) => item.id === threadId);
  // The directory may not list a chat (e.g. after leaving a group); the saved config still names it.
  const threadName = thread?.name ?? configQuery.data?.threadName ?? '';
  const threadType = thread?.type ?? configQuery.data?.threadType;

  const backLink = (
    <Link
      className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      href={backHref}
    >
      ← Quay lại Zalo & Người dùng
    </Link>
  );

  if (!threadId) {
    return <div className={PANEL}>Thiếu mã cuộc trò chuyện trong đường dẫn.{backLink}</div>;
  }
  if (configQuery.isLoading || threadsQuery.isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }
  if (configQuery.isError) {
    return (
      <div className={PANEL}>
        Không tải được cấu hình của cuộc trò chuyện này.
        <button
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => void configQuery.refetch()}
          type="button"
        >
          Thử lại
        </button>
        {backLink}
      </div>
    );
  }
  // Saving requires the chat kind, so an unknown chat is read-only: show it as not found.
  if (!configQuery.data || !threadType) {
    return (
      <div className={PANEL}>
        Không tìm thấy cuộc trò chuyện {threadId}.{backLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ThreadConfigHeader
        backHref={backHref}
        threadId={threadId}
        threadName={threadName}
        threadType={threadType}
      />
      <ThreadConfigForm
        config={configQuery.data}
        key={threadId}
        threadId={threadId}
        threadName={threadName}
        threadType={threadType}
      />
    </div>
  );
}

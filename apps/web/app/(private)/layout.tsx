import type { ReactNode } from 'react';
import { AppNavigation } from '@/shared/ui/app-navigation';
import { PullToRefresh } from '@/shared/ui/pull-to-refresh';
import { PwaUpdateBar } from '@/shared/ui/pwa-status-stack';
import { ROUTE_CONTENT_ID, RouteMotion } from '@/shared/ui/route-motion';
import { WorkspaceHeader } from '@/shared/ui/workspace-header';

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid h-dvh min-h-0 grid-cols-[210px_minmax(0,1fr)] gap-4 overflow-hidden p-3 max-[960px]:flex max-[960px]:h-auto max-[960px]:min-h-dvh max-[960px]:flex-col max-[960px]:gap-3 max-[960px]:overflow-visible max-[960px]:pt-[calc(0.625rem+env(safe-area-inset-top))] max-[960px]:pr-[max(0.75rem,env(safe-area-inset-right))] max-[960px]:pb-[calc(56px+1.25rem+env(safe-area-inset-bottom))] max-[960px]:pl-[max(0.75rem,env(safe-area-inset-left))]">
      <AppNavigation />
      <PullToRefresh />
      <RouteMotion />
      <section
        id={ROUTE_CONTENT_ID}
        className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain max-[960px]:overflow-visible"
      >
        <WorkspaceHeader />
        <PwaUpdateBar />
        {children}
      </section>
    </main>
  );
}

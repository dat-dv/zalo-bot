import type { ReactNode } from 'react';
import { AppNavigation } from '@/shared/ui/app-navigation';
import { WorkspaceHeader } from '@/shared/ui/workspace-header';

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid h-dvh min-h-0 grid-cols-[210px_minmax(0,1fr)] gap-4 overflow-hidden p-3 max-[960px]:flex max-[960px]:h-auto max-[960px]:min-h-dvh max-[960px]:flex-col max-[960px]:gap-3 max-[960px]:overflow-visible max-[960px]:px-3 max-[960px]:pt-2.5 max-[960px]:pb-5">
      <AppNavigation />
      <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain max-[960px]:overflow-visible">
        <WorkspaceHeader />
        {children}
      </section>
    </main>
  );
}

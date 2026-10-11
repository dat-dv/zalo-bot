'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { captureDashboardToken } from '@/modules/auth/client/auth-storage';
import { ThemeProvider } from './theme-provider';
import { LocaleProvider } from './locale-provider';
import { MoneyVisibilityProvider } from './money-visibility-provider';
import { ReactScanProvider } from './react-scan-provider';
import { ErrorBoundary } from '@/shared/ui/error-boundary';

function AppLoadingFallback() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-sm font-semibold tracking-wide text-slate-200">
          Đang tải bảng điều khiển...
        </span>
        <span className="text-xs text-slate-400">Vui lòng chờ trong giây lát</span>
      </div>
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    captureDashboardToken();
    setReady(true);
  }, []);

  return (
    <ErrorBoundary>
      <ReactScanProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <MoneyVisibilityProvider>
              <ThemeProvider>{ready ? children : <AppLoadingFallback />}</ThemeProvider>
            </MoneyVisibilityProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </ReactScanProvider>
    </ErrorBoundary>
  );
}

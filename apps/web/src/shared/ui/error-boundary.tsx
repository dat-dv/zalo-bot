'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearAndReload = (): void => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    window.location.href = '/';
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 text-slate-100">
          <section className="w-full max-w-md rounded-lg border border-rose-900/50 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-rose-800 bg-rose-950/40 text-2xl text-rose-400">
                ⚠️
              </div>
              <h1 className="text-lg font-bold text-slate-100">Đã xảy ra lỗi hiển thị giao diện</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Hệ thống gặp sự cố khi hiển thị dữ liệu bảng điều khiển. Vui lòng thử làm mới trang
                hoặc đăng nhập lại từ Zalo Bot.
              </p>
              {this.state.error?.message && (
                <div className="mt-4 max-h-24 w-full overflow-y-auto rounded bg-slate-950 p-2 text-left font-mono text-[11px] text-rose-300">
                  {this.state.error.message}
                </div>
              )}
              <div className="mt-6 flex w-full flex-col gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                >
                  🔄 Tải lại trang
                </button>
                <button
                  type="button"
                  onClick={this.handleClearAndReload}
                  className="inline-flex min-h-[38px] w-full items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Xóa bộ nhớ đệm & Làm mới
                </button>
              </div>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

---
trigger: model_decision
description: "Client-side routing in static export, Client Route Guard (AuthGuard), dynamic URL query state management (useSearchParams/nuqs), and client hydration skeleton fallbacks."
metadata:
  agent-artifact:
    id: nextjs-static-rule-03
    type: rule
    explanation: .agents/system-explain/plugins/nextjs-static/rules/03-client-routing-and-state.md
    depends_on:
      - .claude/skills/nextjs-static/rules/01-static-export-and-build-constraints.md
---

# Client Route Guards, Dynamic URL State, & Hydration Fallback Rules

## 1. Client Route Guard (`<AuthGuard>` Component & Hook)

Because static export cannot evaluate server middleware per-request, private routes MUST be protected on the client via an `<AuthGuard>` wrapper component.

- Private routes MUST be protected on the client via an `<AuthGuard>` wrapper component.
- All navigation redirects in `<AuthGuard>` MUST import destination paths from `APP_ROUTES` constants rather than using hardcoded string literals.

```typescript
// src/shared/components/auth-guard.tsx (Using centralized APP_ROUTES)
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { APP_ROUTES } from '@/shared/constants/routes';
import { Skeleton } from '@/components/atoms/skeleton';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace(`${APP_ROUTES.AUTH.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  if (isAuthenticated === null) {
    // Show full-page skeleton loading while verifying auth on client
    return (
      <div className="flex h-screen w-full items-center justify-center p-8 space-y-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  return <>{children}</>;
}
```

## 2. Dynamic URL State & Suspense Boundaries

- When using `useSearchParams()` in Next.js App Router static client components, wrap the component in a React `<Suspense fallback={<SkeletonLayout />}>` boundary to prevent static build failures.
- For type-safe query parameter state, prefer libraries like `nuqs` or custom hooks wrapping `useSearchParams()`.

## 3. Client Hydration Fallback Discipline

- Because the static HTML file contains initial empty markup before client data fetching completes:
- Views MUST render explicit **Skeleton Loading** components during initial client query execution (`isLoading = true`) to eliminate Layout Shifts (CLS).

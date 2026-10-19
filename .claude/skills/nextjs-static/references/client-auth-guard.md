# Client Route Guard (`<AuthGuard>`) Recipe

In pure Static SPA mode, routes are protected entirely on the client since no server runtime is present.

## 1. Complete `<AuthGuard>` Component Implementation

> [!NOTE]
> Redirect paths (e.g. `/login`) and storage keys (e.g. `'access_token'`) in this recipe are illustrative examples. Always adapt route definitions and storage keys to match your project's specific routing architecture.

```typescript
// src/shared/components/auth-guard.tsx (Illustrative Example: Adapt to project requirements)
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/atoms/skeleton';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for access token in browser storage
    const token = localStorage.getItem('access_token');

    if (!token) {
      // Redirect unauthenticated user to login with return path
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  // Render skeleton fallback while auth is being verified
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-8 space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  return <>{children}</>;
}
```

## 2. Usage in Protected Route Pages

Wrap protected view components with `<AuthGuard>` in their respective route layout or view:

```typescript
// src/app/dashboard/layout.tsx
'use client';

import { AuthGuard } from '@/shared/components/auth-guard';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

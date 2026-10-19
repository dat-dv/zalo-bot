# Client QueryProvider & Static Metadata Recipe

Guide for configuring the TanStack Query Singleton Provider and static metadata in Next.js Static Export SPA mode.

## 1. Client Browser Singleton QueryProvider (`src/shared/providers/query-provider.tsx`)

In pure static SPA applications, create a single `QueryClient` instance in client state:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Use useState to ensure QueryClient is initialized only once per browser session
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

## 2. Static Metadata & `generateStaticParams()`

In static export, metadata must be static or evaluated during build time via `generateStaticParams()`:

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { QueryProvider } from '@/shared/providers/query-provider';

export const metadata: Metadata = {
  title: 'Admin Portal | My App',
  description: 'Enterprise Client SPA Admin Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

For dynamic route segments with pre-rendered pages:

```typescript
// src/app/docs/[slug]/page.tsx
export function generateStaticParams() {
  return [
    { slug: 'getting-started' },
    { slug: 'architecture' },
    { slug: 'api-reference' },
  ];
}
```

## 3. Public Environment Scoping (`.env.local` / `.env.production`)

```env
# All variables consumed by static client code MUST use NEXT_PUBLIC_
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

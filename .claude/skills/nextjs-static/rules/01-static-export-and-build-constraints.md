---
trigger: model_decision
description: "Static export configuration (output: 'export'), prohibition of server-only features (headers, cookies, route handlers), and image unoptimized settings."
metadata:
  agent-artifact:
    id: nextjs-static-rule-01
    type: rule
    explanation: .agents/system-explain/plugins/nextjs-static/rules/01-static-export-and-build-constraints.md
    depends_on:
      - .agents/rules/core.md
---

# Next.js Static Export (`output: 'export'`) & Build Constraints Rules

## 1. Next.js Static Export Configuration (`next.config.ts` / `next.config.mjs`)

Applications operating in pure Static SPA mode MUST configure Next.js for HTML/CSS/JS static output:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export without Node.js image optimization server
  },
};

export default nextConfig;
```

## 2. Forbidden Server-Only Dynamic APIs

Because static export produces pre-rendered HTML/JS files deployed to CDNs/Nginx without a Node.js server runtime:

- **FORBIDDEN (Throws Build Error)**:
  - `cookies()` from `next/headers`
  - `headers()` from `next/headers`
  - `export const dynamic = 'force-dynamic'`
  - Server Actions that depend on live server execution
  - Dynamic API Route Handlers (`src/app/api/...`) that cannot be evaluated at build time
  - NextAuth server-side session endpoints (`/api/auth/[...nextauth]`)
- **PERMITTED & MANDATORY**:
  - Pure Client-Side Rendering (`'use client'`) for all interactive components and views.
  - Generating static route parameters via `generateStaticParams()` for dynamic route segments (e.g. `[id]`).
  - Standard client `fetch()` / Axios calls executed inside client components or custom hooks.

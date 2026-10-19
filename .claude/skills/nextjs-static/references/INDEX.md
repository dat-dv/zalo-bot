# Next.js Static Export & Pure React SPA References Index

This directory provides production-grade reference recipes for building, securing, and deploying static Single Page Applications (SPA) with Next.js (`output: 'export'`).

## Recipes & Guides

1. **[Client Route Guard & Auth Protection](client-auth-guard.md)**
   - `<AuthGuard>` wrapper component for protecting client-side routes.
   - Suspense boundaries & full-page skeleton loading fallbacks.

2. **[Direct Axios HTTP Client & Interceptors](direct-axios-interceptors.md)**
   - `directHttpClient` setup in `src/shared/utils/request.ts`.
   - Bearer Token injection from `localStorage`.
   - 401 Unauthorized handling & automatic session cleanup.

3. **[Static CDN & Nginx Deployment Configuration](static-cdn-deployment.md)**
   - Nginx SPA fallback routing (`try_files $uri $uri/ /index.html;`).
   - Static asset caching (`_next/static`).
   - Hosting on S3/CloudFront, Cloudflare Pages, Firebase Hosting.

4. **[Client QueryProvider & Static Metadata](query-provider-and-static-metadata.md)**
   - TanStack Query Singleton Provider setup for static browser runtime.
   - Static OpenGraph/title metadata & `generateStaticParams()`.
   - `NEXT_PUBLIC_*` environment variables scoping checklist.

---
trigger: model_decision
description: "Client-side environment variable scoping (NEXT_PUBLIC_*), static export build output, and deployment to Nginx, S3/CloudFront, and static CDNs."
metadata:
  agent-artifact:
    id: nextjs-static-rule-04
    type: rule
    explanation: .agents/system-explain/plugins/nextjs-static/rules/04-env-scoping-and-deployment.md
    depends_on:
      - .claude/skills/nextjs-static/rules/01-static-export-and-build-constraints.md
---

# Client Environment Scoping & Static CDN Deployment Rules

## 1. Client Environment Variable Inlining (`NEXT_PUBLIC_*`)

In Static Export mode, all environment variables accessed in client code MUST be prefixed with `NEXT_PUBLIC_`:

- **Build-Time Inlining**: Next.js bakes `NEXT_PUBLIC_*` values directly into the static JS bundle at build time (`npm run build`).
- **Never Put Secrets in `NEXT_PUBLIC_*`**: Private API keys, database credentials, and signing secrets MUST NEVER be prefixed with `NEXT_PUBLIC_`.
- **Runtime Configuration Warning**: Because static HTML/JS files are pre-built, changing `.env` files on a server requires re-running `npm run build` unless using a runtime `config.json` fetch.

## 2. Nginx & Static Hosting Configuration

When deploying the `out/` directory to Nginx, S3/CloudFront, Cloudflare Pages, or Firebase Hosting:

- **SPA Fallback Routing**: Configure the web server to rewrite all unmatched routes to `index.html` (or serve `[page]/index.html` with `trailingSlash: true`):

```nginx
# Example Nginx SPA Configuration
server {
    listen 80;
    server_name app.domain.com;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Static assets caching
    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

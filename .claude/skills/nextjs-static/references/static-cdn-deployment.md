# Static CDN & Nginx Deployment Configuration Recipe

Deployment guidelines for serving Next.js Static Export output (`out/`) on web servers and CDNs.

## 1. Nginx Production Configuration

```nginx
server {
    listen 80;
    server_name app.example.com;

    root /var/www/app/out;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static Assets Caching (Immutable JS/CSS)
    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

## 2. Static CDN Hosting Platforms

- **Cloudflare Pages / Vercel Static**: Automatic SPA route handling with `trailingSlash: true`.
- **AWS S3 + CloudFront**: Configure CloudFront Error Pages to return `/index.html` with status `200` for 403/404 HTTP codes.
- **Firebase Hosting**: Configure `"rewrites": [ { "source": "**", "destination": "/index.html" } ]` in `firebase.json`.

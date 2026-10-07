import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import path from 'path';

// 1. Ưu tiên nạp biến môi trường riêng của apps/web (.env.local, .env)
loadEnvConfig(import.meta.dirname);
// 2. Dự phòng nạp root nếu chưa có file cấu hình trong apps/web
loadEnvConfig(path.resolve(import.meta.dirname, '../..'));

const isStaticExport = process.env.NODE_ENV === 'production';
const configuredApiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '');

let apiOrigin = 'http://localhost:3000';
try {
  const url = new URL(configuredApiOrigin);
  if (['http:', 'https:'].includes(url.protocol)) {
    apiOrigin = configuredApiOrigin;
  }
} catch {
  apiOrigin = 'http://localhost:3000';
}

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  trailingSlash: false,
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `${apiOrigin}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;

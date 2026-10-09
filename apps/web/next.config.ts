import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import path from 'path';

// Chỉ nạp 1 file biến môi trường duy nhất tại root
loadEnvConfig(path.resolve(import.meta.dirname, '../..'));

const isStaticExport = process.env.NODE_ENV === 'production';
const defaultPort = process.env.NGINX_PORT || process.env.GATEWAY_PORT || '3000';
const configuredApiOrigin = (process.env.NEXT_PUBLIC_API_URL || `http://localhost:${defaultPort}`)
  .trim()
  .replace(/\/+$/, '');

let apiOrigin = `http://localhost:${defaultPort}`;
try {
  const url = new URL(configuredApiOrigin);
  if (['http:', 'https:'].includes(url.protocol)) {
    apiOrigin = configuredApiOrigin;
  }
} catch {
  apiOrigin = `http://localhost:${defaultPort}`;
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

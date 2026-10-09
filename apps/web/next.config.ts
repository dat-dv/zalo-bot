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

const devOrigins = new Set<string>([
  'localhost',
  '127.0.0.1',
  '*.trycloudflare.com',
  '*.ngrok-free.app',
  '*.ngrok.app',
  '*.loca.lt',
]);

const registerOrigin = (raw?: string) => {
  if (!raw) return;
  try {
    const url = new URL(raw.trim());
    devOrigins.add(url.hostname);
    if (url.port) devOrigins.add(url.host);
  } catch {
    const cleaned = raw.trim().replace(/^https?:\/\//i, '').split('/')[0];
    if (cleaned) devOrigins.add(cleaned);
  }
};

registerOrigin(process.env.APP_URL);
registerOrigin(process.env.WEB_ORIGIN);
registerOrigin(process.env.NEXT_PUBLIC_APP_URL);

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(devOrigins),
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


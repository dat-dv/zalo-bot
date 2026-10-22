import type { MetadataRoute } from 'next';
import { APP_ROUTES, DEFAULT_LOCALE, translate } from '@zalobot/contracts';

export const dynamic = 'force-static';

// Served as /manifest.webmanifest; nginx sends it with `no-cache` so installed apps pick up changes.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable app identity: changing `id` would make browsers treat it as a different app.
    id: APP_ROUTES.home,
    name: 'zalobot — Trợ lý Cá nhân & Quản lý Tài chính',
    short_name: 'zalobot',
    description:
      'Nền tảng quản lý chi tiêu, công nợ, lịch trình và ghi chú cá nhân thông minh tích hợp zalo Bot.',
    lang: 'vi',
    dir: 'ltr',
    start_url: APP_ROUTES.home,
    scope: APP_ROUTES.home,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#090d16',
    theme_color: '#0f172a',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: translate(DEFAULT_LOCALE, 'nav.transactions'),
        url: APP_ROUTES.transactions,
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: translate(DEFAULT_LOCALE, 'nav.debts'),
        url: APP_ROUTES.debts,
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: translate(DEFAULT_LOCALE, 'nav.reminders'),
        url: APP_ROUTES.reminders,
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}

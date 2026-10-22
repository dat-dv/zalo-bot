import type { Metadata, Viewport } from 'next';
import '../src/styles.css';
import { AppProviders } from '@/shared/providers/app-providers';

const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const appUrl =
  rawAppUrl && /^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : 'https://bot.datintech.site';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'zalobot — Quản lý Tài chính & Kế hoạch Cá nhân',
    template: '%s | zalobot',
  },
  description:
    'Nền tảng quản lý chi tiêu, công nợ, lịch trình và ghi chú cá nhân thông minh tích hợp zalo Bot.',
  applicationName: 'zalobot',
  authors: [{ name: 'zalobot', url: 'https://bot.datintech.site/about' }],
  generator: 'Next.js',
  keywords: [
    'zalobot',
    'zalo bot',
    'quản lý tài chính',
    'thu chi',
    'công nợ',
    'lịch trình',
    'ghi chú cá nhân',
    'personal finance',
    'task manager',
  ],
  creator: 'zalobot',
  publisher: 'zalobot',
  category: 'productivity',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    url: '/',
    siteName: 'zalobot',
    title: 'zalobot — Quản lý Tài chính & Kế hoạch Cá nhân',
    description:
      'Nền tảng quản lý chi tiêu, công nợ, lịch trình và ghi chú cá nhân thông minh tích hợp zalo Bot.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'zalobot — Trợ lý Cá nhân & Quản lý Tài chính Thông minh',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zalobot — Quản lý Tài chính & Kế hoạch Cá nhân',
    description:
      'Nền tảng quản lý chi tiêu, công nợ, lịch trình và ghi chú cá nhân thông minh tích hợp zalo Bot.',
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'zalobot',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f172a' },
    { media: '(prefers-color-scheme: dark)', color: '#090d16' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Draw under the notch / home indicator; the shell pads itself with env(safe-area-inset-*).
  viewportFit: 'cover',
  // Android Chrome shrinks the layout viewport when the on-screen keyboard opens,
  // so fixed dialogs stay above the keyboard instead of being covered by it.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi-VN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem('zalobot-theme'); const theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; } catch { } })()`,
          }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

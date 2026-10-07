# Kế hoạch Thiết kế Open Graph, zalo Meta Tags & Favicon Suite cho zalobot

Thiết kế và triển khai toàn diện hệ thống metadata nhận diện thương hiệu, hình ảnh xem trước liên kết tối ưu cho zalo (Open Graph / Twitter Card), bộ Favicon đa kích thước chuẩn retina (SVG, ICO, PNG), Web App Manifest cho PWA, cùng cấu hình thẻ Meta/Viewport đáp ứng tiêu chuẩn Enterprise SaaS.

---

## 1. Hiện trạng & Mục tiêu

### Hiện trạng

- `apps/web/app/layout.tsx` hiện chỉ cấu hình `title` và `description` cơ bản, chưa có `openGraph`, `twitter`, `icons`, `viewport`, hay `manifest`.
- Chưa có thư mục `apps/web/public/` hoặc các tệp tĩnh nhận diện: không có `favicon.ico`, `icon.svg`, `apple-touch-icon.png`, `og-image.png`, `site.webmanifest`.
- Khi người dùng nhận được link từ zalo Bot hoặc chia sẻ vào hội nhóm, zalo hiển thị link trần không có ảnh banner preview, không có favicon sắc nét, và giao diện webview chưa tối ưu `theme-color`.

### Mục tiêu

1. **Bộ Favicon & App Icons hoàn chỉnh**:
   - `favicon.ico`: 32x32 ICO cho trình duyệt legacy và tab icon tiêu chuẩn.
   - `favicon.svg` / `icon.svg`: Vector SVG sắc nét tuyệt đối trên mọi độ phân giải màn hình Retina/4K, phong cách Enterprise Slate & Cobalt Blue.
   - `apple-touch-icon.png`: 180x180 PNG cho thiết bị iOS / Safari Home Screen.
   - `icon-192.png` & `icon-512.png`: PWA standard icons cho Android / PWA install.
2. **Open Graph & zalo Link Preview Banner (`og-image.png`)**:
   - Banner kích thước chuẩn 1200x630px (tỷ lệ 1.91:1) tối ưu riêng cho bộ cào dữ liệu (preview scraper) của zalo, Facebook, Zalo, Twitter/X.
   - Bố cục trực quan: Brand zalobot, slogan "Trợ lý Cá nhân & Quản lý Tài chính Thông minh", các huy hiệu chức năng chính (_Thu–Chi, Công nợ, Lịch trình, Trợ lý AI_), cùng mockup tóm tắt chỉ số tài chính phong cách data-dense enterprise.
3. **Cấu hình Next.js App Router Metadata & Viewport chuẩn mực**:
   - `metadataBase` xử lý dynamic origin hoặc fallback domain.
   - `title` với template pattern: `%s | zalobot`.
   - `openGraph` & `twitter` cards đầy đủ (`type: 'website'`, `locale: 'vi_VN'`, `siteName: 'zalobot'`).
   - `viewport` export riêng biệt quản lý `themeColor` đa chế độ (Light `#0f172a`, Dark `#090d16`) và cấu hình chống zoom vỡ layout trong zalo WebApp.
   - `site.webmanifest` cấu hình PWA standalone mode.
4. **Metadata chi tiết cho từng trang chức năng**:
   - Cung cấp tiêu đề trang riêng cho từng route: `/analytics`, `/debts`, `/expenses`, `/income`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/transactions`.

---

## 2. Thay đổi chi tiết đề xuất

### A. Tài nguyên đồ họa & Tĩnh (`apps/web/public/`)

#### [NEW] `apps/web/public/favicon.ico`

- Icon định dạng ICO cho browser tabs.

#### [NEW] `apps/web/public/favicon.svg` & `apps/web/public/icon.svg`

- Logo monogram hình học chữ "T" hiện đại kết hợp đường nét trợ lý thông minh trên nền Dark Slate (`#0f172a`) viền tinh tế.

#### [NEW] `apps/web/public/apple-touch-icon.png` (180x180)

- Icon chuẩn cho iOS bookmark & Home Screen icon.

#### [NEW] `apps/web/public/icon-192.png` & `apps/web/public/icon-512.png`

- Bộ icon cho Web App Manifest / Android / PWA.

#### [NEW] `apps/web/public/og-image.png` (1200x630) & `apps/web/public/og-image.svg`

- Banner Open Graph độ nét cao, tương thích tối đa với zalo link preview crawler.

#### [NEW] `apps/web/public/site.webmanifest`

- File khai báo PWA manifest (name, short_name, icons, theme_color, background_color, display: standalone).

---

### B. Cấu hình Layout & Metadata (`apps/web/app/`)

#### [MODIFY] [`apps/web/app/layout.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/layout.tsx)

- Cập nhật `export const metadata: Metadata`:
  - `metadataBase`: `new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://zalobot.app')`
  - `title`: `{ default: 'zalobot — Quản lý Tài chính & Kế hoạch Cá nhân', template: '%s | zalobot' }`
  - `description`: 'Nền tảng quản lý chi tiêu, công nợ, lịch trình và ghi chú cá nhân thông minh tích hợp zalo Bot.'
  - `applicationName`: 'zalobot'
  - `keywords`: `['zalobot', 'zalo bot', 'quản lý tài chính', 'quản lý chi tiêu', 'công nợ', 'lịch trình cá nhân', 'personal finance', 'task manager']`
  - `icons`: `{ icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] }`
  - `manifest`: `'/site.webmanifest'`
  - `openGraph`: `{ type: 'website', locale: 'vi_VN', siteName: 'zalobot', title: '...', description: '...', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'zalobot Dashboard' }] }`
  - `twitter`: `{ card: 'summary_large_image', title: '...', description: '...', images: ['/og-image.png'] }`
  - `appleWebApp`: `{ capable: true, title: 'zalobot', statusBarStyle: 'black-translucent' }`
- Cập nhật `export const viewport: Viewport`:
  - `themeColor`: `[{ media: '(prefers-color-scheme: light)', color: '#0f172a' }, { media: '(prefers-color-scheme: dark)', color: '#090d16' }]`
  - `width`: `'device-width'`
  - `initialScale`: `1`

---

### C. Metadata cho từng trang con (`apps/web/app/(private)/*/page.tsx`)

#### [MODIFY] [`apps/web/app/(private)/analytics/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/analytics/page.tsx>) -> Title: "Phân tích tài chính"

#### [MODIFY] [`apps/web/app/(private)/calendar/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/calendar/page.tsx>) -> Title: "Lịch trình sự kiện"

#### [MODIFY] [`apps/web/app/(private)/contacts/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/contacts/page.tsx>) -> Title: "Người liên quan"

#### [MODIFY] [`apps/web/app/(private)/debts/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/debts/page.tsx>) -> Title: "Vay & cho vay"

#### [MODIFY] [`apps/web/app/(private)/expenses/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/expenses/page.tsx>) -> Title: "Chi tiêu"

#### [MODIFY] [`apps/web/app/(private)/income/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/income/page.tsx>) -> Title: "Thu nhập"

#### [MODIFY] [`apps/web/app/(private)/reminders/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/reminders/page.tsx>) -> Title: "Nhắc nhở"

#### [MODIFY] [`apps/web/app/(private)/tasks/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/tasks/page.tsx>) -> Title: "Việc cần làm"

#### [MODIFY] [`apps/web/app/(private)/transactions/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/transactions/page.tsx>) -> Title: "Thu chi"

---

## 3. Kế hoạch Kiểm thử & Xác minh

### Automated Quality Gates

1. `npm run typecheck` (Kiểm tra kiểu dữ liệu của Metadata & Viewport exports trong Next.js App Router).
2. `npm run lint` (Đảm bảo tuân thủ chuẩn ESLint và không có quy tắc nào bị vi phạm).
3. `npm run build:web` (Đảm bảo Next.js build & export thành công các tệp tĩnh vào thư mục `out/`, bao gồm toàn bộ assets trong `public/`).
4. `npm run agent-system:validate` (Xác thực hệ thống tài liệu và liên kết toàn vẹn).

### Manual Verification

- Kiểm tra các thẻ `<meta property="og:image" ...>`, `<meta property="og:title" ...>`, `<link rel="icon" ...>`, `<link rel="apple-touch-icon" ...>` được tạo đúng trong HTML head.
- Kiểm tra hiển thị hình ảnh SVG / PNG qua trình duyệt và mô phỏng hiển thị trên zalo Webview.

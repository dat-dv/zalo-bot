# Implementation Plan — PWA cho mobile (mức 1 + 2)

- Task slug: `pwa-mobile`
- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Rủi ro: **HIGH** (thêm cột DB + migration, thêm endpoint đăng nhập mới, đổi nội dung tin nhắn bot, service worker can thiệp mọi request điều hướng)
- Phạm vi: cài đặt được, offline shell, xử lý bản cập nhật, đăng nhập ngay trong PWA. **Không** làm push notification.

## 1. Bối cảnh (đã kiểm tra trong code)

| Đã có | Vị trí |
| --- | --- |
| Manifest `display: standalone`, icon 192/512, `apple-touch-icon` | `apps/web/public/site.webmanifest`, `apps/web/public/*.png` |
| `appleWebApp.capable`, `themeColor`, `viewportFit: 'cover'`, `interactiveWidget` | `apps/web/app/layout.tsx` |
| Mobile shell có bottom tab bar + safe-area | `apps/web/app/(private)/layout.tsx`, commit `a53ff47` |
| Static export (`output: 'export'` khi production), nginx phục vụ `out/` | `apps/web/next.config.ts`, `apps/web/nginx.conf` |
| Đăng nhập: bot gửi link một lần `/api/access?token=` (20 phút) → access token 24h (localStorage) + refresh cookie `reports_refresh` 7 ngày | `reports-token.service.ts`, `reports.controller.ts`, `dashboard-tool.strategy.ts`, `auth-storage.ts` |

| Thiếu / vấn đề | Hệ quả |
| --- | --- |
| Không có service worker | Không có offline shell, không kiểm soát được việc cập nhật |
| Icon `"purpose": "any maskable"` dùng chung | Android cắt icon theo mặt nạ nên mất viền |
| Manifest thiếu `id`, `scope`, `lang`, `shortcuts` | Danh tính app không ổn định, không có lối tắt |
| nginx cache `\.js$` 1 năm với `immutable` | Nếu thêm `/sw.js` mà không tách riêng, app không bao giờ cập nhật được |
| HTML không có `Cache-Control` | Trình duyệt có thể tự cache HTML cũ |
| **Đăng nhập chỉ qua link** | Trên iOS, app đã cài có localStorage/cookie riêng, tách khỏi Safari. Link từ Zalo mở trong Safari hoặc trình duyệt của Zalo, không mở PWA, nên người dùng không đăng nhập được trong app đã cài |

## 2. Thiết kế

### 2.1 Đăng nhập bằng mã trong PWA (API + bot + web)

**Ý tưởng:** cùng một bản ghi `dashboard_exchange_tokens` sinh ra cả link lẫn **mã đăng nhập 8 ký tự**. Link và mã dùng chung `consumed_at`, nên dùng một trong hai thì cái còn lại cũng hết hiệu lực. TTL giữ nguyên 20 phút.

- **Định dạng mã:** 8 ký tự Crockford base32 (bỏ các ký tự dễ nhầm `I L O U`), hiển thị dạng `K7P2-QX9M`. Khi nhận: đổi sang chữ hoa, bỏ khoảng trắng và `-`. Không gian mã 32⁸ ≈ 1,1·10¹², kèm rate limit thì đủ an toàn trong cửa sổ 20 phút.
- **DB:** thêm cột `code_hash varchar NULL` + unique index vào `dashboard_exchange_tokens`. Chỉ lưu SHA-256 của mã đã chuẩn hoá, giống cách đang lưu `token_hash`. Tạo migration mới bằng `npm run migration:generate --workspace @zalobot/api`; không sửa migration cũ.
- **`ReportsTokenService`:**
  - `issueExchangeToken(userId)` đổi kiểu trả về thành `{ token: string; code: string }`. Hiện chỉ có một nơi gọi là `DashboardToolStrategy`. Nếu insert trùng `code_hash` thì thử lại tối đa 3 lần.
  - Thêm `consumeExchangeCode(code)`: cùng kiểu cập nhật nguyên tử như `consumeExchangeToken` (`UPDATE … WHERE code_hash = :h AND consumed_at IS NULL AND expires_at > now`).
- **Endpoint mới `POST /api/access/code`** trong `ReportsController`:
  - Body: `{ code: string }`, validate bằng DTO class-validator.
  - Thành công: tạo access + refresh như `/api/access`, set cookie `reports_refresh`, trả `{ data: { accessToken, expiresAt } }` (cùng dạng với `/api/refresh`).
  - Sai, hết hạn hoặc đã dùng: `401` dạng JSON (không phải trang HTML như `/api/access`).
  - **Rate limit theo IP:** tối đa 10 lần thử trong 15 phút qua Redis (INCR + EXPIRE), vượt thì trả `429`. Lúc thực thi em sẽ dùng lại cơ chế rate limit sẵn có nếu có; nếu `RedisService` chưa có `incr` thì thêm. IP lấy theo `x-forwarded-for`/`req.ip`, cách lấy giống phần còn lại của API.
- **Bot (`DashboardToolStrategy`):** thêm một dòng mã vào tin nhắn, ví dụ:
  `🔑 Mã đăng nhập trong ứng dụng đã cài: K7P2-QX9M`
  Phần còn lại của tin giữ nguyên bố cục.
- **Contracts (`packages/contracts`):**
  - `API_ROUTES.accessCode = '/api/access/code'`
  - DTO `IDashboardAccessCodeRequest`, và kiểu response nếu contracts chưa có.
  - Key i18n vi/en cho form nhập mã.
- **Web (`modules/auth`):**
  - `presentation/components/access-code-form.tsx`: ô nhập mã (`inputMode="text"`, `autoCapitalize="characters"`, `autoComplete="one-time-code"`), mutation TanStack gọi `httpClient.post(API_ROUTES.accessCode)`. Thành công thì `setAccessToken` rồi `window.location.assign(APP_ROUTES.dashboard)`. Có hiển thị lỗi cho `401` và `429`.
  - `SessionStateScreen` luôn hiện form này dưới nút "Mở Zalo bot". Form hữu ích ở mọi trình duyệt, không chỉ khi chạy standalone.
  - Hàm thuần `normalizeAccessCode` có spec.

### 2.2 Manifest và icon

- Bỏ `public/site.webmanifest`, thay bằng `apps/web/app/manifest.ts` (Next metadata route, chạy được với static export, giống `robots.ts`/`sitemap.ts` đang có). Dùng `APP_ROUTES` cho `start_url` và `shortcuts`, nên không phải hardcode route.
- Bỏ `manifest: '/site.webmanifest'` trong `layout.tsx`, vì Next tự chèn `<link rel="manifest">`.
- Nội dung manifest:
  - Giữ `name`, `short_name`, `description`, `display: standalone`, màu sắc và `orientation: portrait-primary` như hiện tại.
  - Thêm `id: '/'`, `scope: '/'`, `lang: 'vi'`.
  - `icons`: 192 và 512 với `purpose: 'any'`; thêm `icon-maskable-192.png` và `icon-maskable-512.png` với `purpose: 'maskable'`. Icon maskable lấy từ `icon.svg`, chừa vùng an toàn khoảng 20%. Em sẽ render bằng canvas trong trình duyệt có sẵn để không thêm dependency.
  - `shortcuts`: Giao dịch (`APP_ROUTES.transactions`), Công nợ (`APP_ROUTES.debts`), Nhắc việc (`APP_ROUTES.reminders`).

### 2.3 Service worker (`apps/web/public/sw.js`, viết tay, không thêm thư viện)

Không dùng `next-pwa`/Serwist vì Next 16 mặc định chạy Turbopack, còn các gói này gắn với webpack. Em chưa tra lại tài liệu ngoài để xác nhận. Viết tay khoảng 100 dòng JS là đủ cho phạm vi này.

- **Phiên bản:** đăng ký bằng `/sw.js?v=<APP_VERSION>`; SW đọc `self.location.search` để đặt tên cache `zalobot-<version>`. Khi `activate`, SW xoá các cache cũ. `APP_VERSION` lấy từ `apps/web/package.json`; lúc thực thi em sẽ chọn cách đưa vào build, có kiểm tra `global/environment-guard.md`.
- **Precache khi `install`:** `/offline.html`, icon, manifest.
- **Không can thiệp (luôn đi mạng):** mọi request khác `GET`, khác origin, và các đường dẫn `/api/`, `/webhook`, `/zalo/`, `/oauth2callback`. Tránh cache dữ liệu tài chính và tránh làm hỏng luồng `/api/access`, OAuth.
- **Điều hướng HTML:** network-first. Thành công thì lưu bản mới của URL đó vào cache. Mất mạng thì dùng bản đã cache của URL; không có thì trả `/offline.html`.
- **`/_next/static/*`** (đã có hash, bất biến): cache-first.
- **Ảnh/icon/font cùng origin:** stale-while-revalidate.
- Nhận message `SKIP_WAITING` thì gọi `self.skipWaiting()`. SW **không** tự skipWaiting, để người dùng chủ động tải lại.
- **`public/offline.html`:** trang tĩnh tự chứa (CSS inline, song ngữ vi/en, tự theo light/dark), có nút "Thử lại".

### 2.4 Đăng ký SW, báo bản mới, trạng thái offline, cài app (web)

Thư mục mới `apps/web/src/shared/pwa/`:

- `pwa-environment.ts` (hàm thuần + spec):
  - `isStandalone()`: `display-mode: standalone` hoặc `navigator.standalone`.
  - `isIos()`.
  - `isZaloInAppBrowser()`: user agent có `Zalo`.
  - `canRegisterServiceWorker()`: production + secure context + có `serviceWorker`.
- `use-service-worker.ts`:
  - Đăng ký SW sau sự kiện `load`, chỉ ở production. Dev không đăng ký, để HMR không bị cache phá.
  - Theo dõi `updatefound`: worker mới `installed` và đã có `controller` thì đặt `updateReady = true`.
  - Gọi `registration.update()` khi tab hiển thị lại (`visibilitychange`), vì PWA thường mở rất lâu.
  - `applyUpdate()` gửi `SKIP_WAITING`; khi `controllerchange` thì reload đúng một lần.
- `use-online-status.ts`: `useSyncExternalStore` trên sự kiện `online`/`offline`.
- `use-install-prompt.ts`: giữ sự kiện `beforeinstallprompt` (Android/Chromium) để gọi `prompt()`; trả về trạng thái `installable | installed | ios-manual | unsupported`.
- `shared/ui/app-update-toast.tsx`: toast "Đã có phiên bản mới" + nút "Tải lại". Đặt ở đáy, trên bottom tab bar, có chừa safe-area.
- `shared/ui/offline-banner.tsx`: dải mỏng "Đang offline — dữ liệu có thể chưa cập nhật" ở đầu shell. TanStack Query mặc định `networkMode: 'online'` sẽ tự tạm dừng query khi offline.
- Gắn toast và banner vào `AppProviders` (hoặc `PrivateLayout`, sẽ chọn lúc làm để không ảnh hưởng các trang public).
- **Trang Settings:** thêm thẻ "Ứng dụng trên điện thoại":
  - Android/Chromium: nút "Cài ứng dụng".
  - iOS Safari: hướng dẫn Chia sẻ → Thêm vào MH chính.
  - Trình duyệt trong Zalo: hướng dẫn mở bằng Safari/Chrome.
  - Đã cài rồi: hiện "Đã cài".
  - Lúc thực thi em sẽ kiểm tra cấu trúc module `settings` để đặt file đúng chỗ.
- Toàn bộ chữ trong UI đi qua catalog i18n `packages/contracts` (vi/en). Giữ góc bo nhỏ `rounded-[3px]`/`rounded` theo quy ước UI.

### 2.5 nginx (`apps/web/nginx.conf`, production)

- `location = /sw.js` → `Cache-Control: no-cache`. Exact match được ưu tiên hơn regex `\.js$` đang cache 1 năm.
- `location = /manifest.webmanifest` → `no-cache`, kèm MIME `application/manifest+json`.
- `location /` (HTML) → thêm `Cache-Control: no-cache`, để HTML luôn được kiểm tra lại. Các asset có hash vẫn theo regex, cache 1 năm.
- `docker/nginx/nginx.local.conf.template` không cần sửa, vì dev proxy sang `next dev` và không đăng ký SW.

## 3. Danh sách file dự kiến

| Khu vực | File |
| --- | --- |
| API | `apps/api/src/database/entities/dashboard-exchange-token.entity.ts`, migration mới trong `apps/api/src/database/migrations/`, `apps/api/src/reports/reports-token.service.ts` (+ spec), `apps/api/src/reports/reports.controller.ts`, DTO mới `apps/api/src/reports/dto/dashboard-access-code.dto.ts`, `apps/api/src/zalo/text/strategies/dashboard-tool.strategy.ts`, có thể cả `apps/api/src/redis/redis.service.ts` |
| Contracts | `packages/contracts/src/index.ts` (route, DTO, i18n vi/en) |
| Web | `apps/web/app/manifest.ts` (mới), `apps/web/app/layout.tsx`, xoá `apps/web/public/site.webmanifest`, `apps/web/public/sw.js` (mới), `apps/web/public/offline.html` (mới), `apps/web/public/icon-maskable-{192,512}.png` (mới), `apps/web/src/shared/pwa/*` (mới, + spec), `apps/web/src/shared/ui/app-update-toast.tsx`, `apps/web/src/shared/ui/offline-banner.tsx`, `apps/web/src/shared/providers/app-providers.tsx`, `apps/web/src/modules/auth/presentation/components/{access-code-form,session-state-screen}.tsx`, thẻ cài app trong module `settings` |
| Hạ tầng | `apps/web/nginx.conf` |
| Docs (EN) | `.agents/knowledge/global/dashboard-session.md`, `.agents/knowledge/global/pwa.md` (mới), `.agents/knowledge/global/README.md`, `.agents/knowledge/modules/auth/README.md`, `.agents/knowledge/modules/settings/` |
| Docs (VI) | `.agents/docs/global/dashboard-session.md`, `.agents/docs/global/pwa.md` (mới), `.agents/docs/global/README.md`, `.agents/docs/modules/auth/README.md`, `.agents/docs/modules/settings/`, `.agents/docs/README.md` |

Các thay đổi đang có sẵn trong working tree (`transactions-screen.tsx`, `transactions-table.tsx`, `data-table*.tsx`) không thuộc task này, em sẽ giữ nguyên và không động vào.

## 4. Thứ tự thực hiện

1. Contracts: route, DTO, i18n.
2. API: entity + migration → `ReportsTokenService` (+ spec) → DTO + endpoint `POST /api/access/code` + rate limit → tin nhắn bot.
3. Web auth: `normalizeAccessCode` (+ spec), `AccessCodeForm`, gắn vào `SessionStateScreen`.
4. Manifest: `app/manifest.ts`, icon maskable, sửa `layout.tsx`, xoá `site.webmanifest`.
5. Service worker + `offline.html`.
6. `shared/pwa/*` (+ spec), toast cập nhật, banner offline, thẻ cài app ở Settings.
7. nginx.
8. Knowledge (EN) + docs (VI) + các file index.
9. Kiểm tra (mục 5).

## 5. Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test` cho cả 3 workspace (`@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
- Spec API cho mã đăng nhập:
  - Mã đúng thì đăng nhập được.
  - Dùng lại mã thì bị `401`.
  - Mã hết hạn thì bị `401`.
  - Đã dùng link rồi thì mã bị từ chối, và ngược lại.
  - Mã có chữ thường, dấu `-` hay khoảng trắng vẫn được chuẩn hoá đúng.
- Kiểm tra migration bằng cách generate và đọc SQL. Em sẽ báo lại nếu không chạy được migration trên DB local.
- `npm run build --workspace @zalobot/web`, rồi phục vụ thư mục `out/` trên localhost (secure context) và kiểm tra trong trình duyệt có sẵn:
  - Manifest được nhận, icon maskable hiện đúng.
  - SW ở trạng thái `activated`; request `/api/*` không đi qua cache.
  - Tắt server → điều hướng tới trang đã xem thì ra bản đã cache, tới trang chưa xem thì ra `offline.html`.
  - Build lại với version khác → toast "Đã có phiên bản mới" hiện, bấm "Tải lại" thì reload đúng một lần.
  - Màn hình chưa đăng nhập có form nhập mã; nhập mã thật lấy từ API local thì vào được dashboard.
- `node .claude/hooks/docs-drift-check.mjs` phải exit 0.
- **Không kiểm tra được ở đây (sẽ ghi rõ khi báo cáo):** cài thật trên iPhone/Android, hộp thoại cài của Chrome Android (WebAPK), và hành vi khi bấm link từ app Zalo.

## 6. Rủi ro và giới hạn đã biết

- **Service worker lỗi có thể giữ người dùng ở bản cũ.** Giảm thiểu: HTML luôn network-first, nginx `no-cache` cho `sw.js` và HTML. Nếu cần, có thể phát hành một `sw.js` "kill switch" (tự unregister và xoá cache) để gỡ.
- **iOS có thể xoá dữ liệu của PWA không mở trong thời gian dài.** Khi đó người dùng đăng nhập lại bằng mã. Refresh token vốn chỉ sống 7 ngày, nên không đổi gì so với hiện tại.
- **Kết nối Google (OAuth) từ trong PWA trên iOS** có thể mở ra Safari và không quay về app. Đề xuất làm việc này trong trình duyệt; em sẽ ghi vào docs, không sửa luồng OAuth trong task này.
- **Mã 8 ký tự yếu hơn token 32 byte.** Bù lại bằng TTL 20 phút, dùng một lần, chung trạng thái với link, và rate limit theo IP.
- **PWA bắt buộc HTTPS.** Production `bot.datintech.site` cần đang chạy HTTPS; em sẽ không đổi cấu hình TLS.

## 7. Cần anh quyết

1. Mã 8 ký tự dạng `K7P2-QX9M`, hay mã 6 chữ số (dễ gõ hơn nhưng yếu hơn, phải siết rate limit hơn)? **Em đề xuất 8 ký tự.**
2. Thẻ "Cài ứng dụng" chỉ đặt ở Settings, hay thêm banner gợi ý cài (có thể tắt) trên Dashboard khi mở trên mobile? **Em đề xuất chỉ ở Settings.**
3. Giữ khoá màn hình dọc `portrait-primary` như hiện tại? **Em đề xuất giữ.**

## 8. Tiến độ Phase 2 (dừng giữa chừng do hết usage, 2026-10-22)

Đã xong:
- Bước 1: contracts (`API_ROUTES.accessCode`, `IDashboardAccessCodeRequest`, `normalizeDashboardAccessCode`/`isDashboardAccessCode`, i18n `auth.accessCode.*`, `pwa.*`, `settings.app.*`).
- Bước 2: API (cột `code_hash` + migration `1724860000000`, `issueExchangeToken` trả `{ token, code }`, `consumeExchangeCode`, `POST /api/access/code`, `AccessCodeRateLimiter` 10/IP + 200 tổng trong 15 phút, `RedisService.incrWithTtl`, dòng mã trong tin bot). Spec pass.
- Bước 3: web `AccessCodeForm` trong `SessionStateScreen`; `httpClient` không refresh/retry khi `accessCode` bị 401.
- Bước 4: `app/manifest.ts`, icon maskable 192/512, xoá `site.webmanifest`.
- Bước 5: `public/sw.js`, `public/offline.html`, `NEXT_PUBLIC_APP_VERSION` trong `next.config.ts`.
- Bước 7 (một phần): `nginx.conf` no-cache cho HTML, `/sw.js`, `/manifest.webmanifest`.
- Bước 6 (một phần): `shared/pwa/pwa-environment.ts` + spec.

Còn lại:
- Bước 6: store/registrar đăng ký SW (`/sw.js?v=${NEXT_PUBLIC_APP_VERSION}`) + bắt `beforeinstallprompt` gắn vào `AppProviders`; `use-online-status`; `app-update-toast.tsx`; `offline-banner.tsx`; thẻ "Ứng dụng trên điện thoại" ở Settings (chèn tối thiểu vào `settings-screen.tsx`, file này đang có thay đổi của session khác). Hiện SW **chưa được đăng ký** nên chưa có tác dụng.
- Bước 8: knowledge (EN) + docs (VI): `global/dashboard-session.md`, `global/pwa.md` mới, `modules/auth`, `modules/settings`, các README index.
- Bước 9: lint/test toàn bộ 3 workspace, build static export, kiểm tra trong trình duyệt, chạy `docs-drift-check`.

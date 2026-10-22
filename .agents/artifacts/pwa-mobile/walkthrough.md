# Walkthrough — PWA cho mobile (mức 1 + 2)

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Lựa chọn ở mục 7: mã 8 ký tự, thẻ cài app chỉ ở Settings, giữ `portrait-primary`.

## Đã làm

| Phần | Thay đổi chính |
| --- | --- |
| Contracts | `API_ROUTES.accessCode`, `IDashboardAccessCodeRequest`, `DASHBOARD_ACCESS_CODE_ALPHABET/LENGTH`, `normalizeDashboardAccessCode`, `isDashboardAccessCode`, i18n `auth.accessCode.*`, `pwa.*`, `settings.app.*` (vi/en) |
| API | Cột `code_hash` + migration `1724860000000-AddCodeHashToDashboardExchangeTokens`; `issueExchangeToken` trả `{ token, code }`; `consumeExchangeCode`; `POST /api/access/code`; `AccessCodeRateLimiter` (10/IP, 200 tổng, 15 phút, fallback bộ nhớ khi Redis lỗi); `RedisService.incrWithTtl`; tin bot có dòng mã |
| Web auth | `AccessCodeForm` trong `SessionStateScreen`; `httpClient` không refresh/retry khi `/api/access/code` trả 401 |
| Manifest | `app/manifest.ts` (id/scope/lang/shortcuts), icon maskable 192/512, bỏ `site.webmanifest` |
| Service worker | `public/sw.js`, `public/offline.html`, `NEXT_PUBLIC_APP_VERSION` từ `package.json` |
| Client PWA | `shared/pwa/*` (môi trường, store, registrar, online status), `PwaStatusStack` (offline + bản mới, có nút ✕), `InstallAppRow` ở Settings → Tuỳ chọn |
| nginx | `no-cache` cho HTML, `/sw.js`, `/manifest.webmanifest` |
| Docs | knowledge/docs: `global/dashboard-session.md`, `global/pwa.md` (mới), `modules/auth`, `modules/settings`, các index |

Ngoài plan: thêm giới hạn tổng 200 lần thử (vì header IP có thể giả); thêm nút ✕ cho thẻ bản mới (thẻ che hàng tab đầu trang trên điện thoại).

## Kiểm tra đã chạy

- `lint`, `typecheck`: contracts, api, web pass. `test`: api 505/505, web 54/54 (gồm spec mới `dashboard-access-code`, `access-code-rate-limiter`, `pwa-environment`).
- `npm run build --workspace @zalobot/web` pass; `docs-drift-check` pass.
- Trình duyệt (bản build phục vụ trên localhost, không có backend):
  - Manifest đúng (`id: /`, 2 icon maskable, 3 shortcut); service worker `activated`, trang được kiểm soát.
  - Form mã: sai định dạng bị chặn tại client (không gửi request); mã đúng định dạng gửi đúng 1 request, 401 hiện "Mã không đúng…", không gọi refresh.
  - Offline (tắt server): trang đã mở mở được từ cache; trang chưa mở hiện `offline.html`; `/api/*` không lấy từ cache.
  - Deploy giả lập (build mới, version khác): thẻ "Đã có phiên bản mới" hiện dưới header; "Tải lại" reload một lần, worker mới active, cache version cũ bị xoá; ✕ ẩn thẻ.
  - Settings → Tuỳ chọn hiện dòng "Ứng dụng trên điện thoại".

## Chưa kiểm tra

- Chạy migration và gọi `POST /api/access/code` với DB/Redis thật (luồng mã ↔ link dùng chung `consumed_at` chỉ được kiểm qua code review, chưa có spec có DB).
- Cài thật trên iPhone/Android, hộp thoại cài của Chrome Android, bấm link từ app Zalo, header nginx thật trên production.

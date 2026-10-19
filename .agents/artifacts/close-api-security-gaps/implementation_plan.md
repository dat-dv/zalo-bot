# Kế hoạch: Vá các lỗ hổng bảo mật API phát hiện khi audit tài liệu

- Route: `implement` · Phase 1 (inspect-and-plan) · Mức rủi ro: **HIGH** (auth, hợp đồng API công khai, khởi động runtime)
- Nguồn: `.agents/artifacts/sync-docs-with-code-2026-10/walkthrough.md` mục "Lỗi/khoảng trống code phát hiện", mục 1–3
- Nhánh: `claude/angry-thompson-bba713` (đã fast-forward lên `main` @ `cfe8047` để có docs mới)

## 1. Hiện trạng (đã kiểm chứng trong code)

| # | Vị trí | Vấn đề |
|---|---|---|
| 1 | `apps/api/src/zca/zca.controller.ts` | 12 route `/api/zca/*` không kiểm tra token hay quyền admin. `GET /zca/status` còn trả `qrStatus.code` (nội dung mã QR), nên ai cũng quét được và chiếm phiên ZCA khi admin đang đăng nhập. `POST /zca/logout`, `PUT listened-threads`, `PUT thread-configs/:id` và `POST threads/:id/sync-media` đều gọi được ẩn danh. |
| 2 | `apps/api/src/google/google-resources.controller.ts` | `POST drive/share`, `GET drive/folder-link`, `GET drive/open`, `GET photos/album-link`, `GET photos/open` không xác thực. `drive/share` chia sẻ thư mục của bất kỳ `channelId` cho email bất kỳ. `folder-link`/`open` gọi `ensureFolderPath`, nên còn **tạo thư mục Drive tùy ý** (với `threadName` do người gọi đặt). |
| 3 | `apps/api/src/health/{health,deploy}.controller.ts` | `GET\|POST /health/deploy`, `GET\|POST /deploy/notify` và `GET /deploy/ping` không có guard. Ai cũng có thể spam tin nhắn Zalo tới mọi admin với nội dung tự chọn (`message`, `deployedBy`...). |
| 4 | `apps/api/src/config/env.validator.ts`, `main.ts` | `validateEnvironment()` không được gọi ở đâu. Khi thiếu biến, `configuration.ts` dùng mặc định `CORS_ALLOW_ALL=true` và `DATA_ENCRYPTION_KEY` = 64 số `0`. |

Các bên gọi hiện có:

- Web (`apps/web/src/modules/zca/api/zca-api.ts`) gọi mọi route ZCA/drive JSON qua `httpClient`, vốn đã tự gắn `Authorization: Bearer` và tự refresh khi gặp 401 → **không cần sửa** các lời gọi này.
- Ba route **không gửi được header** vì trình duyệt mở trực tiếp:
  - `<img src="/api/zca/qr?t=…">` (`zca-screen.tsx:779`, đang hardcode route).
  - `<a href>` tới `/api/drive/open` và `/api/photos/open` (`chat-table-row.tsx`, `thread-config-modal.tsx`, `sync-media-modal.tsx`, `zca-screen.tsx:523`), dùng khi cấu hình chưa có URL đã lưu.
  - Bot gửi link `${APP_URL}/api/zca/qr` qua Zalo (`zalo-login-tool.strategy.ts`, URL dựng ở `zca.service.ts:737`). Người nhận mở link trên điện thoại, không có cookie dashboard.
- `drive/share` hiện không có caller trong web. Lệnh `@bot share <email>` gọi service trực tiếp, không qua HTTP.
- Deploy notify: không có caller trong repo. Đây là webhook bên ngoài (Coolify/CI) gọi bằng URL.
- Trang `/zca` ("Zalo & Users") đã dùng các API `users` vốn admin-only, nên thực chất đây là trang admin.

## 2. Thiết kế đề xuất

### 2.1. Helper chung: `requireDashboardAdmin`

Thêm vào `apps/api/src/dashboard-auth/dashboard-user.ts`:

```ts
export interface DashboardAdminChecker { isAdmin(userId: string | number): boolean }
export function requireDashboardAdmin(req: Request, tokens: ReportsTokenService, admins: DashboardAdminChecker): string | number
// thiếu/sai Bearer → 401, không phải admin → 403
export function getDashboardUserIdFromBrowser(req: Request, tokens: ReportsTokenService): string | number
// Bearer nếu có; nếu không thì cookie `reports_refresh` (verifyRefreshToken) → 401 nếu cả hai đều không hợp lệ
```

- Tham số là interface `DashboardAdminChecker`, không import `UsersService`, để tránh vòng phụ thuộc (`UsersModule` đang import `DashboardAuthModule`).
- Giữ cùng kiểu với `UsersController.admin()` hiện có: kiểm tra trong method, không dùng Nest Guard. Không refactor `UsersController` (ngoài phạm vi).

### 2.2. ZCA (`zca.controller.ts`, `zca.module.ts`, `zca.service.ts`)

- `ZcaModule` import thêm `DashboardAuthModule`. `ZcaController` inject `ReportsTokenService` và `UsersService` (dùng `forwardRef`, giống các module khác).
- Mọi route JSON (`status`, `login-qr`, `logout`, `threads`, `listened-threads` GET/PUT, `listened-threads/toggle`, `thread-configs` GET/PUT, `threads/:id/sync-media`) nhận `@Req()` và gọi `requireDashboardAdmin` trước khi chạy logic.
- **`GET /zca/qr`** (mở bằng `<img>` hoặc link Zalo) chấp nhận **một trong ba**:
  1. Bearer admin.
  2. Cookie `reports_refresh` hợp lệ của admin (cho thẻ `<img>` trên dashboard).
  3. Query `?key=<qrAccessKey>`: khóa ngẫu nhiên 32 byte (`randomBytes(32).toString('base64url')`), sinh mỗi lần tạo QR mới trong `ZcaService` và xoá khi đăng nhập xong, hết hạn, bị từ chối hoặc logout. So sánh bằng `timingSafeEqual`.

  `qrUrl` mà bot gửi qua Zalo và `qrUrl` trả về từ `POST /zca/login-qr` sẽ kèm `?key=…`.
- Web: `zca-screen.tsx` thay `/api/zca/qr` hardcode bằng `API_ROUTES.zcaQr` (dựa trên `resolveApiBaseUrl()`), giữ `?t=` để chống cache. Cookie lax được gửi khi web và API cùng site hoặc qua gateway (đúng như cấu hình hiện tại vì `src` đang là đường dẫn tương đối).

### 2.3. Google Drive/Photos (`google-resources.controller.ts`)

- Cả 5 route yêu cầu **admin**. Lý do: caller duy nhất là trang ZCA admin. Không có cơ chế kiểm tra thành viên nhóm theo `channelId`, nên mở cho user thường đồng nghĩa với việc ai đăng nhập cũng chia sẻ được thư mục của nhóm khác.
  - `POST drive/share`, `GET drive/folder-link`, `GET photos/album-link`: chỉ Bearer (`requireDashboardAdmin`).
  - `GET drive/open`, `GET photos/open`: Bearer **hoặc** cookie `reports_refresh` (`getDashboardUserIdFromBrowser`), sau đó kiểm tra `isAdmin`. Nhờ vậy các `<a href target="_blank">` hiện có vẫn chạy mà không phải viết lại UI.
- `UsersService` đã được inject (optional). Nếu không có `UsersService` → 403 (fail-closed).
- Route constant: thêm `photosOpen: '/api/photos/open'` vào `API_ROUTES` (`packages/contracts`) và thay chuỗi hardcode trong `getThreadPhotosOpenUrl` (đóng một phần mục vệ sinh #13).

### 2.4. Deploy notify (`health/`)

- Biến môi trường mới **`DEPLOY_NOTIFY_TOKEN`** (tùy chọn), đọc qua `configuration.ts` → `deploy.notifyToken`.
- `DeployNotifyGuard` (`CanActivate`, file `health/deploy-notify.guard.ts`) áp dụng cho các route deploy trong `HealthController` (chỉ `health/deploy`, **không** áp dụng `GET /health` vì docker healthcheck cần nó) và toàn bộ `DeployController`.
  - Nhận token theo thứ tự: header `X-Deploy-Token`, `Authorization: Bearer`, query `?token=` (Coolify/CI webhook thường chỉ cấu hình được URL).
  - So sánh bằng `timingSafeEqual` sau khi hash SHA-256 (để độ dài luôn bằng nhau).
  - Biến chưa đặt → **403 (tắt hẳn tính năng)**, fail-closed. Sai token → 401.
- Thêm `DEPLOY_NOTIFY_TOKEN=` vào `.env.example` kèm chú thích. Không đưa vào danh sách bắt buộc của `validateEnvironment`.

### 2.5. Environment guard (`main.ts`, `configuration.ts`)

- Trong `bootstrap()`, ngay sau `loadEnvironment()`: gọi `validateEnvironment()`. Nếu không hợp lệ thì `printEnvValidationBanner(errors)` rồi `process.exit(1)`, trước khi `NestFactory.create`.
- Phòng thủ nhiều lớp: đổi fallback `CORS_ALLOW_ALL` trong `configuration.ts` từ `true` → `false`. Giữ fallback `DATA_ENCRYPTION_KEY` (validator đã chặn khi app chạy; script/test vẫn cần một giá trị).
- Banner đang trỏ `docs/quick-setup-runbook.md`. Phase 2 sẽ kiểm tra file này có tồn tại không; nếu không thì trỏ sang `.agents/docs/global/environment-guard.md`.

## 3. Kiểm thử (node:test + tsx, theo các spec hiện có)

| File spec | Ca kiểm thử |
|---|---|
| `dashboard-auth/dashboard-user.spec.ts` (mới) | thiếu token → 401; token sai → 401; user thường → 403; admin → trả id; cookie refresh hợp lệ được nhận ở biến thể browser |
| `zca/zca.controller.spec.ts` | cập nhật constructor; `logout`/`syncThreadMedia` chạy với admin; 401 khi thiếu token; 403 khi không phải admin; `getQrImage` nhận `key` đúng, từ chối key sai hoặc thiếu |
| `zca/zca.service.spec.ts` | `qrAccessKey` được sinh khi tạo QR và xoá khi success/expired/logout (nếu tách logic được mà không cần mock zca-js nặng) |
| `google/google-resources.controller.spec.ts` | `shareDrive` 401/403/OK; `openDriveFolder` nhận cookie refresh của admin; các test hiện có được truyền request admin |
| `health/deploy-notify.guard.spec.ts` (mới) | env chưa đặt → 403; header/query/Bearer đúng → pass; sai → 401 |
| `config/env.validator.spec.ts` (mới) | env đầy đủ → hợp lệ; thiếu `DATA_ENCRYPTION_KEY` hoặc `CORS_ALLOW_ALL` → lỗi tương ứng |

Lệnh xác minh: `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api`, `npm run build --workspace @zalobot/web`, `node .claude/hooks/docs-drift-check.mjs`.

## 4. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (EN) và `.agents/docs/modules/zca/README.md` (VI): xoá "Known gap: ZcaController performs no dashboard-token or admin check"; mô tả quy tắc admin, ba cách xác thực của `/zca/qr`, `qrAccessKey`, `API_ROUTES.photosOpen`.
- `.agents/knowledge/global/backend-runtime-services.md` và `.agents/docs/global/backend-runtime-services.md`: deploy notify dùng `DEPLOY_NOTIFY_TOKEN`; 5 route Drive/Photos là admin-only (bỏ "Lưu ý bảo mật" cũ).
- `.agents/knowledge/global/environment-guard.md` và `.agents/docs/global/environment-guard.md`: `validateEnvironment()` chạy khi khởi động và fail-fast; fallback CORS = `false`; thêm `DEPLOY_NOTIFY_TOKEN`.
- `.agents/docs/README.md`: cập nhật index nếu cần. `CHANGELOG.md`: thêm mục security.
- Ghi `walkthrough.md` vào thư mục artifact này khi hoàn tất.

## 5. Ảnh hưởng vận hành và rủi ro (cần anh/chị xác nhận)

1. **Production có thể không khởi động được** nếu `.env` đang thiếu một trong: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`, `ZALO_BOT_TOKEN`, `APP_URL`, `WEB_ORIGIN`, `DATABASE_URL`, `CORS_ALLOW_ALL` (bắt buộc là `true` hoặc `false`), `DATA_ENCRYPTION_KEY` (64 ký tự hex), `DEFAULT_TIMEZONE`. Đây là chủ đích (fail-fast), nhưng cần rà `.env` production trước khi deploy.
2. **Webhook deploy sẽ ngừng hoạt động** cho tới khi đặt `DEPLOY_NOTIFY_TOKEN` và thêm `?token=…` (hoặc header) vào URL hook của Coolify/CI.
3. Người dùng dashboard **không phải admin** mở trang `/zca` sẽ nhận 403 cho trạng thái ZCA và danh sách thread. Hiện họ đã nhận 403 với danh sách users trên cùng trang, nên đây chỉ là làm cho nhất quán. Nav web chưa ẩn mục này với user thường; việc ẩn nằm ngoài phạm vi và có thể làm follow-up.
4. Cookie `reports_refresh` (`SameSite=Lax`) được dùng làm credential cho 3 route GET mở trực tiếp bằng trình duyệt. Lax có gửi cookie khi điều hướng top-level cross-site, nên `drive/open` và `photos/open` có thể bị một trang khác kích hoạt (tạo hoặc lấy thư mục của admin). Tác động thấp vì kết quả chỉ là redirect tới Drive/Photos, nơi quyền của Google vẫn áp dụng. Phương án chặt hơn là viết lại các link web thành nút gọi `folder-link` bằng Bearer rồi `window.open`, đổi lại nhiều thay đổi UI hơn và dễ bị chặn popup.

## 6. Ngoài phạm vi

Các mục chức năng/vệ sinh #4–#16 trong walkthrough (Quick Repay 404 đang được xử lý ở session khác), refactor `UsersController` dùng helper mới, và ẩn nav `/zca` với user thường.

---
**Chờ duyệt**: vui lòng xác nhận kế hoạch, đặc biệt là (a) chiến lược cookie cho `drive/open`/`photos/open`/`zca/qr` so với phương án viết lại link web, và (b) hành vi fail-closed của deploy notify khi chưa đặt `DEPLOY_NOTIFY_TOKEN`.

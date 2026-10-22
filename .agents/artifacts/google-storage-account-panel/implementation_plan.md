# Kế hoạch: Hiển thị & quản lý tài khoản Google lưu trữ (Drive/Photos) trong phần Hệ thống

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM-HIGH** (OAuth, xoá token, đổi hành vi chọn tài khoản lưu trữ)
- Skills: backend, backend-bridge-frontend, frontend-orchestration, tanstack-query, nextjs-static, enterprise-ui

## 1. Mục tiêu

Admin mở dashboard, ở nhóm **HỆ THỐNG** thấy ngay **tài khoản Google lưu trữ dùng chung** (Drive + Photos) đang dùng là ai, và có thể:

- **Đăng nhập** khi chưa có tài khoản.
- **Đổi tài khoản / cấp lại quyền** (khi thiếu quyền Drive/Photos).
- **Đăng xuất** (ngắt tài khoản lưu trữ).

Hiện tại việc này chỉ làm được qua lệnh Zalo `/login`, `/status`; dashboard chưa có API hay UI nào.

## 2. Hiện trạng (đã kiểm tra trong code)

| Điểm | Vị trí | Ghi chú |
| --- | --- | --- |
| Tài khoản dùng chung | `GoogleAuthService.sharedUserId` + cột `user_tokens.is_shared` | Chỉ một lần đăng nhập (`exchangeCodeForTokens`) mới đặt `shared: true` |
| Tạo link OAuth | `generateAuthUrl(userId)` — `state = userId` (không ký) | Dùng bởi `login-tool`, `login-google-tool` (đã chặn non-admin) |
| Callback | `GoogleAuthController.handleCallback` → trả HTML thành công + nhắn Zalo cho `state` | Với `dashboard-owner` thì nhắn Zalo sẽ lỗi (đang bị nuốt bằng warn) |
| Lấy email | `getSharedAccountEmail()` (cache theo client) | |
| Xoá token | `revokeUserTokens(userId)` — chỉ xoá DB + memory, **không** thu hồi phía Google | |
| **Fallback ngầm** | `getSharedOAuth2Client()` và `preloadTokensFromDatabase()` tự chọn *bất kỳ* token nào khi `sharedUserId` trống | Nếu đăng xuất chỉ xoá token, bot sẽ **lặng lẽ chuyển sang Google của admin khác** → trái nghĩa "đăng xuất" |
| UI hệ thống | Nav `nav.section.system` = `/zca` (Zalo & Người dùng) + `/settings` | `/zca` đã có khu đăng nhập/đăng xuất ZCA + 4 thẻ tổng quan |

## 3. Thiết kế đề xuất

### 3.1 Vị trí UI (đề xuất: trang `/zca`)

Thêm thẻ **"Tài khoản Google lưu trữ"** full-width ngay dưới 4 thẻ tổng quan trên trang **Zalo & Người dùng** — cạnh nơi đăng nhập/đăng xuất ZCA, vì cả hai đều là "tài khoản hệ thống" của bot. (Phương án khác: tab "Cấu hình" ở `/settings` — xem câu hỏi mở Q1.)

Trạng thái thẻ (đủ 4 UI state):

| State | Hiển thị | Hành động |
| --- | --- | --- |
| Loading | Skeleton 1 dòng | — |
| Error | Thông báo + "Thử lại" | refetch |
| Chưa cấu hình OAuth (`configured: false`) | "Server chưa cấu hình GOOGLE_CLIENT_ID/SECRET" | Không có nút |
| Chưa kết nối | Chấm đỏ + "Chưa kết nối — media chưa được lưu lên Drive/Photos" | **Đăng nhập Google** (primary) |
| Đã kết nối, thiếu quyền Drive/Photos | Email + badge cảnh báo "Thiếu quyền Drive/Photos" | **Cấp lại quyền** (primary), Đăng xuất |
| Đã kết nối đủ quyền | Chấm xanh + email + "Mở Drive" (link `driveRootData`) | **Đổi tài khoản**, **Đăng xuất** (rose, `window.confirm`) |

- Đăng nhập/Đổi tài khoản: gọi API lấy `authUrl` rồi `window.open(authUrl, '_blank', 'noopener')`. Trang callback hiện HTML thành công như cũ; khi admin quay lại tab dashboard, query tự refetch (`refetchOnWindowFocus: true`) → thẻ cập nhật email mới.
- Mobile: thẻ xếp dọc, nút cao 40px (`TAP_CONTROL`), không tràn ngang; giữ `rounded-[3px]` (không bo tròn thêm).
- Chuỗi giao diện mới đi qua catalog i18n `zca.googleAccount.*` (vi/en) trong `@zalobot/contracts`.

### 3.2 API (admin-only, `requireDashboardAdmin`)

Thêm vào `GoogleResourcesController` (đã có `tokens`, `usersService`, `authService`):

| Method | Route (`API_ROUTES`) | Response |
| --- | --- | --- |
| GET | `googleStorageAccount: '/api/google/storage-account'` | `IGoogleStorageAccountStatus` |
| POST | `googleStorageAccountLogin: '/api/google/storage-account/login'` | `{ authUrl: string }` — `generateAuthUrl(<dashboard admin id>)` |
| POST | `googleStorageAccountLogout: '/api/google/storage-account/logout'` | `IGoogleStorageAccountStatus` (sau khi ngắt) |

```ts
// packages/contracts
export interface IGoogleStorageAccountStatus {
  configured: boolean;        // có GOOGLE_CLIENT_ID/SECRET
  connected: boolean;         // isSharedAuthorized()
  email: string | null;       // getSharedAccountEmail()
  hasStorageScopes: boolean;  // drive + photoslibrary
}
```

Không trả `userId` chủ token ra web (không cần, tránh lộ ID).

### 3.3 Thay đổi `GoogleAuthService`

1. **`disconnectSharedAccount()`** (mới):
   - Lấy client dùng chung; best-effort `client.revokeCredentials()` phía Google (lỗi chỉ log warn, vẫn tiếp tục).
   - `revokeUserTokens(sharedUserId)` → xoá dòng `user_tokens`, xoá client trong memory, `sharedUserId = undefined`.
2. **Bỏ fallback ngầm**: `getSharedOAuth2Client()` chỉ trả client của `sharedUserId`; `preloadTokensFromDatabase()` chỉ đặt `sharedUserId` từ token có `is_shared = true`. Migration `1724830000000` đã đánh dấu sẵn một token `is_shared`, nên dữ liệu hiện có không bị ảnh hưởng. Sau khi đăng xuất, hệ thống **không có** tài khoản lưu trữ cho tới khi admin đăng nhập lại (qua dashboard hoặc `/login`).
   - `saveTokensForUser` hiện có nhánh `|| !this.sharedUserId` (token refresh/lưu đầu tiên tự thành shared) → bỏ luôn để khớp quy tắc "chỉ đăng nhập mới chọn tài khoản".
3. Callback: bỏ qua nhắn Zalo khi `state === DASHBOARD_OWNER_USER_ID` (không có ID Zalo).

> Hệ quả cần biết: token Google là một-token-một-người. Đăng xuất tài khoản lưu trữ cũng xoá kết nối Google cá nhân của admin sở hữu token đó (bản sao Google Calendar của admin đó sẽ dùng... không còn token riêng, quay về tài khoản dùng chung — mà lúc đó đang trống).

### 3.4 Web (`apps/web/src/modules/zca`)

- `api/zca-api.ts`: `getGoogleStorageAccount(signal)`, `startGoogleStorageLogin()`, `logoutGoogleStorageAccount()` — dùng `API_ROUTES`, `httpClient`, `IApiResponse<T>`.
- `api/zca-query.ts`: key `zcaQueryKeys.googleAccount()`; `useGoogleStorageAccountQuery` (`refetchOnWindowFocus: true`), `useStartGoogleStorageLoginMutation`, `useLogoutGoogleStorageAccountMutation` (onSuccess: `setQueryData` + invalidate `driveLink`).
- `presentation/components/google-storage-account-card.tsx` (mới, organism) + gắn vào `view/zca-screen.tsx` dưới grid thẻ tổng quan.

### 3.5 Tests

- `google-auth.service.spec.ts`: `disconnectSharedAccount` xoá token + clear shared, vẫn chạy khi Google revoke lỗi; không fallback sang token khác sau khi ngắt; preload chỉ nhận `is_shared`.
- `google-resources.controller.spec.ts`: 3 route mới chặn non-admin (403), trả đúng shape.
- Chạy: `npm run typecheck`, `npm run lint`, `npm run test` (scope api/web/contracts), `npm run build --workspace @zalobot/web`; kiểm tra UI trên browser pane (desktop + mobile 375px).

### 3.6 Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/channel-storage.md` (EN) mục *Shared storage account*: API mới, logout, bỏ fallback; `README.md` module nếu cần.
- `.agents/docs/modules/zca/channel-storage.md` (VI): giải thích nghiệp vụ đăng nhập/đăng xuất tài khoản lưu trữ trên dashboard.
- `CONTEXT.md` mục **Tài khoản lưu trữ dùng chung**: "admin đăng nhập gần nhất qua `/login` **hoặc dashboard**; đăng xuất thì hệ thống không còn tài khoản lưu trữ".
- `.agents/docs/README.md` nếu đổi mapping; chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 4. Ngoài phạm vi / rủi ro còn lại

- **OAuth `state` không ký** (đã có từ trước, ảnh hưởng cả luồng Zalo): ai có client ID đều có thể tự dựng link với `state` tuỳ ý và chiếm tài khoản lưu trữ. Đề xuất task riêng: ký HMAC + hạn dùng cho `state`. Task này giữ nguyên cách cũ để không lệch giữa 2 luồng.
- Không đụng tới token Google cá nhân của người dùng khác, không migration mới.

## 5. Câu hỏi mở (cần anh chốt)

- **Q1 – Vị trí**: đặt thẻ ở trang `/zca` (đề xuất) hay thành tab/mục trong `/settings`?
- **Q2 – Đăng xuất**: đồng ý bỏ fallback ngầm (đăng xuất = không còn tài khoản lưu trữ cho tới khi đăng nhập lại), thay vì tự chuyển sang Google của admin khác?
- **Q3 – Thu hồi phía Google**: có gọi `revokeCredentials()` để thu hồi quyền app trên tài khoản Google đó luôn không (đề xuất: có)?

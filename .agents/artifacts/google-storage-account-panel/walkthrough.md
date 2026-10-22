# Walkthrough: Thẻ tài khoản Google lưu trữ trên `/zca`

Plan đã được duyệt với Q1 = `/zca`, Q2 = bỏ fallback, Q3 = thu hồi quyền phía Google.

## Thay đổi

- **Contracts** (`packages/contracts/src/index.ts`): `API_ROUTES.googleStorageAccount|Login|Logout`, `IGoogleStorageAccountStatus`, `IGoogleStorageLoginResponse`, chuỗi `zca.googleAccount.*` (vi/en).
- **API**
  - `GoogleAuthService`: thêm `disconnectSharedAccount()` (thu hồi phía Google, lỗi chỉ log; rồi xoá token). Bỏ fallback ở `getSharedOAuth2Client()`, `preloadTokensFromDatabase()`, `saveTokensForUser()`.
  - `GoogleResourcesController`: 3 route chỉ dành cho admin.
  - `GoogleAuthController`: không nhắn Zalo khi `state = dashboard-owner`.
- **Web**: hàm API + hook query/mutation trong `modules/zca/api`; organism `GoogleStorageAccountCard`, gắn vào `ZcaScreen`.
- **Tài liệu**: `knowledge/modules/zca/channel-storage.md`, `docs/modules/zca/channel-storage.md`, `CONTEXT.md`.

## Khác với plan

- Bỏ field `configured` và trạng thái "chưa cấu hình OAuth": env guard đã bắt buộc `GOOGLE_CLIENT_ID/SECRET`, nên trạng thái này không bao giờ xảy ra.
- Đăng xuất dùng `ConfirmDialog` có sẵn (bottom sheet trên điện thoại) thay cho `window.confirm`.

## Kiểm tra

- `npm run typecheck`: pass (api, web, contracts).
- `npm run lint`: pass.
- `npm run test`: api 542/542, web 90/90.
- `npm run build --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- **Chưa kiểm tra trên trình duyệt**: preview server bị chặn (`EPERM uv_cwd`), còn API local ở cổng 3100 đang chạy code cũ. Cần khởi động lại API rồi thử đăng nhập/đăng xuất thật với Google.

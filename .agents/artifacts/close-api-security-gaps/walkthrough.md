# Walkthrough: Vá lỗ hổng bảo mật API

Kế hoạch: [implementation_plan.md](implementation_plan.md), đã được duyệt nguyên văn. Phần cookie dùng cho route mở bằng trình duyệt và hành vi fail-closed của deploy notify được giữ đúng như kế hoạch.

## Thay đổi

| Hạng mục | File | Nội dung |
|---|---|---|
| Helper | `apps/api/src/dashboard-auth/dashboard-user.ts` | `requireDashboardAdmin`, `getDashboardUserIdFromBrowser` (Bearer hoặc cookie `reports_refresh`), `assertDashboardAdmin`, interface `DashboardAdminChecker` (tránh import vòng với `UsersModule`) |
| ZCA | `zca.controller.ts`, `zca.module.ts` | Mọi route kiểm tra admin. `GET /zca/qr` chấp nhận `?key=`, Bearer hoặc cookie admin |
| ZCA | `zca.service.ts` | `qrAccessKey` ngẫu nhiên theo từng luồng QR; `getQrImageUrl()`, `isQrAccessKeyValid()`; thu hồi khi luồng kết thúc hoặc logout; log không in khóa |
| Drive/Photos | `google-resources.controller.ts` | 5 route chỉ cho admin. `drive/open` và `photos/open` nhận thêm cookie; tách `resolveDriveFolderLink` / `resolvePhotosAlbumLink` |
| Deploy | `health/deploy-notify.guard.ts` (mới), `health.controller.ts`, `deploy.controller.ts`, `health.module.ts` | `DeployNotifyGuard` với `DEPLOY_NOTIFY_TOKEN` (header, Bearer hoặc `?token=`); chưa đặt token → 403; `GET /health` vẫn công khai |
| Env | `main.ts`, `configuration.ts`, `.env.example` | `validateEnvironment()` chạy lúc khởi động, lỗi thì thoát với mã 1; fallback `CORS_ALLOW_ALL` → `false`; thêm `deploy.notifyToken` / `DEPLOY_NOTIFY_TOKEN` |
| Web/contracts | `zca-api.ts`, `zca-screen.tsx`, `packages/contracts` | `API_ROUTES.photosOpen`; `getZcaQrImageUrl()` thay cho `/api/zca/qr` hardcode |
| Docs | knowledge + docs: `modules/zca`, `global/backend-runtime-services`, `global/environment-guard` | Xoá ghi chú "known gap"; mô tả quy tắc admin, khóa QR, token deploy, fail-fast env |

## Xác minh đã chạy

- `npm run typecheck` (api, web, contracts): đạt, sau khi build lại `@zalobot/contracts`.
- `npm run test --workspace @zalobot/api`: 336/336 đạt. Test mới: 401/403/admin cho ZCA; khóa QR và cookie cho `/zca/qr`; vòng đời khóa QR trong `ZcaService`; 401/403/cookie cho Drive/Photos; `DeployNotifyGuard`; `validateEnvironment`.
- `npm run build --workspace @zalobot/web`: đạt.
- ESLint trên các file đã sửa: chỉ còn 2 lỗi `require-await` có sẵn từ trước (mock cũ trong `zca.controller.spec.ts` và `zca.service.spec.ts`). `npm run lint` toàn repo vốn đã lỗi ở nhiều file khác, không liên quan.
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.

## Chưa xác minh

- Chưa chạy app thật: chưa thử ảnh QR qua cookie trên trình duyệt, link `/zalo-login` trên điện thoại, và link Drive/Photos qua gateway.
- Chưa xác minh cookie `reports_refresh` có được gửi khi web và API khác site (`SameSite=Lax` chỉ gửi khi điều hướng top-level hoặc khi cùng site). Với `<img>` QR khác site, ảnh sẽ báo 401.

## Việc vận hành cần làm trước khi deploy

1. Rà `.env` production đủ các biến bắt buộc (xem `.agents/docs/global/environment-guard.md`). Nếu thiếu, API sẽ không khởi động.
2. Đặt `DEPLOY_NOTIFY_TOKEN` và thêm `?token=…` vào URL hook deploy của Coolify/CI.

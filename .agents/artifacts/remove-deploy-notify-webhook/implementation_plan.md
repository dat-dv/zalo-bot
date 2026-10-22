# Kế hoạch: Bỏ webhook báo deploy thành công

- Route: implement · Phase 1 (Planning) · Rủi ro: **MEDIUM** (xoá endpoint public, bỏ biến env, đụng nhiều tài liệu)
- Trạng thái: chờ anh duyệt + chốt 1 câu hỏi ở mục 4

## 1. Hiện trạng (đã kiểm tra trên `main` = `b3e376d`)

Cơ chế này không nằm trong module `zalo/` cũ mà ở `apps/api/src/health/`. Có **2 đường** cùng gọi `DeployNotifyService.notifyDeploy()` để nhắn tin "deploy thành công" cho mọi admin qua ZCA:

| Đường | Ở đâu | Bật/tắt bằng |
| --- | --- | --- |
| **A. Webhook** (bên ngoài gọi vào) | `GET/POST /health/deploy` (`health.controller.ts`), `GET/POST /deploy/notify`, `GET /deploy/ping` (`deploy.controller.ts`); chặn bằng `DeployNotifyGuard` | `DEPLOY_NOTIFY_TOKEN` (trống → 403) |
| **B. Tự báo khi API khởi động** | `DeployNotifyService.onApplicationBootstrap()` → `triggerStartupNotify()` (chờ 1,5 s rồi nhắn) | `NOTIFY_ON_STARTUP` (mặc định bật ở production, tắt ở development) |

Liên quan khác:
- `main.ts`: global prefix loại trừ `health/deploy`, `deploy`, `deploy/notify`, `deploy/ping`.
- Contracts: `API_ROUTES.healthDeploy`, `API_ROUTES.deployNotify` (không chỗ nào dùng), `IDeployNotifyRequest`, `IDeployNotifyResponse`.
- Config `deploy.notifyToken`; `.env.example` có `DEPLOY_NOTIFY_TOKEN=`.
- `GET /health` (healthcheck của Coolify) **giữ nguyên**.
- Tài liệu: `.agents/knowledge|docs/global/` `backend-runtime-services`, `environment-guard`, `monorepo-architecture`, `README`, và `knowledge/global/route-constants.md`.

## 2. Thay đổi (phương án đề xuất: bỏ đường A, giữ đường B)

1. **Xoá** `deploy.controller.ts`, `deploy-notify.guard.ts` + `deploy-notify.guard.spec.ts`.
2. `health.controller.ts`: bỏ 2 route `deploy`, chỉ còn `GET /health`; bỏ inject `DeployNotifyService`.
3. `health.module.ts`: bỏ `DeployController`, `DeployNotifyGuard`.
4. `DeployNotifyService`: giữ phần tự báo khi khởi động. `notifyDeploy` không còn nhận dữ liệu từ ngoài → đổi tham số sang kiểu nội bộ (bỏ `DeployNotifyDto`, xoá `dto/deploy-notify.dto.ts`). Cập nhật `deploy-notify.service.spec.ts` cho khớp.
5. Contracts: xoá `API_ROUTES.healthDeploy`, `API_ROUTES.deployNotify`, `IDeployNotifyRequest`; giữ `IDeployNotifyResponse` nếu service còn trả về (hoặc chuyển thành kiểu nội bộ của API).
6. `main.ts`: global prefix chỉ còn loại trừ `health`.
7. Config/env: bỏ `deploy.notifyToken` và `DEPLOY_NOTIFY_TOKEN` khỏi `configuration.ts`, `.env.example`.
8. Tài liệu (EN + VI): sửa các file ở mục 1; ghi rõ báo deploy giờ chỉ còn tự gửi khi API khởi động.

## 3. Cách làm & kiểm chứng

- Checkout chính đang ở nhánh `feat/task-reminders` của phiên khác → làm trong worktree riêng của em (`.claude/worktrees/remove-zalo-official-bot`), nhánh mới tách từ `origin/main`, xong commit rồi fast-forward `main`.
- Chạy: `npm run typecheck`, `lint`, `test` (api/web/contracts), `npm run build --workspace @zalobot/api`, `node .claude/hooks/docs-drift-check.mjs --all`.
- Grep: không còn `deploy/notify`, `health/deploy`, `DEPLOY_NOTIFY_TOKEN`, `DeployNotifyGuard`, `healthDeploy`, `deployNotify`.
- Sau deploy: `GET /health` vẫn 200; `GET /health/deploy` và `/api/deploy/notify` trả 404.
- **Cần anh làm thêm:** nếu Coolify (hoặc chỗ nào khác) đang cấu hình gọi URL `/health/deploy` hay `/deploy/notify` sau khi deploy, gỡ cấu hình đó; xoá biến `DEPLOY_NOTIFY_TOKEN` trên Coolify.

## 4. Cần anh chốt

**Có bỏ luôn đường B (tự nhắn "deploy thành công" mỗi lần API khởi động) không?**
- (Đề xuất) **Giữ B**: anh chỉ nói bỏ callback qua webhook; B không cần URL hay token, vẫn báo sau mỗi lần Coolify deploy (vì container khởi động lại).
- **Bỏ cả B**: xoá hẳn `DeployNotifyService`, `NOTIFY_ON_STARTUP`, `IDeployNotifyResponse` và đọc CHANGELOG/git info — bot không còn nhắn gì khi deploy.

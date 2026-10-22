# Walkthrough: Bỏ thông báo deploy

- Plan: [implementation_plan.md](implementation_plan.md). Anh duyệt phương án bỏ **cả hai**: webhook báo deploy và phần tự báo khi API khởi động.
- Làm trong worktree `.claude/worktrees/remove-zalo-official-bot`, nhánh `chore/remove-deploy-notify` tách từ `origin/main` (`b3e376d`), vì checkout chính đang ở nhánh của phiên khác.

## Đã làm
- Xoá `health/deploy.controller.ts`, `deploy-notify.guard.ts` (+ spec), `deploy-notify.service.ts` (+ spec), `health/dto/`.
- `health.controller.ts` chỉ còn `GET /health`; `health.module.ts` không còn import `UsersModule`/`ZcaModule`.
- `main.ts`: global prefix chỉ loại trừ `health`.
- Contracts: bỏ `API_ROUTES.healthDeploy`, `API_ROUTES.deployNotify`, `IDeployNotifyRequest`, `IDeployNotifyResponse` (không chỗ nào khác dùng).
- Config/env: bỏ `deploy.notifyToken` (`DEPLOY_NOTIFY_TOKEN`) khỏi `configuration.ts` và `.env.example`. `NOTIFY_ON_STARTUP`, `APP_VERSION`, các biến commit/branch không còn được đọc.
- **Ngoài plan, cùng mục đích:** `apps/api/Dockerfile` bỏ dòng `COPY CHANGELOG.md* ./` ở runner — chỉ thông báo deploy đọc file này lúc chạy. Vẫn giữ copy các `package.json` của workspace.
- Tài liệu EN + VI: `global/backend-runtime-services`, `environment-guard`, `monorepo-architecture`, `README`, `knowledge/global/route-constants`.

## Kiểm chứng
Xem kết quả trong tin nhắn cuối của phiên; các lệnh: typecheck/lint/test api, web, contracts; build api; `docs-drift-check --all`; grep không còn `deploy/notify`, `health/deploy`, `DEPLOY_NOTIFY_TOKEN`, `NOTIFY_ON_STARTUP`, `DeployNotify`.

## Anh cần làm thêm
- Gỡ cấu hình Coolify/CI đang gọi `/health/deploy` hoặc `/deploy/notify` (nếu có) — giờ trả 404.
- Xoá biến `DEPLOY_NOTIFY_TOKEN`, `NOTIFY_ON_STARTUP` trên Coolify (không còn tác dụng).

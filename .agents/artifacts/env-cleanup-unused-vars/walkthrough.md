# Walkthrough: Dọn biến môi trường không còn dùng

- Kế hoạch: [implementation_plan.md](implementation_plan.md) — anh đã duyệt: làm A + B, tắt `CORS_ALLOW_ALL` và `ZCA_SELF_LISTEN` ở production.
- Nhánh: `chore/env-cleanup` (worktree `.claude/worktrees/env-cleanup`, tách từ `main` = `4efa996`). Chưa commit.

## A. File env local (gitignored, sửa trực tiếp ở checkout chính)

Đã sao lưu bản cũ vào scratchpad của phiên trước khi sửa. Chỉ xoá theo tên biến, không đổi giá trị nào khác.

| File | Đã xoá |
| --- | --- |
| `.env` | `ZALO_BOT_TOKEN`, `NODE_ENV`, `ROUTER_API_KEY` (trống) |
| `.env.production` | `ZALO_BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `CORS_ALLOW_ALL`, `ZCA_SELF_LISTEN` |

Dọn thêm comment lơ lửng: đổi tiêu đề "Cấu hình Zalo Bot & Webhook" → "Tên bot"; bỏ mục ZCA rỗng và đánh lại số mục trong `.env.production`; ghi chú `DATABASE_URL`/`REDIS_URL` do compose cố định.

Kiểm chứng: chạy `validateEnvironment()` với từng file trong môi trường sạch (`env -i`) → `.env` VALID; `.env.production` VALID (giả lập `DATABASE_URL` do compose cấp).

## B. Xoá script `npm run auth` (trên nhánh)

- Xoá `apps/api/scripts/auth.ts` và script `"auth"` trong `apps/api/package.json`.
- Bỏ `gcp-oauth.keys.json`, `.gcp-saved-tokens.json` khỏi `.gitignore`, `.dockerignore`, `.prettierignore`, deny-list của `.claude/settings.json` (đã kiểm tra: máy không còn 2 file này).
- Giữ dependency `googleapis`, `google-auth-library` (vẫn dùng trong `src/google`, `src/calendar`).
- Tài liệu: `docs/deployment.md` bỏ nhắc `npm run auth`; `environment-guard.md` (EN + VI) ghi 2 biến đã bỏ và quy ước env production để trống `CORS_ALLOW_ALL`, `ZCA_SELF_LISTEN`, không đặt `DATABASE_URL`/`REDIS_URL`.

## C. `.env.example` (bổ sung theo yêu cầu sau, rủi ro LOW)

Chỉ còn một file mẫu ở root (mẫu riêng trong `apps/*` đã xoá từ trước).

- `ZCA_SELF_LISTEN=false` (trùng mặc định) → comment `# ZCA_SELF_LISTEN=true`, ghi rõ chỉ dùng khi dev.
- Thêm comment `# CORS_ALLOW_ALL=true` (công tắc dev, production để trống).
- `LLM_FALLBACK_PROVIDERS=` (trống = mặc định) → comment kèm ví dụ `gemini`.
- Giữ `NGINX_PORT`, `BE_PORT`, `DEFAULT_TIMEZONE` (compose nội suy), `LLM_PROVIDER`, `DASHBOARD_LOGIN_CODE` (quyết định triển khai).
- Kiểm tra: mọi khoá trong file mẫu đều có code đọc (`git grep -w`); `environment-guard.md` (EN + VI) ghi thêm quy ước biến tuỳ chọn để dạng comment.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/api` — pass
- `npm run lint --workspace @zalobot/api` — pass
- `npm run test --workspace @zalobot/api` — 577/577 pass
- `node .claude/hooks/docs-drift-check.mjs --all` — PASS (0 errors)
- Grep không còn `GOOGLE_OAUTH_CREDENTIALS`, `GOOGLE_CALENDAR_MCP_TOKEN_PATH`, `scripts/auth`, `npm run auth` ngoài tài liệu environment-guard.

## Còn lại cho anh

- **Coolify**: xoá `ZALO_BOT_TOKEN`, `DEPLOY_NOTIFY_TOKEN`; xoá `CORS_ALLOW_ALL`, `ZCA_SELF_LISTEN` (hoặc đặt `false`); xoá `DATABASE_URL`/`REDIS_URL` nếu có. Env trên Coolify mới là thứ production dùng thật — sửa `.env.production` local không tự đẩy lên.
- Commit nhánh `chore/env-cleanup` và merge vào `main`.

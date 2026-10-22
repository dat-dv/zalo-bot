# Kế hoạch: Dọn biến môi trường không còn dùng

- Route: implement · Phase 1 (Planning) · Rủi ro: **LOW–MEDIUM** (chủ yếu sửa file env gitignored; mục B xoá 1 script)
- Trạng thái: chờ anh duyệt + trả lời 3 câu hỏi ở mục 4
- Chuẩn so sánh: code trên `main` (`b2bc47e`), vì nhánh hiện tại `feat/task-reminders` đang **đứng sau main** (thiếu `a57e432 chore(api): remove deploy notifications` và vài commit khác).

## 1. Kết quả rà soát

Em lấy toàn bộ tên biến code đang đọc (`configuration.ts`, `env.validator.ts`, `process.env.*` trong `apps/api`, `apps/web`, `packages/contracts`, compose, Dockerfile) rồi so với 3 file env. Chỉ so **tên biến** và giá trị có bằng mặc định hay không — không in giá trị bí mật.

### 1.1. Biến chết (code không còn đọc)

| Biến | Nằm ở | Lý do |
| --- | --- | --- |
| `ZALO_BOT_TOKEN` | `.env`, `.env.production` | Kênh Zalo Bot chính thức (webhook) đã gỡ; code không đọc nữa. |
| `DEPLOY_NOTIFY_TOKEN` | `.env.example` (chỉ trên nhánh này) | Webhook báo deploy đã xoá ở `a57e432`. Trên `main` `.env.example` đã bỏ dòng này rồi. |
| `DATABASE_URL`, `REDIS_URL` | `.env.production` | Trỏ `127.0.0.1`, nhưng `docker-compose.yml` hardcode `postgres:5432` / `redis:6379` trong `environment:` (đè `env_file`) → giá trị trong file không bao giờ có tác dụng. |
| `NODE_ENV=development` | `.env` | Code chỉ kiểm tra `=== 'production'`, nên `development` = để trống. Next/Nest tự set khi chạy. |
| `ROUTER_API_KEY=` (trống) | `.env` | Tuỳ chọn, trống = không khai báo. |

### 1.2. Bằng mặc định nhưng **giữ lại** (đúng chính sách Env File Policy)

`BE_PORT`, `DEFAULT_TIMEZONE`, `NGINX_PORT`: compose nội suy `${...}` nên Coolify luôn hiện các biến này — tài liệu `environment-guard.md` đã quy định giữ.

### 1.3. Còn dùng nhưng giá trị đáng xem lại ở production

| Biến | Giá trị trong `.env.production` | Ghi chú |
| --- | --- | --- |
| `CORS_ALLOW_ALL` | `true` | Mở CORS cho mọi origin ở production. Web và API cùng domain nên không cần. |
| `ZCA_SELF_LISTEN` | `true` | `.env.example` ghi "bật khi test bằng chính nick Zalo của bot" → thường chỉ dùng khi dev. |

Đây là thay đổi hành vi, không phải biến chết → em **không tự đổi**, chờ anh chốt (câu hỏi 1).

### 1.4. Script cũ còn đọc env riêng

`apps/api/scripts/auth.ts` (`npm run auth --workspace @zalobot/api`) đọc `GOOGLE_OAUTH_CREDENTIALS`, `GOOGLE_CALENDAR_MCP_TOKEN_PATH`, xin scope Calendar + **Tasks** và ghi token ra `.gcp-saved-tokens.json`. Không code nào đọc file token đó; đăng nhập Google giờ đi qua OAuth trên web, Task không còn đồng bộ Google Tasks, và `docs/deployment.md` đã ghi "không cần chạy `npm run auth`". → script là di sản, có thể xoá (câu hỏi 2).

## 2. Thay đổi đề xuất

### A. File env local (gitignored — không commit, chỉ sửa trên máy anh)

1. `.env`: xoá `ZALO_BOT_TOKEN`, `NODE_ENV`, `ROUTER_API_KEY` (trống).
2. `.env.production`: xoá `ZALO_BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`. (+ `CORS_ALLOW_ALL` / `ZCA_SELF_LISTEN` nếu anh đồng ý ở câu hỏi 1.)
3. Không đổi giá trị nào khác, không in giá trị ra log/chat.

### B. (Tuỳ chọn) Xoá script `npm run auth` — commit trên nhánh tách từ `main`

1. Xoá `apps/api/scripts/auth.ts`, dòng `"auth"` trong `apps/api/package.json`.
2. Bỏ các dòng `gcp-oauth.keys.json` / `.gcp-saved-tokens.json` trong `.gitignore`, `.dockerignore`, `.prettierignore`, `.claude/settings.json` (deny Read).
3. Sửa `docs/deployment.md` (bỏ câu nhắc `npm run auth`); grep `.agents/knowledge|docs` để bỏ mọi chỗ còn nhắc script.
4. Ghi 2 biến `GOOGLE_OAUTH_CREDENTIALS`, `GOOGLE_CALENDAR_MCP_TOKEN_PATH` vào danh sách "removed" trong `environment-guard.md` (EN + VI).

### C. `.env.example`

Không cần sửa: bản trên `main` đã sạch. Nhánh này chỉ cần cập nhật từ `main` (câu hỏi 3).

## 3. Kiểm chứng

- Sau A: chạy `validateEnvironment()` với `.env` mới (script node nhỏ, chỉ in tên biến lỗi) → phải hợp lệ; diff tên biến trước/sau để chắc chỉ mất đúng các biến trên.
- Sau B: `npm run typecheck`, `npm run lint`, `npm run test` (workspace `@zalobot/api`), `node .claude/hooks/docs-drift-check.mjs --all`; grep không còn `GOOGLE_OAUTH_CREDENTIALS`, `GOOGLE_CALENDAR_MCP_TOKEN_PATH`, `scripts/auth`.
- **Anh tự làm trên Coolify** (em không truy cập được): xoá `ZALO_BOT_TOKEN`, `DEPLOY_NOTIFY_TOKEN`; xoá `DATABASE_URL`/`REDIS_URL` nếu có (compose đã hardcode).

## 4. Câu hỏi cần anh chốt

1. `CORS_ALLOW_ALL=true` và `ZCA_SELF_LISTEN=true` trong `.env.production`: tắt (xoá dòng, về mặc định `false`) hay giữ?
2. Làm luôn mục B (xoá script `npm run auth`) không?
3. Nhánh `feat/task-reminders` đang sau `main` và có thay đổi chưa commit ở `zca` gần giống `21cfc0b` trên main. Mục B em làm trong worktree riêng tách từ `main` (không đụng checkout này) — anh đồng ý không?

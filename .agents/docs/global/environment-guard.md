---
metadata:
  agent-artifact:
    id: docs-global-environment-guard
    type: documentation
    depends_on:
      - .agents/knowledge/global/environment-guard.md
      - apps/api/src/config/env.validator.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/main.ts
      - apps/web/next.config.ts
      - .env.example
---

# Biến môi trường và cấu hình bắt buộc

Tài liệu này ánh xạ với tri thức canonical [Environment Guard](../../knowledge/global/environment-guard.md). Mục tiêu: cấu hình là hợp đồng triển khai rõ ràng, không đoán giá trị, không để lộ secret trong log hay lỗi.

## Thứ tự nạp biến môi trường (API)

1. `main.ts` gọi `loadEnvironment()`: nạp `.env.local` ở root monorepo, rồi `.env` ở root, đều với `override: false`. Kết quả: biến môi trường do hệ thống/Docker truyền vào thắng, sau đó đến `.env.local`, cuối cùng `.env`.
2. `ConfigModule` của NestJS đọc thêm theo thứ tự `apps/api/.env.local`, `apps/api/.env`, `.env.local` root, `.env` root rồi dựng object cấu hình từ `config/configuration.ts`.
3. Dù chạy từ `apps/api` hay từ root (Docker), "root" luôn trỏ về thư mục monorepo.

## Biến bắt buộc

Danh sách bắt buộc nằm trong `apps/api/src/config/env.validator.ts`:

- Không được trống: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`, `ZALO_BOT_TOKEN` (hoặc tên cũ `BOT_TOKEN`).
- `BE_PORT` (hoặc `PORT`) là số nguyên dương; `NGINX_PORT`/`GATEWAY_PORT` nếu khai báo cũng phải là số nguyên dương.
- `APP_URL`, `WEB_ORIGIN` là URL HTTP(S) đầy đủ; `DATABASE_URL` là URL `postgresql://...`.
- `CORS_ALLOW_ALL` chỉ nhận `true`/`false`; `DATA_ENCRYPTION_KEY` đúng 64 ký tự hex (tạo bằng `openssl rand -hex 32`); `DEFAULT_TIMEZONE` là IANA timezone, ví dụ `Asia/Ho_Chi_Minh`.

**Kiểm tra lúc khởi động (fail-fast)**: `main.ts` gọi `validateEnvironment()` ngay sau `loadEnvironment()`, trước khi tạo app NestJS. Nếu có biến sai hoặc thiếu, API in khung báo lỗi (tên biến, lý do, cách lấy; không in giá trị) rồi thoát với mã `1`.

**Vì sao?** Trước đây hàm này không được gọi, nên khi thiếu biến, API vẫn chạy với mặc định nguy hiểm: `CORS_ALLOW_ALL=true` cho phép mọi origin, còn `DATA_ENCRYPTION_KEY` toàn số `0` khiến token Google được "mã hóa" bằng khóa ai cũng đoán được. Thêm một lớp phòng thủ: mặc định của `CORS_ALLOW_ALL` trong `configuration.ts` nay là `false`.

**Khi deploy**: nếu container khởi động lại liên tục, hãy xem log. Khung "THIẾU CẤU HÌNH BIẾN MÔI TRƯỜNG" liệt kê chính xác biến cần bổ sung vào `.env` hoặc `.env.production`.

## Biến tùy chọn

- **Database/cache**: `DATABASE_SSL`, `TYPEORM_SYNCHRONIZE`, `REDIS_URL`.
- **Thông báo deploy**: `DEPLOY_NOTIFY_TOKEN`, bí mật cho webhook `/health/deploy`, `/deploy/*`. Để trống thì các route này trả 403 (xem [Dịch vụ nền của Backend](backend-runtime-services.md)).
- **Zalo Bot**: `BOT_NAME`, `ZALO_WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN`.
- **ZCA (Zalo cá nhân)**: `DATA_DIR`, `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN`, `ZCA_CHECK_UPDATE`, `ZCA_LOGGING`, `ZCA_AUTO_LOGIN`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`.
- **LLM**: `LLM_PROVIDER` chọn nhà cung cấp đầu chuỗi cho `LlmService` (`gemini` mặc định, `openai`, `qwen`/`ollama`, `router`/`9router`); `LLM_FALLBACK_PROVIDERS` là danh sách provider dự phòng, phân cách bằng dấu phẩy (vd `gemini`); `LLM_TIMEOUT_MS` (mặc định `30000`); provider `router` dùng `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY`; kèm `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_API_KEY` (chấp nhận tên thay thế `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_API_KEY`).
- **Trí nhớ hội thoại**: `CHAT_MEMORY_ENABLED` (mặc định `false`), `CHAT_MEMORY_CONTEXT_WINDOW` (`10`), `CHAT_MEMORY_SEARCH_LIMIT` (`15`); câu trả lời trí nhớ dùng chung chuỗi `LLM_PROVIDER`. Xem [Trí nhớ hội thoại](../modules/zca/chat-memory.md).
- **Thông báo deploy**: `NOTIFY_ON_STARTUP` (đặt `false` để tắt; ở `NODE_ENV=development` phải đặt `true` mới gửi), `APP_VERSION`, các biến commit/branch do Coolify/CI cung cấp.
- **Chỉ dùng cho Docker Compose**: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `REDIS_PORT`, `WEB_PORT`, `NGINX_PORT`, `FE_PORT`.

## Biến của web dashboard

Chỉ biến `NEXT_PUBLIC_*` được đóng gói vào trình duyệt; mọi secret ở trên chỉ dành cho `apps/api`.

- `NEXT_PUBLIC_API_URL`: origin public của API, **không** thêm `/api` vì hằng số route đã có sẵn. Có thể bỏ trống: khi đó (hoặc khi trang chạy trên localhost/tunnel) web gọi API bằng đường dẫn tương đối qua cùng domain.
- `NEXT_PUBLIC_ZALO_BOT_URL` hoặc `NEXT_PUBLIC_ZALO_BOT_USERNAME`: link nút "Mở Zalo Bot" (mặc định `https://zalo.me`).
- `NEXT_PUBLIC_APP_URL`: domain dùng cho metadata/sitemap.

## Cách cấu hình

1. Sao chép `.env.example` thành `.env.local` ở root monorepo.
2. Điền toàn bộ biến bắt buộc; không để placeholder `replace-...` trong môi trường triển khai.
3. Bổ sung thủ công các biến chưa có trong `.env.example` nếu cần: `ZCA_LANGUAGE`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ZALO_BOT_URL`/`NEXT_PUBLIC_ZALO_BOT_USERNAME`.
4. Bỏ qua `ZALO_ALLOWED_USER_IDS` trong `apps/api/.env.example`: không có code nào đọc biến này. Quyền dùng bot do admin cấp qua trường `grantAccess` của user.

## Docker local

Chạy `npm run docker:local` (tương đương `docker compose -f docker-compose.local.yml up -d`) để bật PostgreSQL, Redis và Nginx gateway; API và web chạy trên máy bằng `npm run dev`. Gateway (`NGINX_PORT`/`GATEWAY_PORT`, mặc định 3000) chuyển `/api`, `/webhook`, `/zalo/`, `/oauth2callback` về API chạy trên máy host (`BE_PORT`) và phần còn lại về Next dev server (`FE_PORT`).

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
      - docker-compose.yml
      - scripts/tunnel.sh
---

# Biến môi trường và cấu hình bắt buộc

Tài liệu này ánh xạ với tri thức canonical [Environment Guard](../../knowledge/global/environment-guard.md). Mục tiêu: cấu hình là hợp đồng triển khai rõ ràng, không đoán giá trị, không để lộ secret trong log hay lỗi.

## Thứ tự nạp biến môi trường (API)

1. `main.ts` gọi `loadEnvironment()`: nạp `.env.local` ở root monorepo, rồi `.env` ở root, đều với `override: false`. Kết quả: biến môi trường do hệ thống/Docker truyền vào thắng, sau đó đến `.env.local`, cuối cùng `.env`.
2. `ConfigModule` của NestJS đọc thêm theo thứ tự `apps/api/.env.local`, `apps/api/.env`, `.env.local` root, `.env` root rồi dựng object cấu hình từ `config/configuration.ts`.
3. Dù chạy từ `apps/api` hay từ root (Docker), "root" luôn trỏ về thư mục monorepo.

## Biến bắt buộc

Danh sách bắt buộc nằm trong `apps/api/src/config/env.validator.ts`:

- Không được trống: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`. (`ZALO_BOT_TOKEN` không còn cần vì Zalo Bot chính thức đã bị bỏ, bot chỉ chạy qua ZCA.)
- `APP_URL` là URL HTTP(S) đầy đủ; `DATABASE_URL` là URL `postgresql://...`; `DATA_ENCRYPTION_KEY` đúng 64 ký tự hex (tạo bằng `openssl rand -hex 32`).
- Chỉ kiểm tra khi có khai báo (bỏ trống thì dùng mặc định): `BE_PORT`, `NGINX_PORT` là số nguyên dương; `WEB_ORIGIN` là URL HTTP(S); `CORS_ALLOW_ALL` là `true`/`false`; `DEFAULT_TIMEZONE` là IANA timezone; `DASHBOARD_LOGIN_CODE` phải gồm 8 ký tự trong bảng chữ của mã đăng nhập (xem [Phiên dashboard](dashboard-session.md)).

**Kiểm tra lúc khởi động (fail-fast)**: `main.ts` gọi `validateEnvironment()` ngay sau `loadEnvironment()`, trước khi tạo app NestJS. Nếu có biến sai hoặc thiếu, API in khung báo lỗi (tên biến, lý do, cách lấy; không in giá trị) rồi thoát với mã `1`.

**Vì sao?** Trước đây hàm này không được gọi, nên khi thiếu biến, API vẫn chạy với mặc định nguy hiểm: `DATA_ENCRYPTION_KEY` toàn số `0` khiến token Google được "mã hóa" bằng khóa ai cũng đoán được. Các biến còn lại có mặc định an toàn (`CORS_ALLOW_ALL` mặc định `false`), nên không bắt khai báo nữa.

## Nguyên tắc giữ file env gọn

File env chỉ chứa biến mà **giá trị là quyết định của người triển khai**: secret, domain, cổng hoặc công tắc khác mặc định. Biến trùng mặc định trong code, hoặc suy ra được từ biến khác (ví dụ `WEB_ORIGIN` suy từ `APP_URL`), không đưa vào env; khi cần đổi thì mới thêm dòng đó. **Coolify và `docker-compose.yml`**: biến nào được compose tham chiếu dạng `${TÊN:-mặc định}` thì Coolify tự tạo env cho nó và báo lỗi "Please remove it from the Docker Compose file first" khi xoá. Vì vậy compose chỉ tham chiếu những biến thật sự cần chọn: `POSTGRES_PASSWORD`, `BE_PORT`, `DEFAULT_TIMEZONE`, `NGINX_PORT`, `POSTGRES_PORT`, `REDIS_PORT`; `BE_PORT` và `DEFAULT_TIMEZONE` vẫn giữ trong env với giá trị mặc định cho khớp Coolify. Các giá trị cố định của stack được ghi cứng trong compose: `POSTGRES_DB`/`POSTGRES_USER` là `zalobot` (đổi sau khi đã có volume dữ liệu thì API không kết nối được), `DATABASE_SSL` và `TYPEORM_SYNCHRONIZE` là `false` (prod chỉ đổi schema bằng migration), `DATA_DIR` là `/app/data` (khớp volume `./data:/app/data`, đặt khác là mất phiên ZCA sau mỗi lần deploy), và không có build arg `NEXT_PUBLIC_API_URL`. Lý do: env dài toàn giá trị mặc định khiến người đọc không biết dòng nào thật sự quan trọng, và dễ sinh lỗi như gõ sai tên khoá mà không ai phát hiện.

Code không còn đọc tên cũ (alias) và các biến của Zalo Bot chính thức: `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN`, `BOT_TOKEN`, `WEBHOOK_URL`, `ZALO_BOT_NAME`, `ZCA_DATA_DIR`, `OLLAMA_*`, `PORT`, `GATEWAY_PORT`, `WEB_PORT`. Cờ `ZCA_AUTO_LOGIN` cũng đã bỏ: bot tự đăng nhập ZCA khi có phiên đã lưu hoặc có `ZCA_IMEI` + `ZCA_COOKIE` (xem [ZCA](../modules/zca/README.md)).

**Khi deploy**: nếu container khởi động lại liên tục, hãy xem log. Khung "THIẾU CẤU HÌNH BIẾN MÔI TRƯỜNG" liệt kê chính xác biến cần bổ sung vào `.env` hoặc `.env.production`.

## Biến tùy chọn

Mặc định ghi trong ngoặc.

- **Mạng**: `BE_PORT` (3005), `WEB_ORIGIN` (= `APP_URL`), `CORS_ALLOW_ALL` (false), `DEFAULT_TIMEZONE` (`Asia/Ho_Chi_Minh`).
- **Database/cache**: `DATABASE_SSL` (false), `TYPEORM_SYNCHRONIZE` (false), `REDIS_URL`. Chỉ có tác dụng khi chạy ngoài Docker Compose (dev); trong `docker-compose.yml` đã ghi cứng.
- **Bot**: `BOT_NAME` (`Bot`).
- **Mã đăng nhập dashboard cố định**: `DASHBOARD_LOGIN_CODE` (để trống = tắt). Đây là secret không hết hạn: không commit giá trị thật, đổi mã bằng cách sửa env rồi restart.
- **ZCA (Zalo cá nhân)**: `DATA_DIR` (`./data`; `docker-compose.yml` ghi cứng `/app/data`), `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT` (thường không cần: đăng nhập bằng QR trên dashboard, phiên lưu vào file + Redis), `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN` (false), `ZCA_CHECK_UPDATE` (false), `ZCA_LOGGING` (false, bật khi debug), `ZCA_ENABLE_WELCOME` (false), `ZCA_WELCOME_IMAGE_PATH`.
- **LLM**: `LLM_PROVIDER` chọn nhà cung cấp đầu chuỗi cho `LlmService` (`gemini` mặc định, `openai`, `qwen`/`ollama`, `router`/`9router`); `LLM_FALLBACK_PROVIDERS` là danh sách provider dự phòng, phân cách bằng dấu phẩy (vd `gemini`); `LLM_TIMEOUT_MS` (mặc định `30000`); provider `router` dùng `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY`; kèm `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_API_KEY`. `ollama`/`9router` chỉ là tên provider trong `LLM_PROVIDER`, không phải tên biến.
- **Trí nhớ hội thoại**: không có biến môi trường; bật theo từng kênh trong "Cấu hình kênh" trên dashboard. Xem [Trí nhớ hội thoại](../modules/zca/chat-memory.md).
- **Chỉ dùng cho Docker Compose**: `POSTGRES_PASSWORD` (bắt buộc; compose tự dựng `DATABASE_URL` từ nó), `POSTGRES_PORT`, `REDIS_PORT`, `NGINX_PORT` (3000 local, 3009 production), `FE_PORT` (5173).

## Biến của web dashboard

Chỉ biến `NEXT_PUBLIC_*` được đóng gói vào trình duyệt; mọi secret ở trên chỉ dành cho `apps/api`.

- `NEXT_PUBLIC_API_URL`: origin public của API, **không** thêm `/api` vì hằng số route đã có sẵn. Mặc định bỏ trống (`docker-compose.yml` không truyền build arg này): web gọi API bằng đường dẫn tương đối qua cùng domain, Nginx của web chuyển `/api` sang API. Chỉ khai báo khi API nằm ở domain khác.
- `NEXT_PUBLIC_APP_URL`: domain dùng cho metadata/sitemap.

## Cách cấu hình

1. Sao chép `.env.example` thành `.env.local` ở root monorepo.
2. Điền toàn bộ biến bắt buộc; không để placeholder `replace-...` trong môi trường triển khai.
3. Chỉ thêm biến tùy chọn ở trên khi muốn khác mặc định.
4. Chạy `scripts/tunnel.sh` khi dev qua Cloudflare Tunnel: script tự ghi `APP_URL` vào `.env` ở chế độ gateway; chế độ trỏ thẳng backend thì giữ nguyên `.env`. Script không còn đăng ký webhook với Zalo.
5. Chỉ có **một** file mẫu là `.env.example` ở root. Các file mẫu riêng trong `apps/api` và `apps/web` đã bị xoá: API và web đều nạp env từ root nên chúng không có tác dụng, lại hay bị cũ (còn `PORT`, `ZALO_ALLOWED_USER_IDS` mà không code nào đọc). Quyền dùng bot do admin cấp qua trường `grantAccess` của user, không qua env.

## Docker local

Chạy `npm run docker:local` (tương đương `docker compose -f docker-compose.local.yml up -d`) để bật PostgreSQL, Redis và Nginx gateway; API và web chạy trên máy bằng `npm run dev`. Gateway (`NGINX_PORT`, mặc định 3000) chuyển `/api`, `/oauth2callback` về API chạy trên máy host (`BE_PORT`) và phần còn lại về Next dev server (`FE_PORT`).

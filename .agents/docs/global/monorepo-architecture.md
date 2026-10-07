---
metadata:
  agent-artifact:
    id: docs-global-monorepo-architecture
    type: documentation
    depends_on:
      - .agents/knowledge/global/monorepo-architecture.md
---

# Kiến trúc Monorepo

Tài liệu này hướng dẫn cấu trúc tổ chức dự án monorepo và quy trình vận hành hệ thống, ánh xạ trực tiếp với tri thức canonical [`monorepo-architecture.md`](../../knowledge/global/monorepo-architecture.md).

## Cấu trúc

- `apps/api`: NestJS backend, zalo bot và OAuth Google.
- `apps/web`: Next.js App Router xuất static files; không dùng Next API Route hay Server Action.
- `packages/contracts`: Kiểu dữ liệu và hằng số route dùng chung.
- PostgreSQL là nơi lưu dữ liệu bền vững; container API không dùng file database cục bộ.

## Chạy dự án

1. Sao chép `.env.example` thành `.env.local` ở root và điền toàn bộ biến bắt buộc; xem thêm [Env Guard](environment-guard.md).
2. Chạy cả API và Web cùng lúc bằng `npm run dev` (hoặc chạy riêng từng app bằng `npm run dev:api` / `npm run dev:web`).
3. Chạy `npm run build` trước khi phát hành; lệnh này build contracts, API rồi web.

## Kiểm tra chất lượng

- `npm run lint` và `npm run format:check` chỉ kiểm tra, không sửa mã nguồn.
- `npm run lint:fix` và `npm run format` chủ động sửa lỗi lint/format trên toàn monorepo.

## Bảo mật biến môi trường

Chỉ `NEXT_PUBLIC_API_URL` được phép đi vào bundle trình duyệt. Token zalo, Gemini, Google OAuth và `DATA_ENCRYPTION_KEY` chỉ dùng cho `apps/api`.

Dashboard tổ chức theo DDD: `modules/auth` sở hữu token/session phía trình duyệt, `modules/dashboard` sở hữu tổng quan và thống kê, `modules/contacts` sở hữu danh bạ. Component tái sử dụng như `DataTable` và `DataPanel` nằm ở `shared/ui`; client HTTP và TanStack Query provider nằm ở `shared/api`/`shared/providers`. `packages/contracts` chỉ chứa route constants và DTO types, không chứa React component.

## Tránh xung đột bot zalo

zalo chỉ cho phép một tiến trình gọi long polling (`getUpdates`) với cùng một bot token. Phải khai báo rõ `zalo_LONG_POLLING_ENABLED`; chỉ đặt `true` tại đúng một bot worker. Khi chạy local chỉ để dùng dashboard/API trong lúc production đang chạy bot, đặt `zalo_LONG_POLLING_ENABLED=false` trong `.env.local`. Instance này vẫn gửi được tin nhắn chủ động (ví dụ lời nhắc và thông báo OAuth) nhưng không nhận command hoặc update từ zalo.

## Dashboard mở từ bot

1. Cấu hình `APP_URL` là URL public runtime của API/bot và đặt `WEB_ORIGIN` cùng giá trị khi Dashboard dùng chung domain.
2. Đặt `NEXT_PUBLIC_API_URL` cùng origin đó trước khi build Docker dashboard, ví dụ `https://zalobot.datintech.site` (không thêm `/api`). Giá trị này được đóng gói vào static bundle; các hằng route đã có `/api`, nên Nginx nhận `/api/*` và chuyển sang NestJS. Không dùng `SERVICE_URL_*` vì Coolify dành tiền tố này cho URL do nền tảng quản lý.
3. Bot hiển thị nút **Xem Dashboard**. Link chỉ dùng trong năm phút; API xác nhận token theo user zalo, cấp session dashboard và chuyển sang `/` (kèm `#dashboard_token=...`) trên frontend.
4. Dashboard gọi `GET /api/dashboard` bằng access token; không truyền zalo ID. Refresh token không đi vào JavaScript. Hai secret `DASHBOARD_ACCESS_TOKEN_SECRET` và `DASHBOARD_REFRESH_TOKEN_SECRET` chỉ nằm ở API.

Access token dashboard được lưu ở browser storage trong 15 phút theo yêu cầu UI. Refresh token sống 7 ngày, được xoay vòng ở cookie `HttpOnly`; Axios tự refresh sau `401`, còn TanStack Query quản lý cache và trạng thái dữ liệu.

Khi phát triển local, Next chạy tại `http://localhost:5173` và browser gọi API tại `http://localhost:3000`; API tự cho phép origin này ở non-production. Khi dashboard và API dùng cùng domain, đặt `APP_URL`, `WEB_ORIGIN` và `NEXT_PUBLIC_API_URL` cùng giá trị. Khi triển khai static web riêng, đặt `WEB_ORIGIN` là URL public của web; API dùng biến này cho CORS và redirect từ `/api/access`.

Khi cần frontend local gọi API remote, đặt `NEXT_PUBLIC_API_URL=https://zalobot.datintech.site` trong `apps/web/.env.local` và tạm đặt `CORS_ALLOW_ALL=true` trong ENV của API remote. Chế độ này phản chiếu origin thay vì dùng `*`, nên vẫn tương thích cookie refresh; phải đổi lại `false` sau khi thử nghiệm.

## Docker & Tối Ưu Hóa Build Cache

Dùng `docker compose up --build` tại root. Compose build API và static web qua `apps/api/Dockerfile` và `apps/web/Dockerfile`; web được phục vụ bởi Nginx tại `WEB_PORT` (mặc định 3001), đồng thời Nginx tự động reverse proxy các route `/api/*` (bao gồm Swagger UI `/api/docs` và OAuth callback `/api/oauth2callback`) sang container API backend (`http://api:3000`). PostgreSQL và Redis dùng Docker volumes riêng. Với kiến trúc này, Cloudflare Tunnel chỉ cần trỏ vào duy nhất cổng Web (`localhost:3001`).

### Cơ chế tối ưu Docker Build trên Coolify:

1. **Root `.dockerignore`**: Loại trừ `.git`, `node_modules`, `.next`, `dist`, logs, test artifacts và các file môi trường `.env*` khỏi build context, giúp upload context tức thì và tránh làm mất cache Docker do thay đổi file tạm.
2. **Tách biệt multi-stage trong `apps/api/Dockerfile`**:
   - `tessdata-downloader`: Tải dữ liệu ngôn ngữ Tesseract OCR độc lập.
   - `whisper-builder`: Pin version tag `v1.7.4` của `whisper.cpp` và biên dịch `whisper-server`, tải `ggml-base.bin` trong một stage riêng.
   - `builder`: Cài đặt dependencies và build TypeScript.
   - 👉 Khi deploy thay đổi code TypeScript trên Coolify, Docker chỉ cần build lại stage `builder` (~10-15 giây) thay vì phải clone, biên dịch C++ và tải lại model (~5-8 phút).
3. **BuildKit Cache Mounts**: Sử dụng `# syntax=docker/dockerfile:1` cùng `RUN --mount=type=cache,target=/root/.npm npm ci` để chia sẻ cache npm giữa các build.

## Quản Lý Cơ Sở Dữ Liệu & TypeORM Migrations

Dự án sử dụng cơ chế **TypeORM Migrations tự động** để đồng bộ cơ sở dữ liệu PostgreSQL an toàn mà không làm mất dữ liệu:

1. **Tự động thực thi khi khởi động (`migrationsRun: true`)**:
   - Khi container API khởi động, NestJS tự động quét các file trong `apps/api/src/database/migrations/` và thực thi những migration chưa được áp dụng vào database.
   - Trạng thái đã chạy được lưu trong bảng `typeorm_migrations`.
2. **Các lệnh quản lý Migration (CLI)**:
   - `npm run migration:run --workspace @zalobot/api`: Chạy thủ công tất cả migration mới.
   - `npm run migration:revert --workspace @zalobot/api`: Rollback migration gần nhất.
   - `npm run migration:generate --workspace @zalobot/api -- src/database/migrations/<TenMigration>`: Tự động so sánh Entity và sinh file migration mới.
   - `npm run migration:create --workspace @zalobot/api -- src/database/migrations/<TenMigration>`: Tạo file migration trống.

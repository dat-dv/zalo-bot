---
metadata:
  agent-artifact:
    id: docs-global-monorepo-architecture
    type: documentation
    depends_on:
      - .agents/knowledge/global/monorepo-architecture.md
      - package.json
      - apps/api/src/main.ts
      - apps/web/next.config.ts
      - apps/web/nginx.conf
      - docker-compose.yml
      - docker-compose.local.yml
---

# Kiến trúc Monorepo

Tài liệu này hướng dẫn cấu trúc monorepo và quy trình vận hành, ánh xạ với tri thức canonical [`monorepo-architecture.md`](../../knowledge/global/monorepo-architecture.md).

## Cấu trúc

- `apps/api`: NestJS backend — nhận tin nhắn Zalo qua webhook, kết nối Zalo cá nhân (ZCA), Google OAuth/Workspace, gọi LLM (`LlmService`), REST API cho dashboard. Code chia theo vùng nghiệp vụ: `finance`, `zalo`, `zca`, `google`, `llm`, `ocr`, `receipt-storage`, `reminders`, `reports`, `users`, `redis`, `health`, `audit`, `common`, `config`, `database`.
- `apps/web`: Next.js App Router, xuất static (`output: 'export'`) khi build production; không dùng Route Handler hay Server Action. Dữ liệu từ server do TanStack Query quản lý; state thuần giao diện dùng chung (theme, ẩn/hiện số tiền) nằm trong store Zustand ở `apps/web/src/shared/store/`. Module trong `apps/web/src/modules/`: `auth`, `calendar`, `contacts`, `dashboard`, `debts`, `expenses`, `reminders`, `settings`, `tasks`, `users`, `zca`.
- `packages/contracts`: hằng số route (`API_ROUTES`, `APP_ROUTES`), kiểu DTO, catalog i18n dùng chung.
- PostgreSQL lưu dữ liệu bền vững; Redis lưu cache, phiên ZCA, thao tác chờ duyệt.

## Các trang web

`/` và `/dashboard` (tổng quan), `/transactions` (`/expenses`, `/income` tự chuyển sang `/transactions?type=...`), `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/places`, `/zca` (Zalo & Người dùng), `/settings`; trang public `/about`, `/privacy`, `/terms`.

## Chạy dự án

1. Sao chép `.env.example` thành `.env.local` ở root và điền biến bắt buộc; xem [Biến môi trường](environment-guard.md).
2. Bật hạ tầng local bằng `npm run docker:local` (PostgreSQL, Redis, Nginx gateway).
3. Chạy API và web cùng lúc bằng `npm run dev` (hoặc `npm run dev:api` / `npm run dev:web`). Web dev chạy ở `FE_PORT` (mặc định 5173), API ở `BE_PORT` (mặc định 3005).
4. Chạy `npm run build` trước khi phát hành; lệnh này build contracts, API rồi web.

## Kiểm tra chất lượng

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` chỉ kiểm tra.
- `npm run lint:fix` và `npm run format` sửa lỗi lint/format trên toàn monorepo.

## Bảo mật biến môi trường

Chỉ biến `NEXT_PUBLIC_*` được phép vào bundle trình duyệt. Token Zalo, khóa LLM (`GEMINI_*`, `OPENAI_*`, `QWEN_*`), Google OAuth, secret dashboard và `DATA_ENCRYPTION_KEY` chỉ dùng cho `apps/api`.

## Bot nhận tin nhắn như thế nào

Bot không dùng long polling. Tin nhắn đến theo hai đường:

- **Webhook Zalo Bot chính thức**: Zalo gọi `/webhook` (chấp nhận cả `/zalo/webhook`, `/api/webhook`, `/api/zalo/webhook`). Các đường này không có tiền tố `/api` bắt buộc để khớp URL đã đăng ký với Zalo.
- **ZCA**: tài khoản Zalo cá nhân kết nối WebSocket qua `zca-js` để tham gia nhóm chat.

Vì vậy chạy nhiều instance API cùng lúc không tranh nhau nhận update; chỉ instance nào được đăng ký làm webhook URL mới nhận tin nhắn.

## Dashboard mở từ bot

1. Cấu hình `APP_URL` là URL public của API; `WEB_ORIGIN` là URL public của web (mặc định bằng `APP_URL` khi dùng chung domain).
2. Không cần `NEXT_PUBLIC_API_URL` khi web và API cùng domain: `docker-compose.yml` không truyền build arg này, web gọi `/api` bằng đường dẫn tương đối. Chỉ đặt khi API ở domain khác (origin, không thêm `/api`). Không dùng tiền tố `SERVICE_URL_*` vì Coolify dành riêng.
3. Người dùng gõ `/dashboard`; bot gửi link một lần sống 20 phút. API xác nhận token, ghi cookie refresh và chuyển sang `/dashboard#dashboard_token=...`.
4. Access token sống 24 giờ, lưu ở `localStorage`; refresh token sống 7 ngày, xoay vòng trong cookie `HttpOnly`. Axios tự refresh sau `401`, TanStack Query quản lý cache.

Chi tiết: [Phiên Dashboard](dashboard-session.md).

## CORS và gọi API từ web

- Khi phát triển, Next dev rewrite `/api/*` sang API (theo `NEXT_PUBLIC_API_URL` hoặc `http://localhost:<NGINX_PORT>`), và web trên localhost/tunnel gọi API bằng đường dẫn tương đối.
- API cho phép origin `WEB_ORIGIN` và thêm `http://localhost:5173` khi không phải production.
- Khi cần frontend local gọi API remote, tạm đặt `CORS_ALLOW_ALL=true` ở API remote. Chế độ này phản chiếu origin (vẫn dùng được cookie refresh) nên phải đổi lại `false` sau khi thử nghiệm.

## Docker production

`docker compose up -d --build` tại root dựng 4 service:

- `postgres` (16-alpine) và `redis` (7-alpine, bật AOF) với volume riêng.
- `api`: cổng `BE_PORT` (mặc định 3005), mount `./data:/app/data`, healthcheck `GET /health`.
- `web`: Nginx phục vụ static export tại `NGINX_PORT` (mặc định 3009), đồng thời reverse proxy `/api/`, `/webhook`, `/zalo/`, `/oauth2callback` sang `http://api:${BE_PORT}`. Nhờ vậy Cloudflare Tunnel chỉ cần trỏ vào một cổng web.

Tối ưu build:

1. Root `.dockerignore` loại `node_modules`, `dist`, `.next`, `out`, `.git`, `.env*` để context nhỏ và không lọt secret.
2. **Giữ cache `npm ci` dù version tự tăng.** Hook `.githooks/pre-commit` tự tăng `version` ở mọi `package.json` sau mỗi commit. Nếu Dockerfile copy thẳng các file này thì layer luôn đổi và `npm ci` phải cài lại từ đầu ở mỗi lần deploy (~45–55 giây mỗi service). Vì vậy cả 2 Dockerfile có stage `manifests` đặt mọi `version` (gồm cả `package-lock.json`) về `0.0.0`; các stage sau lấy file bằng `COPY --from=manifests`, Docker so cache theo nội dung file nên `npm ci` chỉ chạy lại khi dependency thật sự thay đổi.
3. **Image API chỉ chứa thư viện chạy thật.** Stage `prod-deps` cài `npm ci --omit=dev` riêng cho workspace `@zalobot/api` và `@zalobot/contracts`; runner lấy `node_modules` từ stage này nên không kèm thư viện của web (Next.js, React…) hay devDependencies (TypeScript, Nest CLI…). Image nhỏ hơn giúp bước export/nén layer khi deploy nhanh hơn đáng kể. Builder cũng chỉ cài theo workspace của mình (API không cài thư viện web, web không cài thư viện API).
4. Runner API vẫn copy `package.json` và `CHANGELOG.md` **thật** (không phải bản đã đặt version 0.0.0), vì thông báo deploy (`health/deploy-notify.service.ts`) đọc version lúc chạy.
5. BuildKit cache mount (`RUN --mount=type=cache,target=/root/.npm`) chia sẻ cache npm giữa các lần build.

Khi thêm dependency mới cho API, hãy kiểm tra nó nằm trong `dependencies` (không phải `devDependencies`) nếu cần lúc chạy; nếu không, container sẽ lỗi `Cannot find module` vì runner không có devDependencies.

## Quản lý cơ sở dữ liệu & TypeORM Migrations

1. **Tự chạy khi khởi động** (`migrationsRun: true`): API chạy các migration chưa áp dụng trong `apps/api/src/database/migrations/`, lưu trạng thái ở bảng `typeorm_migrations`. Không sửa migration đã chạy; luôn thêm migration mới. Danh sách migration được import tường minh, nên migration mới phải được đăng ký ở cả `database.module.ts` và `data-source.ts`.
2. **Lệnh CLI**:
   - `npm run migration:run --workspace @zalobot/api`: chạy migration mới.
   - `npm run migration:revert --workspace @zalobot/api`: rollback migration gần nhất.
   - `npm run migration:generate --workspace @zalobot/api -- src/database/migrations/<TenMigration>`: sinh migration từ thay đổi entity.
   - `npm run migration:create --workspace @zalobot/api -- src/database/migrations/<TenMigration>`: tạo migration trống.

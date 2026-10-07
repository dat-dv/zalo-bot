# Tổng kết bổ sung Reverse Proxy Nginx cho Kiến Trúc Single-Origin

## 1. Các thay đổi đã thực hiện

### 1. Cấu hình Nginx Web Container (`apps/web/nginx.conf`)

- Đã thêm `location /api/`: Tự động chuyển tiếp toàn bộ request API sang backend container `http://api:3000/api/` với đầy đủ headers chuẩn (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, WebSocket upgrade).
- Đã thêm `location /oauth2callback`: Chuyển tiếp callback Google OAuth sang `http://api:3000/oauth2callback`.
- Cải thiện `location /`: Hỗ trợ SPA routing tĩnh với fallback `$uri $uri/ $uri.html /index.html =404`.

### 2. Đồng bộ Tài liệu Kiến trúc

- Đã cập nhật `.agents/knowledge/global/monorepo-architecture.md` (Canonical English) và `.agents/docs/global/monorepo-architecture.md` (Vietnamese) ghi nhận luồng Reverse Proxy nội bộ của container Web.

---

## 2. Kết quả kiểm tra xác thực (Verification Results)

- **Root Monorepo Build**: `npm run build` (Pass 100% - Contracts, API, Next.js Web Static Export)
- **Typecheck**: `npm run typecheck` (Pass 100%)
- **Lint**: `npm run lint` (Pass 100%)
- **zalo Fallback Regression**: `node apps/api/scripts/check-zalo-command-fallback.cjs` (Pass 100%)

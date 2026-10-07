# Kế hoạch bổ sung Reverse Proxy Nginx cho Kiến Trúc Single-Origin

## Bối cảnh & Mục tiêu

Khi triển khai theo kiến trúc Single-Origin qua Cloudflare Tunnel trỏ về Web container (`zalobot.datintech.site` -> Web:80), toàn bộ các request API (`/api/*`) và xác thực Google (`/oauth2callback`) cần được Web Nginx container tự động chuyển tiếp (Reverse Proxy) sang Backend API container (`http://api:3000`).

Hiện tại file `apps/web/nginx.conf` chưa có cấu hình proxy, dẫn đến các request này bị trả về lỗi `404 Not Found`.

---

## Các thay đổi đề xuất

### 1. Web Nginx Configuration

#### [MODIFY] [`apps/web/nginx.conf`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/nginx.conf)

- Bổ sung `location /api/`: Chuyển tiếp toàn bộ request API sang `http://api:3000/api/` với đầy đủ headers chuẩn (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, WebSocket upgrade).
- Bổ sung `location /oauth2callback`: Chuyển tiếp callback Google OAuth sang `http://api:3000/oauth2callback`.
- Cải thiện `location /`: Hỗ trợ SPA routing tĩnh Next.js với `try_files $uri $uri/ $uri.html /index.html =404;`.

---

### 2. Đồng bộ Tài liệu Kiến trúc Monorepo

#### [MODIFY] [`.agents/knowledge/global/monorepo-architecture.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/monorepo-architecture.md)

- Cập nhật tài liệu kiến trúc Single-Origin: ghi nhận Web Nginx đóng vai trò reverse proxy nội bộ cho `/api/` và `/oauth2callback`.

#### [MODIFY] [`.agents/docs/global/monorepo-architecture.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/monorepo-architecture.md)

- Cập nhật hướng dẫn vận hành deployment tiếng Việt về luồng reverse proxy trong container Web.

---

## Kế hoạch kiểm tra & xác nhận (Verification Plan)

### Automated Tests

- Kiểm tra cú pháp và build toàn bộ monorepo:
  ```bash
  npm run typecheck
  npm run lint
  npm run build
  ```

### Manual Verification

- Xác nhận file `nginx.conf` có đầy đủ các block `location /api/` và `location /oauth2callback` hướng tới `http://api:3000`.

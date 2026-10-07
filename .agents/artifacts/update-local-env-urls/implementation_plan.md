# Kế hoạch Cập Nhật Biến Môi Trường Local (`.env.local`)

## 1. Mục tiêu & Bối cảnh

- Hiện tại, file `.env.local` ở root đang override biến `APP_URL=http://localhost:3000` và `NEXT_PUBLIC_API_URL=http://localhost:3000`.
- Khi khởi chạy API ở local, hệ thống ưu tiên nạp `.env.local` nên bot đã sinh ra link OAuth callback trỏ về `http://localhost:3000`.
- Trên Google Cloud Console, anh đã khai báo cả 2 địa chỉ:
  - `http://localhost:3000/api/oauth2callback`
  - `https://zalobot.datintech.site/api/oauth2callback`
- Tùy theo nhu cầu kiểm thử (dùng trực tiếp domain `https://zalobot.datintech.site` hoặc giữ `http://localhost:3000`), cập nhật `.env.local` đồng bộ và chuẩn hóa.

---

## 2. Các thay đổi dự kiến

### Component: Environment Configurations

#### [MODIFY] .env.local

Cập nhật các biến URL trong `.env.local` sang domain chuẩn `https://zalobot.datintech.site`:

```env
APP_URL=https://zalobot.datintech.site
WEB_ORIGIN=https://zalobot.datintech.site
NEXT_PUBLIC_API_URL=https://zalobot.datintech.site
CORS_ALLOW_ALL=true
```

_(Lưu ý: Nếu cần quay lại kiểm thử thuần localhost không qua domain, chỉ cần đổi lại `APP_URL=http://localhost:3000`)_.

---

## 3. Kế hoạch Kiểm tra (Verification Plan)

### Automated Verification

- Kiểm tra tính hợp lệ của biến môi trường:
  ```bash
  npm run typecheck
  npm run agent-system:validate
  ```

### Manual Verification

- Khởi động backend API (`npm run dev:api`).
- Quan sát log khởi động xác nhận:
  - `🌐 Public OAuth Callback URL: https://zalobot.datintech.site/api/oauth2callback`
  - `📚 Swagger OpenAPI Docs: https://zalobot.datintech.site/api/docs`

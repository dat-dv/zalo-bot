---
RequestFeedback: true
Task: api-route-prefix
Risk: medium
Status: awaiting-approval
---

# Kế hoạch chuẩn hóa tiền tố `/api`

## Mục tiêu

Tách rõ route frontend và backend: React dashboard dùng `/reports`, endpoint dashboard NestJS dùng trực tiếp `/api/*`.

## Thay đổi

1. Đặt global prefix `api` cho NestJS, route dashboard không mang nhánh `reports`:
   - `/api/access`
   - `/api/dashboard`
   - `/api/refresh`
   - `/api/logout`
   - Google OAuth callback được loại trừ khỏi prefix để giữ redirect URI hiện tại.
2. Cập nhật URL nút zalo để gọi `/api/access`.
3. Cập nhật `API_ROUTES` shared contracts và Axios client.
4. Đổi Vite proxy từ từng route `/reports/*` sang một rule `/api`, trỏ tới backend `localhost:3000` trong môi trường tunnel.
5. Cập nhật docs và `.env.example` theo route mới.

## Kết quả

```text
/reports            -> React dashboard
/api/*              -> NestJS API
```

## Kiểm tra

Chạy format, lint, typecheck, build và kiểm tra cấu hình Vite proxy.

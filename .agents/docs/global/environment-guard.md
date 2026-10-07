---
metadata:
  agent-artifact:
    id: docs-global-environment-guard
    type: documentation
    depends_on:
      - .agents/knowledge/global/environment-guard.md
---

# Env Guard và cấu hình bắt buộc

API và dashboard không tự đoán giá trị cấu hình. Nếu thiếu hoặc sai biến môi trường bắt buộc, API dừng ngay khi khởi động và dashboard dừng ngay khi dev/build. Tài liệu này ánh xạ với tri thức canonical [Environment Guard](../../knowledge/global/environment-guard.md).

## Cách cấu hình

1. Sao chép `.env.example` thành `.env.local` ở root monorepo.
2. Điền toàn bộ key bắt buộc; không để placeholder `replace-me` trong môi trường triển khai.
3. Giữ `zalo_ALLOWED_USER_IDS` trống nếu chỉ dùng `zalo_ADMIN_ID`.
4. Chỉ bật flash-call khi có đủ `zalo_API_ID`, `zalo_API_HASH` và `zalo_SESSION`; nếu không dùng, xóa cả ba key.
5. Đặt `NEXT_PUBLIC_API_URL` là URL HTTP(S) đầy đủ của API trước khi chạy hoặc build dashboard.

## Docker local

Chạy stack local bằng `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build`. File override giữ secret trong `.env`, dùng `.env.local` cho local overrides, trỏ dashboard về `http://localhost:3000` và tắt zalo long polling để không tranh consumer với production.

## Lỗi thường gặp

- Số port/timeout/giới hạn ảnh-voice phải là số nguyên dương.
- `CORS_ALLOW_ALL` và `zalo_LONG_POLLING_ENABLED` chỉ nhận `true` hoặc `false`.
- `DATA_ENCRYPTION_KEY` phải có đúng 64 ký tự hexadecimal.
- `APP_URL`, `WEB_ORIGIN`, `WHISPER_URL` và `NEXT_PUBLIC_API_URL` phải là URL HTTP(S) hợp lệ.
- `DEFAULT_TIMEZONE` phải là IANA timezone, ví dụ `Asia/Ho_Chi_Minh`.

Thông báo lỗi chỉ nêu tên key và lý do, không hiển thị secret.

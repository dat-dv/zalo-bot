# Kế hoạch cấu hình Docker local

RequestFeedback: true

## Phát hiện

`.env.local` hiện thiếu cấu hình PostgreSQL Docker (`POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`), cổng web và các secret bắt buộc để API khởi động. Không có giá trị bí mật nào được đọc hoặc ghi vào báo cáo.

## Thay đổi dự kiến

1. Nạp `.env` trước và `.env.local` sau trong Compose để API Docker nhận secret hiện có mà local overrides vẫn có ưu tiên.
2. Thêm `docker-compose.local.yml` để trỏ web/API về `localhost`, tắt zalo long polling và thiết lập thư mục receipt trong container.
3. Không thêm `DATABASE_URL` cho Docker Compose: Compose đã ghi đè biến này bằng URL nội bộ tới container `postgres`.
4. Chạy `docker compose config --quiet` để xác nhận Compose đọc được cấu hình mà không in secret.

## Lưu ý bắt buộc từ bạn

Secret vẫn chỉ nằm trong `.env`; không cần sao chép chúng sang `.env.local`.

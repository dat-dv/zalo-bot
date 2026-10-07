# Bàn giao migration Next.js Static Export + DDD

## Kết quả

- `apps/web` đã chuyển từ Vite sang Next.js 16 Static Export.
- Static pages: `/`, `/reports`, `/reports/statistics`, `/reports/contacts`.
- DDD ownership:
  - `modules/auth`: nhận và lưu dashboard token ở browser.
  - `modules/dashboard`: dashboard API/query và views overview/statistics.
  - `modules/contacts`: contacts API/query và view.
  - `shared/api`, `shared/providers`, `shared/ui`: HTTP, provider và component dùng lại (`DataTable`, `DataPanel`).
- Docker Compose có thêm service web Nginx dùng static output.

## Cấu hình triển khai

- `WEB_ORIGIN`: URL public của static dashboard.
- `NEXT_PUBLIC_API_URL`: URL public của Nest API; giá trị này được đóng gói vào web build.
- `SERVICE_URL_zaloBOT`: URL public API, dùng cho OAuth callback.

## Xác minh

- `npm run format:check --workspace @zalobot/web`: đạt.
- `npm run typecheck`: đạt.
- `npm run lint`: đạt.
- `npm run build`: đạt; xác nhận static output có đủ ba route dashboard.

## Lưu ý

`npm install` báo một high-severity dependency advisory. Chưa chạy `npm audit fix` để tránh thay đổi dependency ngoài phạm vi migration; nên đánh giá riêng trước khi áp dụng.

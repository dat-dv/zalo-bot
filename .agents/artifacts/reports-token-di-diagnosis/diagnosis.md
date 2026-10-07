# Chẩn đoán: API không khởi tạo được ReportsTokenService

## Kết luận

API production đang chạy artifact biên dịch cũ trong `apps/api/dist`, không phải dependency graph hiện tại của mã nguồn.

## Bằng chứng tái hiện

- Đã chạy `npm run start:api`; lệnh chạy `node dist/main.js` và tái hiện chính xác lỗi Nest không resolve được `ReportsTokenService` tại index 12 của `zaloUpdate`.
- Mã nguồn `apps/api/src/zalo/zalo.module.ts` import `DashboardAuthModule`.
- `DashboardAuthModule` đăng ký và export `ReportsTokenService`.
- Artifact đang được chạy `apps/api/dist/zalo/zalo.module.js` vẫn import `ReportsModule`.
- `ReportsModule` hiện có `providers: []`, nên không thể cung cấp `ReportsTokenService` cho `zaloUpdate`.
- Thời gian sửa mã nguồn mới hơn artifact `dist` khoảng hai phút tại thời điểm kiểm tra.

## Phạm vi

Không phải lỗi của handler `/week`, chuẩn hóa Markdown, hay zalo runtime. Đây là lệch phiên bản giữa mã nguồn và bản build production.

## Cách khắc phục đề xuất

Build lại API từ mã nguồn hiện tại rồi khởi động lại tiến trình production/deployment. Lần build mới sẽ đưa `DashboardAuthModule` vào `dist`, qua đó cung cấp `ReportsTokenService` cho `zaloModule`.

## Xác minh sau khắc phục

1. Build API.
2. Khởi động `start:api`/container production.
3. Kiểm tra log phải qua bước khởi tạo `zaloModule` mà không có lỗi dependency index 12.
4. Kiểm tra `/start` hoặc `/help` để xác nhận bot nạp được đầy đủ handler.

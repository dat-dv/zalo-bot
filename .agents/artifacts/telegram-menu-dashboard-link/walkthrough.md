# Bàn giao: menu zalo và liên kết Dashboard

## Đã thay đổi

- Nút **📊 Xem báo cáo** trong menu inline chung là nút URL trực tiếp, mở Dashboard ngay khi bấm.
- Giữ handler callback cũ để các menu đã gửi trước khi nâng cấp vẫn có thể xin một link mới.
- Thêm kiểm thử bảo vệ hai hợp đồng: Dashboard là URL thay vì callback, và cùng dữ liệu đầu vào luôn tạo cùng cấu trúc menu cho `/start` và `/help`.
- Cập nhật tri thức canonical và tài liệu hướng dẫn về hành vi menu/link mới.

## Xác minh

- `./node_modules/.bin/tsx --test apps/api/src/zalo/services/zalo-ui.service.spec.ts`: 2/2 đạt.
- `npm run lint`: đạt.
- `npm run typecheck`: đạt.
- `npm run build`: đạt.
- `git diff --check`: đạt.

## Lưu ý triển khai

Các tin nhắn menu cũ của zalo vẫn mang callback cũ; khi bấm, bot trả về một URL mới. Gọi lại `/start` hoặc `/help` sẽ nhận menu mới với nút mở trực tiếp.

---
metadata:
  agent-artifact:
    id: docs-global-zalo-command-intake
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-command-intake.md
---

# Nhận lệnh zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-command-intake.md`](../../knowledge/global/zalo-command-intake.md).

Bot API nhận các lệnh như `/help` bằng long polling được điều phối qua `zaloLauncherService` khi `zalo_LONG_POLLING_ENABLED=true`.

- **Quản lý xung đột Bot Instance (409 Conflict)**: Khi có nhiều instance chạy trùng bot token hoặc khởi động lại nhanh trước khi kết nối polling cũ hết hạn, `zaloLauncherService` sẽ tự động bắt lỗi `409 Conflict`, ghi log cảnh báo và tạm hoãn polling để thử lại sau 15 giây mà **không làm crash toàn bộ server NestJS** (Web REST API, OAuth callbacks và Next.js proxy vẫn duy trì uptime 100%).
- **Tắt Polling**: Nếu đặt biến `zalo_LONG_POLLING_ENABLED=false`, phải có webhook hoặc worker polling riêng chuyển update vào bot; nếu không, zalo không thể đến handler nên bot sẽ im lặng. Sau khi đổi biến môi trường, build và restart/redeploy đúng instance API, rồi kiểm tra log có dòng `Listening for messages and commands on zalo (Long Polling)...`.

Lệnh kiểm tra hồi quy: `node apps/api/scripts/check-zalo-command-fallback.cjs`. Script xác minh `/start`, `/help` và `/dashboard` luôn trả lời kể cả khi tạo link dashboard thất bại, khi cấu hình URL là localhost, hoặc khi zalo API từ chối inline markup.

Lệnh unit test chuẩn cho API là `npm run test --workspace @zalobot/api`. Lệnh này phải chạy toàn bộ file `*.spec.ts` dưới `apps/api/src/`, kể cả test lồng trong `zalo/services/`, và dùng runner hiểu decorators của NestJS. Callback có thay đổi dữ liệu không được thực thi ngay: bot tạo yêu cầu xác nhận gắn với đúng người dùng; chỉ nút xác nhận của người đó mới thực thi thao tác.

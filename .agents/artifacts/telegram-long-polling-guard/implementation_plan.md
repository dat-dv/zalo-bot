# Kế hoạch xử lý xung đột zalo long polling

RequestFeedback: true

## Mục tiêu

Cho phép API chạy mà không khởi tạo zalo long polling khi môi trường đó không phải bot worker, nhờ vậy local API và deployment không còn đồng thời gọi `getUpdates` với cùng token.

## Phạm vi thay đổi

1. Mở rộng cấu hình `zalo` với cờ boolean `longPollingEnabled`, lấy từ biến môi trường `zalo_LONG_POLLING_ENABLED` (mặc định `true` để không làm thay đổi hành vi production hiện tại).
2. Chỉ đăng ký `zalografModule` và các provider xử lý update khi cờ này bật. Khi tắt, Nest API vẫn khởi động các route HTTP, scheduler và dịch vụ không phụ thuộc bot.
3. Bổ sung `zalo_LONG_POLLING_ENABLED` vào `.env.example`, kèm hướng dẫn chọn một môi trường duy nhất làm polling worker.
4. Cập nhật knowledge (English) và tài liệu vận hành (Vietnamese) về bất biến: một token chỉ có một long-poll consumer.
5. Chạy `npm run typecheck` và `npm run lint`; kiểm tra thủ công rằng `zalo_LONG_POLLING_ENABLED=false` không gọi zalograf polling, còn giá trị mặc định vẫn hoạt động như trước.

## Thiết kế

- Local API đang cần dashboard nhưng không cần nhận update zalo: đặt `zalo_LONG_POLLING_ENABLED=false` trong `.env.local`.
- Production bot worker: giữ cờ `true` (hoặc không khai báo do mặc định true).
- Nếu cần test bot local, dừng worker production trước hoặc dùng bot token riêng; cờ không thể cho hai instance cùng long-poll một token.

## Rủi ro và giảm thiểu

- Một service có `@InjectBot()` hiện vẫn được khởi tạo khi polling tắt có thể làm Nest DI lỗi. Khi thực thi sẽ rà các injection này và tách/đăng ký có điều kiện để API-only mode vẫn bootstrap an toàn.
- Do có thay đổi cách vận hành đa môi trường, cần cập nhật `.env` của deployment theo đúng vai trò bot worker.

## Tiêu chí hoàn thành

- Hai API cùng dùng token không còn gây 409 khi chỉ một nơi bật polling.
- API-only instance vẫn phục vụ route HTTP và scheduler theo phạm vi tương thích đã kiểm tra.
- Typecheck và lint đạt.

## Kết quả triển khai

- Đã thêm `zalo.longPollingEnabled`, đọc từ `zalo_LONG_POLLING_ENABLED` và mặc định `true`.
- `nestjs-zalograf` nhận `launchOptions: false` khi cờ tắt; bot object vẫn tồn tại cho các luồng gửi tin chủ động.
- Đã cập nhật log khởi động, `.env.example`, knowledge và runbook kiến trúc.

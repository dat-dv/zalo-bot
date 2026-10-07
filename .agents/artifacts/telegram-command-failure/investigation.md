# Điều tra lỗi lệnh zalo

## Hiện tượng

Bot vẫn phản hồi tin nhắn tự nhiên, nhưng `/start` và `/help` không trả lời.

## Bằng chứng

- Hai handler đã được đăng ký: `@Start()` cho `onStart` và `@Help()`/`@Command('help')` cho `onHelp`.
- Metadata đã biên dịch vẫn giữ đúng các listener trên.
- Cả hai handler đều gọi `getReportsUrl()` trước khi gửi bất kỳ phản hồi nào.
- `getReportsUrl()` luôn ghi một bản ghi token dùng một lần vào SQLite khi có `APP_URL`/`SERVICE_URL_zaloBOT`.
- Harness tái hiện từ mã biên dịch: khi thao tác ghi token ném lỗi, `/start` ném lỗi và số lần trả lời là `0`; khi ghi thành công, số lần trả lời là `1`.
- Cơ sở dữ liệu cục bộ có bảng `dashboard_exchange_tokens`; `typecheck` API đang đạt. Điều này không xác minh được quyền ghi hoặc log của môi trường đang chạy.

## Chẩn đoán

Nguyên nhân gần nhất có độ tin cậy cao là một lỗi trong nhánh tạo URL báo cáo/token một lần đã chặn toàn bộ `/start` và `/help`. Thiết kế hiện tại khiến một tính năng phụ (dashboard) trở thành điều kiện bắt buộc trước khi hai lệnh cơ bản có thể phản hồi.

Chưa đủ dữ liệu để khẳng định nguyên nhân sâu trong môi trường triển khai: cần log runtime đúng thời điểm gửi lệnh để xác định liệu lỗi ghi SQLite, schema/lock, hay lỗi dịch vụ token khác.

## Phạm vi ảnh hưởng

- `apps/api/src/zalo/zalo.update.ts`: `/start`, `/help`, luồng hoàn tất Google OAuth và nút báo cáo đều đi qua `getReportsUrl()`.
- `apps/api/src/reports/reports-token.service.ts`: ghi token trao đổi vào SQLite.

## Hướng khắc phục đề xuất

1. Làm `getReportsUrl()` chịu lỗi: nếu không tạo được URL báo cáo, ghi log có ngữ cảnh và trả về chuỗi rỗng để `/start`/`/help` vẫn trả lời.
2. Thêm kiểm thử hồi quy: lỗi tạo exchange token không được ngăn lời chào/hướng dẫn.
3. Sau khi triển khai, kiểm tra log runtime và khả năng ghi bảng `dashboard_exchange_tokens` để sửa nguyên nhân hạ tầng thực tế nếu còn.

## Xác minh đã chạy

- `npm run typecheck --workspace @zalobot/api` — đạt.
- Harness mô phỏng thành công/thất bại của `issueExchangeToken` — tái hiện việc handler không gửi phản hồi khi nhánh token lỗi.

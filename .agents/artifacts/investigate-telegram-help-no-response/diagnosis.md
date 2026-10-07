# Chẩn đoán `/help` không phản hồi

## Quan sát

- Người dùng báo bot không phản hồi khi gửi `/help`.
- Handler `onHelp` tồn tại ở `apps/api/src/zalo/zalo.update.ts` và không bị `AuthGuard` chặn.

## Bằng chứng

- Build API thành công.
- Harness cô lập gọi đúng handler đã xác nhận tạo một phản hồi an toàn.
- Metadata của `onHelp` đăng ký cả `command('help')` và `help`; đây không làm handler biến mất.
- Không có tiến trình/log production để kiểm tra trong workspace; chỉ có `.env` local, trong đó `zalo_LONG_POLLING_ENABLED=false`.

## Kết luận

Logic phản hồi `/help` hiện tại hoạt động khi handler được zalo chuyển đến. Nếu môi trường đang lỗi là local workspace này, long polling bị tắt nên bot không nhận bất kỳ tin nhắn đầu vào nào. Nếu lỗi là máy production, nguyên nhân chưa thể khẳng định chỉ từ repository; cần log runtime và xác nhận biến `zalo_LONG_POLLING_ENABLED` của deployment.

## Phát hiện phụ

`apps/api/scripts/check-zalo-command-fallback.cjs` đang truyền thiếu/misalign dependency constructor của `zaloUpdate`, nên fail với `this.configService.get is not a function`. Đây là lỗi của harness, không phải nguyên nhân runtime `/help`.

## Đề xuất

1. Bật `zalo_LONG_POLLING_ENABLED=true` trên instance cần nhận lệnh, hoặc cấu hình webhook nếu chủ đích tắt polling.
2. Restart/redeploy API sau khi build để chạy artifact mới.
3. Sửa harness để kiểm tra `/help` qua dependency mocks đúng thứ tự, rồi kiểm tra lại.

# Kế hoạch khắc phục bot không phản hồi `/help`

RequestFeedback: true

## Mục tiêu

Đảm bảo instance API hiện tại nhận update zalo bằng long polling và có regression check đáng tin cậy cho hai lệnh trả lời trực tiếp `/start` và `/help`.

## Phạm vi thay đổi

1. Đổi `zalo_LONG_POLLING_ENABLED` trong `.env` từ `false` sang `true` để instance đang cấu hình từ file môi trường của workspace thực sự nhận update zalo.
2. Sửa `apps/api/scripts/check-zalo-command-fallback.cjs` theo chữ ký constructor hiện tại của `zaloUpdate`: bổ sung đúng mocks cho `FinanceService`, `AuditService`, `ConfigService` và `ReportsTokenService`.
3. Mở rộng harness để xác minh riêng `/help` tạo một phản hồi; khi dịch vụ dashboard không khả dụng, `/start` và `/help` vẫn trả lời.
4. Giữ nguyên implementation handler `/help`: handler đã được kiểm tra hoạt động, AuthGuard cho phép và decorator đôi không phải nguyên nhân thiếu response.
5. Cập nhật hướng dẫn vận hành về yêu cầu long polling khi không dùng webhook, cùng knowledge/docs mapping tương ứng nếu hợp đồng vận hành thay đổi.

## Rủi ro và giới hạn

- Long polling chỉ được bật ở **một** instance dùng cùng bot token. Nếu production có webhook hoặc một worker polling riêng, bật polling tại instance đó có thể tạo xung đột; khi triển khai cần chỉ định đúng instance nhận update.
- Workspace không có quyền kiểm tra log hay process ở deployment từ xa, nên việc restart/redeploy vẫn là thao tác vận hành ngoài repository.
- Các thay đổi zalo UI đang staged là thay đổi độc lập của người dùng; chỉ bảo toàn, không sửa hoặc unstaged chúng.

## Xác minh sau khi thực hiện

1. `npm run build:api`
2. `node apps/api/scripts/check-zalo-command-fallback.cjs`
3. `npm run typecheck`
4. `npm run lint`
5. Khởi động đúng instance API, kiểm tra log có dòng `Listening for messages and commands on zalo (Long Polling)...`, sau đó gửi `/help` từ một user được cấp quyền.

## Tiêu chí hoàn thành

- Harness chạy xanh, gồm cả failure path của dashboard và response `/help`.
- Môi trường local được cấu hình để bot nhận update.
- Các thay đổi staging sẵn có không bị ảnh hưởng.

## Kết quả triển khai

- Đã đặt `zalo_LONG_POLLING_ENABLED=true` trong `.env` local.
- Đã sửa harness để inject đủ dependencies và kiểm tra riêng `/start`/`/help` khi dashboard link thất bại.
- Đã bổ sung hướng dẫn vận hành và knowledge về quyền sở hữu long polling.
- Đã chạy xanh: `npm run build:api`, `node apps/api/scripts/check-zalo-command-fallback.cjs`, `npm run typecheck`, `npm run lint`, và `git diff --check`.

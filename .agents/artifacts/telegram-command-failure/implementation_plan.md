# Kế hoạch sửa lỗi `/start` và `/help`

RequestFeedback: true

## Mục tiêu

Đảm bảo `/start` và `/help` vẫn gửi phản hồi khi không thể tạo link dashboard/token một lần.

## Phạm vi thay đổi

1. Cập nhật `apps/api/src/zalo/zalo.update.ts`.
   - Bọc thao tác tạo URL dashboard trong xử lý lỗi cục bộ.
   - Ghi log có ngữ cảnh khi không thể tạo link.
   - Trả về chuỗi rỗng để menu tiếp tục hiển thị, chỉ không có nút báo cáo.
   - Không thay đổi cơ chế token, schema SQLite, quyền truy cập, hay định dạng lệnh.
1. Bổ sung kiểm thử hồi quy tại vị trí phù hợp cho `zaloUpdate`.
   - Mô phỏng lỗi từ `issueExchangeToken`.
   - Xác nhận `onStart` và `onHelp` vẫn gọi gửi phản hồi, không ném lỗi.
   - Xác nhận không có link/nút báo cáo khi phần tạo token lỗi.
1. Cập nhật tài liệu kỹ thuật liên quan chỉ khi thay đổi này được xem là hợp đồng vận hành cần lưu; dự kiến không cần vì đây là xử lý lỗi nội bộ, không đổi API hay quy tắc nghiệp vụ.

## Rủi ro và cách giảm thiểu

- Rủi ro thấp: khi dashboard tạm lỗi, người dùng không thấy nút báo cáo trong phản hồi đó. Đây là hành vi có chủ đích để bảo toàn các lệnh cốt lõi.
- Không nuốt lỗi âm thầm: ghi log kèm `userId` và tên luồng để có thể xử lý nguyên nhân hạ tầng sau đó.
- Kiểm thử đảm bảo lỗi phụ không thể chặn `/start` hoặc `/help` trở lại.

## Xác minh sau khi sửa

1. Chạy kiểm thử hồi quy mới.
2. Chạy `npm run typecheck`.
3. Chạy `npm run lint`.
4. Rà soát diff để chắc chắn không tác động các thay đổi sẵn có trong `.gitignore` và `docs/deployment.md`.

## Tiêu chí hoàn thành

- Khi tạo exchange token thành công: `/start` và `/help` giữ menu báo cáo như hiện tại.
- Khi tạo exchange token thất bại: `/start` và `/help` vẫn phản hồi bình thường, không có nút báo cáo, và server có log chẩn đoán.

## Kết quả triển khai

- Đã bọc lỗi tạo exchange token trong `getReportsUrl()`. Lỗi được ghi kèm `userId`; hàm trả về chuỗi rỗng để menu không có nút báo cáo nhưng lệnh cốt lõi vẫn phản hồi.
- Đã thêm `apps/api/scripts/check-zalo-command-fallback.cjs`, mô phỏng lỗi ghi token cho cả `/start` và `/help`.
- Đã cập nhật tài liệu canonical và hướng dẫn vận hành dashboard.
- Đã xác minh: build API, regression check, typecheck workspace, lint workspace và agent-system validation đều đạt.
- `git diff --check` vẫn báo whitespace trong `.gitignore`; đây là thay đổi có sẵn, ngoài phạm vi nhiệm vụ, nên không sửa.

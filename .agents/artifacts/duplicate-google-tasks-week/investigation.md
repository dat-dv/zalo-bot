# Chẩn đoán: mục Google Tasks trùng trong `/week`

## Quan sát

- Ngày 23/08/2026, `/tasks` trả ba việc chưa hoàn thành: `Học Java`, `Học C#`, và `Học C# (ánh xạ bằng TS)`.
- `/week` cũng liệt kê cả ba việc; hai việc C# có nội dung ghi chú tương tự.

## Kết luận

Khả năng cao (cao) đây là hai bản ghi Google Tasks khác nhau được tạo ở các thao tác xác nhận khác nhau, không phải lỗi nhân đôi do `/week`.

### Bằng chứng mã nguồn

- `apps/api/src/google/google-tasks.service.ts` gọi Google Tasks API với `tasks.list`, lấy nguyên các mục chưa hoàn thành trong danh sách mặc định.
- `apps/api/src/gemini/tools/list-tasks.tool.ts` chuyển nguyên từng mục API thành kết quả cho Gemini; không gộp hoặc sao chép mục.
- `apps/api/src/zalo/zalo.update.ts` với lệnh `/tasks` cũng liệt kê mọi mục trả về và tạo nút hoàn thành theo `taskId`. Đây là lý do `/tasks` và `/week` cùng thể hiện ba mục.
- Hai mục C# khác nhau cả tiêu đề lẫn ghi chú, nên hiện không có quy tắc kỹ thuật nào để coi chúng là một.

## Phạm vi ảnh hưởng

- Danh sách `/tasks`, tóm tắt `/week` và Dashboard sẽ hiển thị mọi task chưa hoàn thành mà Google trả về.
- Không có cơ chế chống tạo task tương tự trước khi xác nhận thao tác `create_task` hoặc `create_tasks`.

## Kiểm tra tái lập

Đã thử chạy handler `/tasks` với fixture gồm đúng ba task để tạo tín hiệu khẳng định UI render cả ba. Lệnh TypeScript chạy trong môi trường hiện tại không trả stdout, nên chưa tạo được vòng lặp kiểm tra đỏ/xanh đủ chuẩn. Không dùng token Google của người dùng để gọi API thật.

## Hướng khắc phục đề xuất

1. Hoàn tất một trong hai task C# qua nút zalo hoặc Google Tasks nếu đó là việc bị tạo thừa; thao tác này sẽ làm cả `/tasks` và `/week` chỉ còn hai việc.
2. Nếu muốn ngăn lặp lại, trước lúc xếp thao tác tạo task hãy so sánh tiêu đề đã chuẩn hoá với task chưa hoàn thành, rồi cảnh báo/xin xác nhận rõ khi có mục giống hoặc gần giống. Cần giữ quyền cho người dùng tạo hai việc cùng chủ đề khi họ chủ ý.
3. Bổ sung test cho luồng cảnh báo trùng và test xác nhận rằng mỗi `taskId` được render đúng một lần.

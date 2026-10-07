---
metadata:
  agent-artifact:
    id: docs-global-google-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/global/google-tasks.md
---

# Google Tasks: tạo một hoặc nhiều việc

Bot yêu cầu xác nhận trước khi ghi Google Tasks.

Trước khi hiện hộp xác nhận, bot so sánh tiêu đề với tối đa 50 việc chưa hoàn thành (bỏ dấu, khoảng trắng và ký tự phân cách). Nếu tiêu đề trùng hoặc một tiêu đề là bản mở rộng của tiêu đề còn lại, bot hiện cảnh báo **Có thể trùng**. Đây chỉ là cảnh báo: người dùng vẫn bấm **Xác nhận** được vì hai việc cùng tên có thể là chủ ý.

- Mỗi task hỗ trợ cấu trúc chuẩn 3 phần: `title` (tiêu đề việc), `notes` (ghi chú/hướng dẫn chi tiết), và `due` (hạn chót hoàn thành định dạng ISO 8601). Thẻ xác nhận trên zalo hiển thị đầy đủ 3 trường này.
- Một việc dùng `create_task`.
- Danh sách nhiều việc độc lập dùng `create_tasks`; bot hiển thị một xác nhận cho toàn bộ danh sách.
- Sau khi xác nhận, các mục được tạo tuần tự. Google Tasks không hỗ trợ transaction nhiều mục, nên nếu lỗi giữa chừng bot phải báo rõ mục nào đã tạo và mục nào chưa tạo được.

Người dùng có thể xem việc bằng cả `/tasks` và `/task`. Với câu như “mua cà phê và cam”, hệ thống phải coi đây là hai mục độc lập, không phải một task có tiêu đề ghép.

## Kiểm tra

1. Gửi yêu cầu hai việc, xác nhận, rồi dùng `/tasks`: phải thấy đủ hai mục.
2. Mô phỏng Google Tasks lỗi ở một mục giữa danh sách: phản hồi phải hiển thị thành công một phần.
3. Dùng cả `/task` và `/tasks`: hai lệnh phải trả cùng danh sách.
4. Khi còn `Học C#`, tạo `Học C# (ánh xạ bằng TS)`: hộp xác nhận phải cảnh báo khả năng trùng nhưng vẫn có nút xác nhận; sau khi xác nhận chỉ tạo một task mới.

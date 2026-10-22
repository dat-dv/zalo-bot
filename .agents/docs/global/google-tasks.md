---
metadata:
  agent-artifact:
    id: docs-global-google-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/global/google-tasks.md
      - apps/api/src/zalo/text/strategies/create-task-tool.strategy.ts
      - apps/api/src/zalo/text/strategies/tasks-quick-tool.strategy.ts
      - apps/api/src/google/google-tasks.service.ts
      - apps/api/src/tasks/tasks.service.ts
---

# Việc cần làm: tạo và xem qua chat

Tài liệu canonical tương ứng: [`google-tasks.md`](../../knowledge/global/google-tasks.md).

Việc cần làm lưu trong bảng `tasks` của zalobot (danh sách chung cho mọi người); Google Tasks chỉ giữ bản sao. Chi tiết đồng bộ xem [`modules/tasks/README.md`](../modules/tasks/README.md).

## Nhắn tự nhiên (qua LLM)

Khi người dùng nhắn kiểu "thêm việc nộp báo cáo trước 17h", `LlmService` chọn tool `CREATE_TASK`. Mỗi lần gọi chỉ tạo **một** việc với 3 trường:

- `title`: tiêu đề việc (bắt buộc).
- `notes`: ghi chú chi tiết (tùy chọn).
- `due`: hạn chót dạng ISO 8601 (tùy chọn).

Hệ thống không có tool tạo nhiều việc cùng lúc. Ngoài ra còn `LIST_TASKS` (xem việc) và `COMPLETE_TASK` (đánh dấu hoàn thành, cũng phải xác nhận).

Không lệnh nào bắt buộc kết nối Google: chưa liên kết thì việc vẫn được lưu trong zalobot, chỉ chưa có trên Google Tasks.

## Vì sao phải xác nhận và cảnh báo trùng

Thêm việc là thay đổi dữ liệu dùng chung, nên bot tạo **thao tác chờ duyệt** với mã 3 số (duyệt bằng `yes <code>` hoặc thả tim như các thao tác khác). Trước khi tạo thẻ xác nhận, bot so sánh tiêu đề với tối đa 200 việc chưa hoàn thành trong DB:

- Chuẩn hóa tiêu đề: bỏ dấu, `đ`→`d`, chữ thường, ký tự phân cách thành khoảng trắng.
- Coi là có thể trùng nếu hai tiêu đề giống hệt sau chuẩn hóa, hoặc tiêu đề ngắn hơn (từ 2 từ trở lên) nằm trọn trong tiêu đề dài hơn.
- Nếu trùng, bot gửi thêm tin nhắn cảnh báo liệt kê các việc tương tự. Đây chỉ là cảnh báo: người dùng vẫn xác nhận được vì hai việc cùng tên có thể là chủ ý.

Sau khi xác nhận, việc được lưu vào DB kèm người tạo và nhóm chat nguồn, rồi sao chép vào danh sách mặc định (`@default`) của Google nếu đã kết nối; bot gợi ý gõ `/tasks` để xem toàn bộ.

Hoàn thành việc ("xong việc ...") tìm trong các việc chưa xong của DB. Mã duyệt cũ còn chờ trong Redis lúc triển khai (chứa id Google) vẫn chạy được vì hệ thống tìm cả theo id bản sao Google.

## Lệnh nhanh

- `/tasks`, `/task`, `/viec`: liệt kê tối đa 15 việc chưa hoàn thành kèm hạn và ghi chú.
- `/task <nội dung>`: tạo ngay một việc với tiêu đề đó, **không** qua xác nhận và không kiểm tra trùng — dùng khi người dùng chủ động gõ lệnh rõ ràng. Nếu việc chưa lên được Google, bot nói rõ trong tin trả lời.

## Kiểm tra

1. Nhắn "thêm việc nộp báo cáo", xác nhận mã, rồi gõ `/tasks`: phải thấy việc mới.
2. Khi đang có `Học C#`, nhắn tạo `Học C# (ánh xạ bằng TS)`: bot phải gửi cảnh báo trùng nhưng vẫn cho xác nhận; sau xác nhận chỉ tạo một việc mới.
3. Gõ `/task mua sữa`: việc được tạo ngay, không có thẻ xác nhận.
4. Dùng tài khoản chưa liên kết Google: việc vẫn được tạo và hiện trên `/tasks` với nhãn "Chỉ lưu trong app".

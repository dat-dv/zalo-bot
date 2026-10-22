---
metadata:
  agent-artifact:
    id: docs-global-google-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/global/google-tasks.md
      - apps/api/src/zca/text/strategies/create-task-tool.strategy.ts
      - apps/api/src/zca/text/strategies/tasks-quick-tool.strategy.ts
      - apps/api/src/tasks/task.types.ts
      - apps/api/src/tasks/tasks.service.ts
---

# Việc cần làm: tạo và xem qua chat

Tài liệu canonical tương ứng: [`google-tasks.md`](../../knowledge/global/google-tasks.md).

Việc cần làm chỉ lưu trong bảng `tasks` của zalobot (danh sách chung cho mọi người), **không** đồng bộ với Google Tasks. Lý do bỏ đồng bộ xem [`modules/tasks/README.md`](../modules/tasks/README.md). Tên file vẫn giữ `google-tasks.md` để link cũ không gãy.

## Nhắn tự nhiên (qua LLM)

Khi người dùng nhắn kiểu "thêm việc nộp báo cáo trước 17h", `LlmService` chọn tool `CREATE_TASK`. Mỗi lần gọi chỉ tạo **một** việc với 4 trường:

- `title`: tiêu đề việc (bắt buộc).
- `notes`: ghi chú chi tiết (tùy chọn).
- `due`: hạn chót dạng ISO 8601 (tùy chọn).
- `remindAt`: giờ bot nhắc việc này, dạng ISO (tùy chọn). Bot nhắc ngay trong cuộc trò chuyện đã nhắn, xem [nhắc việc](../modules/tasks/README.md#2-nhắc-việc).
- `remindSelf`, `remindMode` (tùy chọn): "nhắc tôi" thì tag người nhắn; "nhắn riêng" thì nhắn riêng từng người thay vì tag trong nhóm.

**Người được nhắc lấy từ tag thật**: ai được @tag trong tin ("3h chiều nhắc @Trí") thì được nhắc. AI không bao giờ tự đoán người theo tên, vì trong nhóm rất hay có người trùng tên và nhắc nhầm người còn tệ hơn không nhắc.

**Nhắc việc khác lời nhắc cá nhân**: "thêm việc làm slide, 3h chiều mai nhắc tôi" là một **việc cần làm** có giờ nhắc nên đi vào `CREATE_TASK` + `remindAt`; còn "3h chiều nhắc tôi đón con" không phải việc trong danh sách nên vẫn là `SET_REMINDER`. Mô tả tool và system prompt đã ghi rõ ranh giới này để LLM không chọn nhầm.

Hệ thống không có tool tạo nhiều việc cùng lúc. Ngoài ra còn `LIST_TASKS` (xem việc) và `COMPLETE_TASK` (đánh dấu hoàn thành, cũng phải xác nhận).

Không lệnh nào cần kết nối Google.

## Vì sao phải xác nhận và cảnh báo trùng

Thêm việc là thay đổi dữ liệu dùng chung, nên bot tạo **thao tác chờ duyệt** với mã 3 số (duyệt bằng `yes <code>` hoặc thả tim như các thao tác khác). Trước khi tạo thẻ xác nhận, bot so sánh tiêu đề với tối đa 200 việc chưa hoàn thành trong DB:

- Chuẩn hóa tiêu đề: bỏ dấu, `đ`→`d`, chữ thường, ký tự phân cách thành khoảng trắng.
- Coi là có thể trùng nếu hai tiêu đề giống hệt sau chuẩn hóa, hoặc tiêu đề ngắn hơn (từ 2 từ trở lên) nằm trọn trong tiêu đề dài hơn.
- Nếu trùng, bot gửi thêm tin nhắn cảnh báo liệt kê các việc tương tự. Đây chỉ là cảnh báo: người dùng vẫn xác nhận được vì hai việc cùng tên có thể là chủ ý.

Thẻ xác nhận có thêm dòng **Nhắc lúc**, **Nhắc ai**, **Cách nhắc**; tóm tắt sau khi duyệt có `⏰ nhắc HH:mm dd/MM · 👤 @Trí`.

Sau khi xác nhận, việc được lưu vào DB kèm người tạo và nhóm chat nguồn; bot gợi ý gõ `/tasks` để xem toàn bộ. Nếu lúc duyệt giờ nhắc đã trôi qua (thẻ có thể chờ tới 5 phút) hoặc LLM trả giờ sai định dạng, việc **vẫn được tạo** nhưng không có nhắc, thay vì làm hỏng cả thao tác.

Hoàn thành việc ("xong việc ...") tìm trong các việc chưa xong của DB theo id hoặc tiêu đề.

## Lệnh nhanh

- `/tasks`, `/task`, `/viec`: liệt kê tối đa 15 việc chưa hoàn thành kèm hạn và ghi chú.
- `/task <nội dung>`: tạo ngay một việc với tiêu đề đó, **không** qua xác nhận và không kiểm tra trùng — dùng khi người dùng chủ động gõ lệnh rõ ràng.

## Kiểm tra

1. Nhắn "thêm việc nộp báo cáo", xác nhận mã, rồi gõ `/tasks`: phải thấy việc mới.
2. Khi đang có `Học C#`, nhắn tạo `Học C# (ánh xạ bằng TS)`: bot phải gửi cảnh báo trùng nhưng vẫn cho xác nhận; sau xác nhận chỉ tạo một việc mới.
3. Gõ `/task mua sữa`: việc được tạo ngay, không có thẻ xác nhận.
4. Dùng tài khoản chưa liên kết Google: việc vẫn được tạo và hiện trên `/tasks` như bình thường.

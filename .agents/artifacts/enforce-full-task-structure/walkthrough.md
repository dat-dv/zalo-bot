# Walkthrough: Chuẩn Hóa Cấu Trúc Đầy Đủ (Title, Notes, Due) Cho Google Tasks

Đã triển khai hoàn tất việc chuẩn hóa và hỗ trợ đầy đủ 3 trường thông tin cho Task:

- **`title`**: Tiêu đề công việc cần làm ngắn gọn, rõ nghĩa.
- **`notes`**: Ghi chú chi tiết, hướng dẫn hoặc checklist các bước.
- **`due`**: Hạn chót hoàn thành (deadline) theo định dạng RFC 3339 / ISO 8601.

---

## Chi Tiết Các Thay Đổi Đã Thực Hiện

### 1. Cập Nhật Gemini Prompt Helper & Tool Declaration

- [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts):
  - Sửa lỗi layout thẻ xác nhận Google Tasks bị đan xen với thẻ Thu–Chi.
  - Bổ sung quy tắc bắt buộc AI luôn trích xuất và cung cấp đầy đủ cả 3 trường `title`, `notes`, `due` (chuyển đổi ngôn ngữ tự nhiên thành mốc ISO 8601 chính xác).
- [create-task.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-task.tool.ts) & [create-tasks.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-tasks.tool.ts):
  - Cập nhật schema parameters và mô tả rõ ràng để AI cung cấp đầy đủ chi tiết và hạn chót cho từng việc.

### 2. Cải Thiện Thẻ Giao Diện Xác Nhận Trên zalo

- [zalo-ui.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts):
  - Bổ sung helper `formatTaskDue` để format ngày giờ hạn chót tiếng Việt trực quan (`HH:mm - Thứ X, DD/MM/YYYY`).
  - Cập nhật `formatConfirmationBox`: Hiển thị rõ ràng cấu trúc 3 dòng gồm `📌 Tiêu đề`, `📝 Ghi chú`, `⏳ Hạn chót` kèm cảnh báo trùng lặp (nếu có).
  - Cập nhật `formatResultBox`: Hiển thị tên việc kèm hạn chót đã lưu.

### 3. Đồng Bộ Tài Liệu & Triển Khai Tests

- [zalo-ui.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts):
  - Thêm 3 unit tests mới cho `create_task` và `create_tasks` với cấu trúc đầy đủ.
- [knowledge/global/google-tasks.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/google-tasks.md) & [docs/global/google-tasks.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/google-tasks.md):
  - Cập nhật tài liệu knowledge và developer guide phản ánh quy chuẩn cấu trúc 3 trường.

---

## Kết Quả Kiểm Thử & Xác Minh

- **Unit Tests**: 21/21 tests passed (100%).
  ```bash
  npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/gemini/tools/create-tasks.tool.spec.ts apps/api/src/zalo/services/zalo-ui.service.spec.ts apps/api/src/google/google-tasks.service.spec.ts apps/api/src/gemini/gemini.service.spec.ts
  ```
- **Typecheck**: Passed với 0 lỗi trên toàn bộ các workspace (`@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
- **Linter**: Passed với 0 lỗi trên toàn bộ dự án.
- **Agent System Validation**: 82 artifacts, 146 dependencies, 0 cyclic groups passed.

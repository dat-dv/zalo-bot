# Chuẩn Hóa Cấu Trúc Đầy Đủ Cho Công Việc (Title, Notes, Due) Trên Google Tasks

Kế hoạch này thiết lập quy chuẩn bắt buộc và cải thiện trải nghiệm tạo công việc (Task) trong hệ thống, đảm bảo mọi task khi được tạo qua AI/zalo hoặc API đều có cấu trúc đầy đủ và rõ ràng gồm:

1. **`title`**: Tiêu đề công việc cần làm ngắn gọn, rõ nghĩa.
2. **`notes`**: Mô tả chi tiết, hướng dẫn thực hiện hoặc checklist con.
3. **`due`**: Hạn chót hoàn thành (deadline) theo định dạng chuẩn RFC 3339 / ISO 8601.

---

## Đánh Giá & Vấn Đề Hiện Tại

1. **System Instruction của Gemini AI (`gemini-prompt.helper.ts`)**:
   - Thẻ xác nhận mẫu của Google Tasks đang bị xáo trộn nội dung (bị xen lẫn với phần Thu–Chi).
   - Chưa nhấn mạnh yêu cầu AI phải luôn thu thập hoặc suy luận đầy đủ 3 thành phần: `title`, `notes`, `due` khi người dùng yêu cầu tạo việc.
2. **Giao diện xác nhận trên zalo (`zalo-ui.service.ts`)**:
   - `formatConfirmationBox` hiện tại chỉ hiển thị `title` và `notes`, hoàn toàn **bỏ quên trường `due` (hạn chót)** trong preview payload của `create_task` và `create_tasks`.
   - Kết quả sau khi tạo (`formatResultBox`) cũng chưa hiển thị hạn chót cho người dùng kiểm tra lại.
3. **Mô tả công cụ (`create-task.tool.ts`, `create-tasks.tool.ts`)**:
   - Cần bổ sung hướng dẫn chi tiết trong schema tool để Gemini nắm rõ quy tắc cấu trúc chuẩn hóa.

---

## User Review Required

> [!NOTE]
> Khi người dùng yêu cầu tạo việc nhưng **không đề cập hạn chót hoặc mô tả**, AI sẽ:
>
> - Tự động trích xuất ngữ cảnh thời gian nếu có (ví dụ: "trong hôm nay", "trước cuối tuần").
> - Nếu người dùng hoàn toàn không nhắc hạn chót, AI sẽ tạo với hạn chót mặc định cuối ngày hôm nay hoặc nhắc người dùng bổ sung deadline trên thẻ xác nhận.
> - Trên thẻ xem trước (Confirmation Box), nếu chưa có hạn chót sẽ hiển thị rõ ràng: `⏳ Hạn chót: Chưa đặt (hoặc ngày mặc định)`.

---

## Các Thay Đổi Dự Kiến

### 1. Gemini AI System Instruction & Tool Definitions

#### [MODIFY] [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)

- Sắp xếp lại cấu trúc thẻ xác nhận chuẩn cho Google Tasks.
- Bổ sung quy tắc bắt buộc cấu trúc 3 phần cho Google Tasks:
  - `title`: Hành động cụ thể.
  - `notes`: Ghi chú bổ sung hoặc chi tiết thực hiện.
  - `due`: Hạn chót định dạng RFC 3339 / ISO 8601 (luôn xác định rõ ngày giờ dựa trên neo thời gian hiện tại).

#### [MODIFY] [create-task.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-task.tool.ts) & [create-tasks.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-tasks.tool.ts)

- Cập nhật mô tả các trường trong `declaration` để AI ưu tiên cung cấp đầy đủ `title`, `notes`, `due`.

---

### 2. zalo UI & Confirmation Cards

#### [MODIFY] [zalo-ui.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)

- Cập nhật `formatConfirmationBox` cho `create_task` và `create_tasks`:
  - Hiển thị từng công việc với cấu trúc 3 dòng trực quan:
    - 📌 **Tiêu đề**: `title`
    - 📝 **Ghi chú**: `notes` (hoặc `Không có`)
    - ⏳ **Hạn chót**: `due` được format đẹp theo định dạng ngày giờ tiếng Việt (ví dụ: `23:59 - Thứ Hai, 24/08/2026` hoặc `Chưa đặt`)
  - Giữ nguyên cảnh báo trùng lặp tiềm ẩn (`duplicateWarnings`).
- Cập nhật `formatResultBox` cho `create_task` / `create_tasks` để hiển thị tóm tắt công việc đã tạo kèm hạn chót.

---

### 3. Unit Tests & Quality Assurance

#### [MODIFY] [zalo-ui.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts)

- Bổ sung unit test kiểm tra `formatConfirmationBox` hiển thị đầy đủ `title`, `notes`, `due` (cả trường hợp có và không có hạn chót).
- Kiểm tra format ngày giờ hạn chót chuẩn tiếng Việt.

---

## Verification Plan

### Automated Tests

- Chạy unit tests:
  ```bash
  npx tsx --test apps/api/src/gemini/tools/create-tasks.tool.spec.ts apps/api/src/zalo/services/zalo-ui.service.spec.ts
  ```
- Kiểm tra typecheck toàn dự án:
  ```bash
  npm run typecheck
  ```
- Kiểm tra linting:
  ```bash
  npm run lint
  ```
- Kiểm tra tính toàn vẹn hệ thống agent:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Gửi yêu cầu tạo task với đầy đủ tiêu đề, ghi chú và hạn chót.
- Kiểm tra thẻ xem trước trên zalo hiển thị đầy đủ 3 trường `title`, `notes`, `due`.
- Bấm [Xác nhận] và kiểm tra task được tạo trên Google Tasks với đúng thông tin.

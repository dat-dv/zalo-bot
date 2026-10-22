# Walkthrough: Ô "Nhắc ai" luôn hiện và bắt buộc khi có giờ nhắc

Branch: `feat/remind-users-required` (worktree `.claude/worktrees/remind-users`), tách từ `main` `ab59125`.

## Đã làm

- **API:**
  - `ReminderTargetService.resolve`: kênh là nhóm mà không có người ⇒ 400 `Chọn ít nhất một người được nhắc trong nhóm.` Kiểm tra chỉ chạy khi tạo hoặc đổi đích, nên dữ liệu cũ (nhóm không người) vẫn gửi được và vẫn sửa được các trường khác.
  - Chat riêng giữ nguyên `users = []`: người được nhắc là chính người của chat đó.
- **Bot:**
  - Thêm `reminderUsersOrSender`: trong nhóm, không tag ai ⇒ nhắc người nhắn; chat riêng ⇒ không cần người.
  - Dùng trong `CreateTaskToolStrategy` và `SetReminderToolStrategy`.
  - Mô tả tham số `remindInGroup` được cập nhật theo hành vi mới.
- **Web:**
  - `buildReminderTargetFields` trả thêm lỗi `usersRequired`; thêm `REMINDER_TARGET_ERROR_MESSAGES` và `privateRecipient`.
  - Form việc cần làm thêm lỗi `remindUsersRequired`; form lời nhắc thêm `usersRequired`.
  - `ReminderTargetFields` luôn hiện ô **Nhắc ai**:
    - chưa có kênh: gợi ý chọn kênh;
    - chat riêng: hiện sẵn người đó;
    - nhóm: bắt buộc chọn, có lỗi đỏ khi thiếu.
  - Hai dialog tạo và hai luồng sửa trong bảng báo đúng lỗi.
- **i18n (vi/en):** sửa `reminderTarget.usersHint`; thêm `usersRequired`, `usersPickChannel`, `usersPrivate`, `selfPerson`.
- **Docs:** cập nhật knowledge và docs của reminders, tasks, dashboard, và mục **Người được nhắc** trong CONTEXT.md.

## Kiểm chứng

- API: typecheck, lint và test (622) đều pass; build pass.
- Web: typecheck, lint và test (119) đều pass; build pass.
- Contracts: typecheck và lint pass (gói này không có script test).
- `docs-drift-check`: PASS.
- **Chưa thử tay giao diện:** browser pane không mở được dev server local. Cần xem lại trên prod sau khi deploy.

## Thay đổi hành vi

- "nhắc cả nhóm" không tag ai ⇒ tin vẫn vào nhóm nhưng tag người nhắn.
- Dashboard không còn cách nhắc nhóm mà không tag ai.

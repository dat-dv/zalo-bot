# Walkthrough: Chặn đích nhắc là ID Zalo Bot cũ, việc cần làm luôn hiện "Gửi tới / Nhắc ai"

Branch: `fix/legacy-bot-id-reminder-target`, worktree `.claude/worktrees/legacy-bot-id`, tách từ `main` (`446bf02`).

## Đã làm

- `apps/api/src/users/legacy-zalo-bot-id.ts` (mới): hàm `isLegacyZaloBotId` nhận diện ID có đúng 20 ký tự hex và ít nhất một chữ a–f, để UID ZCA toàn số không bị nhận nhầm.
- `ReminderTargetService`:
  - `hasZaloAccount` trả false cho cả ID cũ, nên ID cũ không còn kênh `isSelf` và tạo nhắc mà không chọn kênh thì báo 400.
  - `deliver` bỏ qua đích là ID cũ (ghi cảnh báo, không retry).
- `UserMergeService.merge` chuyển thêm:
  - người tạo của `tasks` và `calendar_events`;
  - `reminders.chat_id` và `tasks.remind_chat_id` đang trỏ vào ID nguồn;
  - ID nguồn trong `remind_users` (hàm `replaceRemindUser`).
  
  Không đổi contract preview.
- Web: `create-task-dialog.tsx` và `tasks-table.tsx` luôn hiện `ReminderTargetFields`, giống lời nhắc.
- Test mới hoặc bổ sung: `legacy-zalo-bot-id.spec.ts`, `reminder-target.service.spec.ts`, `reminders.service.spec.ts`, `user-merge.service.spec.ts`, `task-create-form.spec.ts`.
- Cập nhật knowledge/docs của reminders, tasks, users, dashboard và CONTEXT.md.

## Quyết định theo đề xuất (anh chưa trả lời riêng)

1. Gộp tài khoản chuyển luôn người tạo của việc cần làm và sự kiện lịch.
2. Không tự sửa dữ liệu prod.
3. "Nhắc ai" áp mức (a): luôn hiện phần chọn đích; chỉ bắt chọn kênh khi không có kênh mặc định; không bắt chọn người.

## Kiểm chứng

- API: typecheck, lint, test và build đều pass.
- Web: typecheck, lint, test (117) và build đều pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Chưa thử tay trên dashboard; chưa merge và chưa deploy.

## Việc còn lại sau deploy (thao tác của anh)

Gộp `573462d8909179cf2080` vào UID ZCA của anh trên `/zca`, hoặc sửa "Hello Morning !" và chọn kênh.

# Kế hoạch: Ô "Nhắc ai" luôn hiện và bắt buộc khi có giờ nhắc (việc cần làm + lời nhắc)

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Mức rủi ro: **MEDIUM**. Đổi quy tắc nghiệp vụ "Người được nhắc" ở cả API, bot và web. Không đổi schema DB, không có migration. Contract chỉ thêm chuỗi i18n.
- Branch: `feat/remind-users-required` trong worktree riêng, tách từ `main` mới nhất (`ab59125`).

## 1. Yêu cầu (đã chốt)

1. Việc cần làm vẫn **được phép không có nhắc**. Lời nhắc thì luôn có giờ nhắc như hiện nay.
2. Ô **Nhắc ai** luôn hiện trong form tạo và form sửa, ở cả việc cần làm và lời nhắc.
3. Khi có giờ nhắc thì **bắt buộc có người được nhắc**:
   - **Nhóm:** chọn ít nhất 1 người (tối đa 10 như cũ).
   - **Chat riêng:** người được nhắc chính là người của chat đó. Hiện sẵn, không chọn.
4. Tạo từ Zalo trong **nhóm** mà không tag ai ⇒ người được nhắc là **người nhắn**.

## 2. Hiện trạng (đã kiểm tra)

- `ReminderTargetFields` (web) chỉ hiện "Nhắc ai" khi kênh là nhóm. Hint ghi "Không chọn ai thì bot gửi vào nhóm, không tag."
- `buildReminderTargetFields` (web) và `ReminderTargetService.resolve` (API) đều cho phép nhóm có 0 người.
- Bot:
  - `CreateTaskToolStrategy`: nhắc vào chat đang nhắn; người được nhắc = người được tag (+ người nhắn nếu "nhắc tôi"). Không tag ai thì 0 người.
  - `SetReminderToolStrategy`: mặc định chat riêng của người nhắn. Chỉ vào nhóm khi có tag hoặc "nhắc cả nhóm"; "nhắc cả nhóm" mà không tag ai thì 0 người.
- CONTEXT.md, mục **Người được nhắc**: "Chat riêng thì không chọn người", và không nói nhóm bắt buộc có người.

## 3. Thay đổi

### 3.1 API: `reminders/reminder-target.service.ts`

- Trong `resolve(...)`: sau khi tính `users`, nếu kênh là nhóm và `users.length === 0` ⇒ `BadRequestException('Chọn ít nhất một người được nhắc trong nhóm.')`.
  - `resolve` chỉ chạy khi đích được tạo hoặc thay đổi: tạo nhắc có giờ, sửa đích, hoặc thêm giờ cho việc chưa có đích. Vì vậy việc và lời nhắc **cũ** đang gửi vào nhóm mà không có người vẫn chạy bình thường cho tới khi bị sửa đích.
  - Chat riêng giữ nguyên `users = []` trong DB. Không đổi dữ liệu, không đổi cách gửi: tin vào chat riêng thì không cần tag.
- `deliver` giữ nguyên, vẫn gửi được đích cũ không có người.

### 3.2 Bot: tạo từ Zalo không tag ai thì nhắc người nhắn

- `zca/text/reminder-target-args.util.ts`: thêm `reminderUsersOrSender(context, includeSender)`. Hàm trả về người được tag (+ người nhắn nếu "nhắc tôi"); nếu danh sách rỗng **và** đang ở nhóm thì trả `[người nhắn]` (tên = `displayName`).
  - Nhận biết nhóm: `context.chatId !== context.senderId`. Với ZCA, chat riêng có `chatId` là UID của người nhắn.
- `CreateTaskToolStrategy`: có giờ nhắc thì dùng hàm mới. Trong nhóm, không tag ai ⇒ tag người nhắn. Chat riêng ⇒ không người (là chính họ).
- `SetReminderToolStrategy`: khi vào nhóm ("nhắc cả nhóm" hoặc có tag) thì dùng hàm mới. Vì vậy **"nhắc cả nhóm" mà không tag ai sẽ đổi thành: tin vẫn gửi vào nhóm nhưng tag người nhắn** (trước đây không tag ai). Không vào nhóm thì vẫn gửi chat riêng như cũ.
- Thẻ xác nhận và tóm tắt (`compact-summary.util.ts`, `dto-descriptor.util.ts`) đã hiện "Nhắc ai" khi có người nên không cần sửa.
- Cập nhật mô tả tham số `remindInGroup` / `remindSelf` trong `ZALO_TOOL_DEFINITIONS` (nếu đang ghi "không tag ai thì nhắc cả nhóm") cho đúng hành vi mới.

### 3.3 Web: model (`apps/web/src/modules/reminders/model/reminder-target.ts`)

- `ReminderTargetResult` thêm lỗi `'usersRequired'`. `buildReminderTargetFields` trả lỗi này khi kênh là nhóm và `userIds` rỗng.
- `task-create-form.ts`: thêm lỗi `remindUsersRequired`, map từ `usersRequired`. Chỉ xét khi có giờ nhắc (không giờ thì bỏ qua đích như hiện nay).
- `reminder-create-form.ts`: thêm lỗi `usersRequired`.
- Thêm helper thuần `privateRecipientName(channels, chatId)`: trả tên người của chat riêng ("Bạn" nếu là `isSelf`) để hiện ở ô Nhắc ai.

### 3.4 Web: `ReminderTargetFields` (`dashboard/presentation/components/reminder-target-fields.tsx`)

Ô **Nhắc ai \*** luôn hiện:

| Kênh | Ô Nhắc ai |
| --- | --- |
| Chưa chọn | Gợi ý: `Chọn kênh nhận nhắc trước.` |
| Chat riêng | Chỉ đọc: `👤 <tên>` (chat riêng của mình thì `Bạn`), kèm hint `Chat riêng: nhắc chính người này.` |
| Nhóm | Danh sách thành viên như hiện tại; hint đổi thành `Chọn ít nhất 1 người.`; prop mới `showUsersRequired` ⇒ báo lỗi đỏ |

"Cách nhắc" vẫn chỉ hiện khi nhóm có người.

Các nơi dùng:
- `create-task-dialog.tsx`, `create-reminder-dialog.tsx`: truyền `showUsersRequired`.
- `tasks-screen.tsx`, `reminders-screen.tsx` (sửa trong bảng): `usersRequired` ⇒ toast `reminderTarget.usersRequired`, giữ chế độ sửa.

### 3.5 Contracts i18n (`packages/contracts/src/index.ts`, vi + en)

- Sửa `reminderTarget.users`: `Nhắc ai` / `Who to remind`. Dấu `*` thêm ở UI, không đưa vào chuỗi.
- Sửa `reminderTarget.usersHint`: `Chọn ít nhất 1 người.` / `Pick at least one person.`
- Thêm:
  - `reminderTarget.usersRequired`: `Chọn ít nhất một người được nhắc trong nhóm.` / `Pick at least one person to remind in the group.`
  - `reminderTarget.usersPickChannel`: `Chọn kênh nhận nhắc trước.` / `Choose the chat first.`
  - `reminderTarget.usersPrivate`: `Chat riêng: nhắc chính người này.` / `Private chat: reminds this person.`
  - `reminderTarget.selfPerson`: `Bạn` / `You`.

### 3.6 Kiểm thử

- API:
  - `reminder-target.service.spec.ts`: nhóm không người ⇒ 400; nhóm 1 người ⇒ ok; chat riêng ⇒ ok, `users` rỗng; đích cũ nhóm không người vẫn `deliver` được.
  - `reminders.service.spec.ts` và `tasks.service.spec.ts`: tạo vào nhóm không người ⇒ 400. Sửa tiêu đề của việc/lời nhắc cũ (nhóm không người) ⇒ vẫn lưu được.
  - Spec mới hoặc bổ sung cho `reminder-target-args.util`: nhóm không tag ⇒ người nhắn; nhóm có tag ⇒ chỉ người được tag; chat riêng ⇒ rỗng.
  - Sửa các spec hiện có đang dựa vào "nhóm không người" (sẽ rà khi chạy test).
- Web: `reminder-target.spec.ts`, `task-create-form.spec.ts`, `reminder-create-form.spec.ts` thêm case `usersRequired` và case chat riêng hợp lệ.
- Lệnh: `npm run typecheck`, `lint`, `test` cho `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`; `npm run build` cho api và web; `node .claude/hooks/docs-drift-check.mjs`.

### 3.7 Tài liệu (Hard Completion Gate)

| Knowledge (EN) | Docs (VI) |
| --- | --- |
| `modules/reminders/README.md` (Reminder targets: users bắt buộc với nhóm, mặc định người nhắn từ Zalo) | `docs/modules/reminders/README.md` |
| `modules/tasks/README.md` (form, bot) | `docs/modules/tasks/README.md` |
| `modules/dashboard/README.md` (`ReminderTargetFields`) | `docs/modules/dashboard/README.md` |
| `modules/zca/...` nếu có mô tả strategy nhắc | tương ứng |

CONTEXT.md, mục **Người được nhắc**: "Khi có nhắc thì bắt buộc có người được nhắc: nhóm chọn 1–10 người; chat riêng là chính người của chat đó. Trên Zalo lấy từ người được tag; không tag ai thì là người nhắn." Bỏ câu "Chat riêng thì không chọn người".

## 4. Ảnh hưởng và rủi ro

- Lời nhắc / nhắc việc **cũ** đang trỏ vào nhóm mà không có người: vẫn gửi được. Muốn đổi kênh hoặc người thì phải chọn ít nhất 1 người. Không tự sửa dữ liệu cũ.
- Hành vi bot thay đổi: "nhắc cả nhóm" không tag ai sẽ tag người nhắn; tạo việc có giờ nhắc trong nhóm mà không tag ai sẽ tag người nhắn.
- Không có cách "nhắc cả nhóm không tag ai" trên dashboard nữa. Đây là hệ quả trực tiếp của yêu cầu.

## 5. Ngoài phạm vi

- Không dùng `@All` của Zalo.
- Không migration dữ liệu cũ.
- Không đổi cách gửi (`deliver`).

## 6. Kiểm chứng sau khi làm

Thử tay trên dashboard (local build hoặc prod sau deploy):
- Tạo việc, chọn nhóm, không chọn ai ⇒ báo lỗi và không lưu được.
- Chọn 1 người ⇒ lưu được.
- Chọn chat riêng ⇒ ô Nhắc ai hiện tên người đó.

Phần thử trên Zalo cần anh tự nhắn bot.

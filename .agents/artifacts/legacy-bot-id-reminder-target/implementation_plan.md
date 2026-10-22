# Kế hoạch: Không cho lời nhắc/nhắc việc mặc định gửi tới ID 20 hex của Zalo Bot cũ

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Mức rủi ro: **MEDIUM** (đổi hành vi mặc định khi tạo nhắc, đổi thao tác gộp tài khoản, đổi form tạo/sửa việc trên web; không đổi schema, không đổi contract API)
- Branch đề xuất: `fix/legacy-bot-id-reminder-target`, tách từ `main` (`446bf02`).
  - Checkout hiện có 14 file `apps/web` đang sửa dở của một việc khác (`mobile-compact-toolbar-controls`). Plan này **không đụng** tới các file đó; lúc commit chỉ `git add` đúng file của plan.

## 1. Lỗi và nguyên nhân gốc

- Lời nhắc "Hello Morning !" trên prod không có `chat_id`, nên `reminderTarget()` fallback về `row.userId = 573462d8909179cf2080`. Đây là ID 20 hex theo app của Zalo Bot chính thức đã bị bỏ. ZCA không gửi được tới ID này nên tin không bao giờ tới.
- **Gốc ở code:** hàm `hasZaloAccount()` (`reminders/reminder-target.service.ts:52`) chỉ loại `dashboard-owner`. Vì vậy ID cũ vẫn bị coi là "có tài khoản Zalo", dẫn tới ba hệ quả:
  1. `listChannels` đưa ID cũ vào danh sách kênh với nhãn "chat riêng của tôi" (`isSelf`).
  2. `resolve` dùng ID cũ làm kênh mặc định (lời nhắc: `self`; nhắc việc trên dashboard: chat riêng) mà không bắt chọn kênh.
  3. `deliver` cố gửi tới ID cũ, thất bại, rồi BullMQ thử lại 5 lần một cách vô ích.
- **Gốc ở dữ liệu:** tài khoản dashboard anh đang dùng chính là user ID cũ (`/api/me`). Gộp tài khoản (`UserMergeService.merge`) đã chuyển `reminders.user_id` sang ID mới, nhưng **không** chuyển:
  - `reminders.chat_id`,
  - `tasks.remind_chat_id`,
  - các người được nhắc trong `remind_users`.
  
  Lý do là tính năng gộp có từ trước khi có đích nhắc và nhắc việc. Nếu gộp ngay bây giờ, lời nhắc nào đã lưu kênh là ID cũ vẫn sẽ tiếp tục gửi tới ID cũ.

## 2. Thay đổi đề xuất

### 2.1 Nhận diện ID cũ: `apps/api/src/users/legacy-zalo-bot-id.ts` (mới)

```ts
/** App-scoped id of the removed official Zalo Bot webhook (20 hex chars); ZCA cannot message it. */
export function isLegacyZaloBotId(id: string): boolean
```

- Điều kiện: đúng 20 ký tự `[0-9a-f]` **và có ít nhất một chữ `a–f`**.
  - UID ZCA là chuỗi toàn số (hiện 18–19 chữ số). Nếu sau này có UID dài 20 chữ số thì vẫn không bị nhận nhầm.
  - Đánh đổi: một ID cũ ngẫu nhiên mà toàn chữ số (xác suất khoảng (10/16)^20, tức cỡ 0,0001%) sẽ bị bỏ sót. Chấp nhận được.
- Đặt cạnh `users/dashboard-owner.ts`, để module tasks và reminders dùng được mà không phải import `UsersService`.

### 2.2 `reminders/reminder-target.service.ts`

| Chỗ | Thay đổi |
| --- | --- |
| `hasZaloAccount(userId)` | Trả `false` cho cả `dashboard-owner` **và** ID cũ. Đổi doc comment thành "has a Zalo account ZCA can message". |
| `listChannels` | Theo `hasZaloAccount`, nên user ID cũ **không còn mục "chat riêng của tôi"**, giống `dashboard-owner`. Web đã xử lý được trường hợp không có kênh `isSelf` nên không cần sửa web. |
| `resolve` | Theo `hasZaloAccount`: user ID cũ tạo nhắc trên dashboard mà không chọn kênh ⇒ 400 `Chọn kênh Zalo nhận nhắc.` (giống chủ hệ thống). Chọn kênh đang listen thì vẫn tạo được. |
| `deliver` | Đích là `dashboard-owner` hoặc ID cũ ⇒ trả `skipped` và log cảnh báo `Skipped a reminder addressed to a legacy Zalo Bot id …`, **không retry**. Dùng chung một kiểm tra `!hasZaloAccount(target.chatId)`. |

Lời nhắc cũ đang trỏ tới ID cũ sẽ không gửi được nữa nhưng có log rõ ràng (hiện tại cũng không tới, chỉ là thất bại âm thầm). Muốn chúng gửi được thì sửa dữ liệu theo mục 3.

### 2.3 `users/user-merge.service.ts`: gộp tài khoản chuyển luôn đích nhắc

Trong cùng transaction `merge`, thêm:
- `reminders.chat_id = source` ⇒ `target`.
- `tasks.remind_chat_id = source` ⇒ `target`.
- `remind_users` (jsonb) của `reminders` và `tasks`: phần tử có `id = source` ⇒ đổi `id` thành `target`, giữ `name`. Bỏ phần tử trùng nếu target đã có trong danh sách. Viết bằng hàm thuần `replaceRemindUser(users, sourceId, targetId)` để test được, chỉ cập nhật những dòng có chứa source.
- Không đổi contract `IUserMergeSummary` (`counts` giữ nguyên các khóa), để không phải sửa web merge dialog đang nằm trong file web người khác đang sửa.

**Ngoài phạm vi (cần anh chốt, xem mục 6):** chuyển người tạo của `tasks` và `calendar_events` (`created_by_user_id`). CONTEXT.md hiện chỉ liệt kê "người tạo giao dịch, liên kết người liên quan, lời nhắc, token Google".

### 2.4 Web: việc cần làm luôn có phần "Gửi tới / Nhắc ai" giống lời nhắc (bổ sung theo yêu cầu)

**Hiện trạng:** cả hai form dùng chung `ReminderTargetFields` và cùng logic `buildReminderTargetFields`, nhưng:

| Chỗ | Lời nhắc | Việc cần làm |
| --- | --- | --- |
| Dialog tạo | `create-reminder-dialog.tsx`: **luôn hiện** "Gửi tới", "Nhắc ai" (nhóm), "Cách nhắc" | `create-task-dialog.tsx:121`: **chỉ hiện khi đã nhập giờ nhắc** (`hasReminderTime(...) &&`) |
| Sửa trong bảng | `reminders-table.tsx`: cột "Gửi tới" riêng, luôn có khi sửa | `tasks-table.tsx:310`: cũng ẩn cho tới khi có giờ nhắc |

Hệ quả: người dùng tạo việc không thấy chỗ "nhắc ai". Với tài khoản không có chat riêng (chủ hệ thống, hoặc ID cũ sau bản sửa 2.2), phải nhập giờ xong mới biết là cần chọn kênh.

**Thay đổi:**
- `create-task-dialog.tsx`: bỏ điều kiện `hasReminderTime`, luôn hiện `ReminderTargetFields` ngay dưới giờ nhắc như dialog lời nhắc. Thêm dấu `*` vào nhãn "Giờ nhắc" **không** cần, vì việc cần làm vẫn được phép không có nhắc.
- `tasks-table.tsx` (sửa trong bảng): cũng bỏ điều kiện, luôn hiện phần đích nhắc khi đang sửa ô nhắc.
- Kiểm tra giữ nguyên như lời nhắc: nếu có giờ nhắc mà không có kênh mặc định thì bắt chọn kênh (`remindChannelRequired`); không có giờ nhắc thì phần đích nhắc bị bỏ qua khi gửi request (đúng như `buildCreateTaskRequest` hiện tại).
- Hai file này **không** nằm trong danh sách file web đang bị việc `mobile-compact-toolbar-controls` sửa dở. `tasks-screen.tsx` thì có, nên **không đụng** vào file đó.
- Không đổi API, contract hay chuỗi i18n.

**Kiểm thử web:** `task-create-form.spec.ts` thêm case "có giờ, không có kênh mặc định, không chọn kênh ⇒ `remindChannelRequired`" và "không có giờ ⇒ bỏ qua đích" (nếu chưa có). Chạy `npm run typecheck|lint|test|build --workspace @zalobot/web`. Thử tay trên dashboard: mở dialog tạo việc, phần "Gửi tới" hiện ngay.

### 2.5 Kiểm thử API

- `users/legacy-zalo-bot-id.spec.ts`: `573462d8909179cf2080` ⇒ true; `2099328425338516056` / `20 chữ số` / `dashboard-owner` / 19 hoặc 21 ký tự hex ⇒ false.
- `reminders/reminder-target.service.spec.ts` (thêm case):
  - `listChannels('573462d8909179cf2080')` không có kênh `isSelf`.
  - `resolve` với actor ID cũ, không chọn kênh ⇒ `BadRequestException`; chọn `g1` ⇒ ok.
  - `deliver` tới ID cũ ⇒ `skipped`, không gọi messenger.
- `reminders/reminders.service.spec.ts`: tạo lời nhắc từ dashboard bằng user ID cũ mà không chọn kênh ⇒ 400.
- `users/user-merge.service.spec.ts`: sau khi gộp, `reminders.chat_id`, `tasks.remind_chat_id` và `remind_users` trỏ sang target; dòng không liên quan giữ nguyên.
- Chạy: `npm run typecheck`, `lint`, `test`, `build` cho `--workspace @zalobot/api`; sau đó `node .claude/hooks/docs-drift-check.mjs`.

### 2.6 Tài liệu (Hard Completion Gate)

| Knowledge (EN) | Docs (VI) |
| --- | --- |
| `modules/reminders/README.md` (Reminder targets: default chat, `deliver` skip) | `docs/modules/reminders/README.md` |
| `modules/tasks/README.md` (default target trên dashboard; form tạo/sửa việc luôn hiện đích nhắc) | `docs/modules/tasks/README.md` |
| `modules/users/README.md` (Account Merge: thêm đích nhắc) | `docs/modules/users/README.md` |
| `CONTEXT.md`: **Kênh nhận nhắc** thêm "người dùng chỉ có ID Zalo Bot cũ cũng phải tự chọn kênh"; **Gộp tài khoản** thêm "đích nhắc" | — |

## 3. Sửa dữ liệu trên prod (thao tác của anh, không nằm trong code)

Sau khi deploy, làm **một** trong hai cách:

1. **Gộp tài khoản (khuyên dùng):** vào `/zca`, gộp `573462d8909179cf2080` vào UID ZCA của anh (`2099328425338516056`).
   - Sau khi gộp, lời nhắc, người tạo giao dịch, token Google và (nhờ bản sửa này) đích nhắc đều về UID mới. "Hello Morning !" sẽ gửi vào chat Zalo thật của anh.
   - **Lưu ý:** gộp không hoàn tác được. Phiên dashboard đang dùng ID cũ sẽ mất hiệu lực, nên anh cần lấy link đăng nhập mới từ bot (lệnh dashboard trên Zalo). Phiên prod trong browser pane của em cũng mất theo.
2. **Chỉ sửa lời nhắc:** vào `/reminders`, sửa "Hello Morning !" và chọn kênh là chat Zalo của anh. Không đụng tới tài khoản.

## 4. Kiểm chứng sau deploy

- Trên dashboard (tài khoản ID cũ, nếu chưa gộp): form tạo lời nhắc không còn mục chat riêng của tôi, và lưu mà không chọn kênh thì báo `Chọn kênh Zalo nhận nhắc.`
- Log API lúc 13:35 không còn lỗi gửi hay retry của "Hello Morning !"; thay vào đó có cảnh báo skip (nếu chưa sửa dữ liệu), hoặc tin tới chat Zalo (nếu đã sửa).

## 5. Ngoài phạm vi

- Không sửa web ngoài `create-task-dialog.tsx` và `tasks-table.tsx` (UI đã xử lý được trường hợp không có kênh `isSelf`; các file web khác đang bị việc khác sửa dở).
- Không tự gộp tài khoản hay sửa dữ liệu prod.
- Không thêm migration để dọn hàng loạt lời nhắc trỏ tới ID cũ.
- Không hiện cảnh báo "kênh nhận không gửi được" trên trang `/reminders` (có thể làm sau).

## 6. Câu hỏi cần anh chốt

1. Gộp tài khoản có chuyển luôn **người tạo** của việc cần làm và sự kiện lịch không? Em đề xuất **có**, cho nhất quán với giao dịch. Việc này thêm 2 lệnh update và cập nhật CONTEXT.md.
2. Sửa dữ liệu prod theo cách 1 (gộp tài khoản) hay cách 2 (chỉ sửa lời nhắc)?
3. "Bắt buộc nhắc ai" hiểu theo mức nào?
   - **(a) Em đề xuất:** việc cần làm luôn hiện phần "Gửi tới / Nhắc ai" và bắt chọn kênh khi không có mặc định, đúng như lời nhắc hiện tại. Trong nhóm, chọn người vẫn không bắt buộc; không chọn ai thì bot nhắc chung cả nhóm.
   - **(b) Chặt hơn:** khi kênh là nhóm thì bắt buộc chọn ít nhất 1 người được nhắc. Áp cho cả việc cần làm **và** lời nhắc, để hai bên vẫn giống nhau. Cần thêm lỗi `remindUsersRequired`, một chuỗi i18n và kiểm tra ở API (`resolve`). Riêng nhắc tạo từ Zalo mà không tag ai thì bị từ chối hoặc phải tự tag người nhắn.

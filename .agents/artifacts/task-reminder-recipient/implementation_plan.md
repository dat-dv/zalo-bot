# Kế hoạch: Chọn nhóm và người được nhắc cho Nhắc việc **và** Nhắc nhở

- Route: implement · Phase 1 (Planning) · Risk: **HIGH** (migration 2 bảng, đổi contract, endpoint mới, đổi luồng gửi tin ZCA, đổi luồng bot của cả `CREATE_TASK` và `SET_REMINDER`)
- Nối tiếp: `task-reminder` (commit `3501070`, nhánh `feat/task-reminders`)
- Trạng thái: chờ anh duyệt
- Bản 3: anh muốn **Nhắc nhở (`/reminders`) cũng chọn được nhóm và người**, giống task. Bản 2 đã chốt cho chọn **cách gửi** (tag trong nhóm / nhắn riêng).

## 1. Hiện trạng

| | Nhắc việc (task) | Nhắc nhở (`reminders`) |
| --- | --- | --- |
| Gửi tới | Kênh chọn được (`remind_chat_id`) | **Luôn** chat riêng của người tạo (`user_id`) |
| Người được nhắc | Không có | Không có |
| Lặp | Không | `none` / `daily` / `weekly` |

- `zca-js` 2.2.0 tag được người (`mentions: [{ pos, uid, len }]`); `WelcomeGroupEventStrategy` đã dùng.
- Tag trong tin đến (`message.data.mentions`) chưa được đưa vào `AgentInput`/`TextToolContext`.
- `ZcaService.getGroupMembers(groupId)` có cache; endpoint hiện tại chỉ cho admin.

**Hai lỗi có sẵn phát hiện khi đọc code** (nằm trong phạm vi vì đụng đúng đoạn gửi tin):

1. `notifyType: 'call'` được lưu nhưng scheduler **không gọi điện**, luôn gửi tin nhắn với header "text".
2. Nhắc nhở do `dashboard-owner` tạo được gửi tới UID `dashboard-owner` (không phải ID Zalo) ⇒ **không bao giờ tới**.

## 2. Ý tưởng chính: một "đích nhắc" dùng chung

Thay vì làm hai lần, tách phần **gửi nhắc tới đâu, cho ai, bằng cách nào** thành một khối dùng chung (**Đích nhắc**, `ReminderTarget`):

```ts
interface ReminderTarget {
  chatId: string;                    // kênh nhận nhắc: nhóm hoặc chat riêng
  users: { id: string; name: string }[]; // người được nhắc (chỉ khi chatId là nhóm), tối đa 10
  mode: 'mention' | 'direct';        // tag trong nhóm (mặc định) | nhắn riêng từng người
}
```

Cả task và nhắc nhở dùng chung: kiểm tra đích, lấy danh sách kênh/thành viên, dựng tin có tag, gửi theo cách đã chọn. Mỗi bên chỉ còn lo phần riêng của mình (task: việc còn mở; nhắc nhở: lặp, hoãn).

### Hai cách gửi

| | **Tag trong nhóm** (`mention`, mặc định) | **Nhắn riêng** (`direct`) |
| --- | --- | --- |
| Cách gửi | Một tin vào nhóm, **@tag** người được nhắc | Mỗi người một tin chat riêng ("Bạn được nhắc trong nhóm <tên>") |
| Ai thấy | Cả nhóm | Chỉ người đó |

- Người được nhắc luôn chọn từ **thành viên của nhóm nhận nhắc**.
- Nhắn riêng lỗi với ai (thường do chưa kết bạn với tài khoản bot) ⇒ gửi bù **một** tin vào nhóm tag những người đó.
- Không chọn ai ⇒ gửi vào kênh, không tag.
- Kênh là chat riêng ⇒ không có danh sách người, không có cách gửi để chọn.

### Mặc định của từng loại

| Tạo từ | Nhắc việc (task) | Nhắc nhở |
| --- | --- | --- |
| Bot, nhắn trong nhóm | Nhóm đó | **Chat riêng của người nhắn** (giữ như hiện tại: nhắc nhở là việc cá nhân) |
| Bot, có tag người ("nhắc @Trí 3h họp") | Nhóm đó, tag người được tag | Nhóm đó, tag người được tag |
| Bot, nói "nhắc nhóm" / "nhắc cả nhóm" | Nhóm đó | Nhóm đó, không tag |
| Bot, nói "nhắn riêng" / "inbox" | `direct` | `direct` |
| Dashboard, người dùng có Zalo | Chat riêng của họ | Chat riêng của họ |
| Dashboard, `dashboard-owner` | **Bắt buộc chọn** kênh | **Bắt buộc chọn** kênh (sửa lỗi 2) |

LLM **không** tự đoán người theo tên, chỉ dùng tag thật của Zalo, để không nhắc nhầm người trùng tên.

## 3. Thay đổi

### 3.1 Dữ liệu (1 migration)

`tasks`: thêm `remind_users jsonb NOT NULL DEFAULT '[]'`, `remind_mode varchar NOT NULL DEFAULT 'mention'` (đã có `remind_chat_id`).

`reminders`: thêm `chat_id varchar NULL` (**`NULL` = chat riêng của `user_id`**, nên mọi nhắc nhở cũ chạy y như trước), `remind_users jsonb NOT NULL DEFAULT '[]'`, `remind_mode varchar NOT NULL DEFAULT 'mention'`.

### 3.2 Backend dùng chung — `apps/api/src/reminders/`

- `reminder-target.ts` (thuần, có unit test): chuẩn hoá đích, quy tắc "đổi kênh ⇒ xoá người", giới hạn 10, `buildReminderMessage({ header, lines, users }) → { text, mentions }` (tính `pos`/`len`).
- `ReminderTargetService` (export từ `RemindersModule`):
  - `listChannels(userId)`: chuyển `TasksService.listReminderChannels` sang đây.
  - `listMembers(chatId)`: thành viên nhóm đang listen (cache `getGroupMembers`).
  - `assertTarget(target, actor)`: kênh hợp lệ (chat riêng của chính mình hoặc kênh đang listen), người được nhắc thuộc nhóm.
  - `deliver(target, message)`: gửi theo `mention` / `direct` + gửi bù; bỏ qua nhóm đã bị bỏ listen.
- `ZcaMessengerService.sendMessageWithMentions(chatId, text, mentions)`.
- `TasksModule` import `RemindersModule` (một chiều, không vòng).

### 3.3 Nhắc việc (task)

- `TasksService.resolveReminder` nhận thêm `remindUserIds`, `remindMode`; đổi người hoặc đổi cách gửi ⇒ nhắc lại.
- `TaskReminderSchedulerService` gọi `ReminderTargetService.deliver`.

### 3.4 Nhắc nhở (`reminders`)

- `RemindersService.create/update` nhận `chatId?`, `remindUserIds?`, `remindMode?`, dùng chung `assertTarget`. Đổi đích ⇒ nhắc nhở về `pending` (nếu đã gửi).
- `ReminderSchedulerService` gửi qua `deliver` thay vì luôn `sendMessage(userId)`.
- Lặp ngày/tuần và hoãn giữ nguyên, áp cho cả đích nhóm.
- **Gọi điện** (lỗi 1): chỉ cho chọn khi đích là chat riêng. Việc **thực sự gọi** em đề nghị để việc riêng (cần tìm API gọi của ZCA). Trong việc này em chỉ: ẩn "Gọi điện" khi chọn nhóm, và ghi rõ trong docs là hiện vẫn gửi tin nhắn.
- Trang `/reminders` vẫn chỉ liệt kê nhắc nhở **của người tạo** như hiện tại.

### 3.5 Bot Zalo

- Đưa tag của tin đến vào `AgentInput.mentions` (`{ uid, name }`, bỏ tag bot) → `TextToolContext`.
- `CREATE_TASK`, `SET_REMINDER` thêm tham số `remindTarget: 'self' | 'group'` và `remindMode: 'mention' | 'direct'`. Người được nhắc lấy từ tag thật; "nhắc tôi" trong nhóm ⇒ tag người nhắn.
- Thẻ xác nhận + tóm tắt: `👥 <nhóm> · 👤 @Trí, @Đạt (nhắn riêng)`.

### 3.6 API + contracts

- `GET /api/reminder-targets/channels` (chuyển từ `/api/tasks/reminder-channels`; route cũ bỏ vì chưa phát hành).
- `GET /api/reminder-targets/channels/:chatId/members` (mọi người dùng dashboard, chỉ nhóm đang listen).
- Contracts: `IReminderTarget`, `IReminderTargetUser`, `ReminderTargetMode`, `IReminderTargetChannel` (đổi tên từ `ITaskReminderChannel`). `ITaskListItem` / `IReminderListItem` có `remindUsers`, `remindMode` (+ `chatId`, `chatName` cho nhắc nhở). Request tạo/sửa cả hai thêm `remindChatId?`/`chatId?`, `remindUserIds?`, `remindMode?`. `API_ROUTES.reminderTargetChannels`, `reminderTargetMembers(chatId)`.

### 3.7 Web

- Component dùng chung `ReminderTargetFields`: **Gửi nhắc vào** → (nếu là nhóm) **Nhắc ai** (chọn nhiều, tìm theo tên, tối đa 10) → (nếu đã chọn người) **Cách nhắc**. Dùng trong `CreateTaskDialog`, `CreateReminderDialog` và khi sửa tại chỗ ở hai bảng.
- Model thuần dùng chung (có unit test) cho việc dựng phần đích trong request.
- Bảng: cột Nhắc lúc (task) và cột mới **Gửi tới** (nhắc nhở): `👥 Nhóm · 👤 Trí, Đạt` / "nhắn riêng".
- Chuyển `TaskReminderChannelOptions` thành phần của `ReminderTargetFields`.

### 3.8 Tài liệu

`knowledge|docs/modules/tasks`, `knowledge|docs/modules/reminders`, `knowledge|docs/modules/dashboard`, `knowledge|docs/global/google-tasks.md`, `CONTEXT.md` (thuật ngữ **Đích nhắc**, **Người được nhắc**; sửa định nghĩa **Kênh nhận nhắc** cho cả nhắc nhở), `docs/README.md`.

## 4. Thứ tự làm (mỗi bước chạy test xong mới sang bước sau)

1. Phần lõi dùng chung (`reminder-target.ts`, service, messenger) + test.
2. Nhắc việc chuyển sang phần lõi (không đổi hành vi) + người/cách gửi.
3. Nhắc nhở dùng phần lõi + sửa 2 lỗi có sẵn.
4. Bot (tag đến, 2 tool).
5. Web (component chung, 2 form, 2 bảng).
6. Tài liệu + kiểm tra.

## 5. Kiểm thử

- Unit: `pos`/`len` của tag (tên có dấu, nhiều người); đổi kênh xoá người; giới hạn 10; người ngoài nhóm bị chặn; `direct` + gửi bù; nhắc nhở cũ (`chat_id` NULL) vẫn gửi chat riêng; nhắc nhở lặp vào nhóm; `dashboard-owner` phải chọn kênh; bot lấy tag từ tin (bỏ tag bot), "nhắc tôi" ⇒ tag người nhắn, `SET_REMINDER` không tag ⇒ vẫn chat riêng.
- `npm run typecheck`, `npm run lint`, `npm run test` (api/web/contracts), `docs-drift-check --all`.
- Không tự kiểm chứng được tin tag thật trên Zalo nếu ZCA local chưa đăng nhập; preview web trước đó không chạy được (`EPERM uv_cwd`). Sẽ báo rõ.

## 6. Rủi ro

- Việc khác (`google-storage-account-page`) đang sửa trên cùng nhánh `feat/task-reminders` và đụng `packages/contracts/src/index.ts` ⇒ nên commit hoặc tách nhánh việc đó trước khi em bắt đầu.
- Đổi route `/api/tasks/reminder-channels` (mới thêm ở `3501070`, chưa deploy) ⇒ an toàn nếu chưa deploy.
- `pos` của tag tính theo UTF-16 của JS; nếu Zalo tính khác thì tag lệch, tin vẫn gửi được.
- Endpoint thành viên mở cho mọi người dùng dashboard ⇒ người dùng thường thấy tên thành viên các nhóm đang listen.
- `direct` gửi nhiều tin liên tiếp, có thể chạm giới hạn gửi của Zalo; giới hạn 10 người giảm rủi ro này.

## 7. Ghi chú thực thi (Phase 2, 2026-10-22)

Trạng thái: **đã code xong**, chưa commit. Làm trong worktree `.claude/worktrees/reminder-targets`, nhánh `feat/reminder-targets` tách từ `feat/task-reminders` (`1fd4a08`), để không đè lên phiên `google-storage-account-page` đang sửa cùng nhánh.

Điều chỉnh so với kế hoạch:

- **Bỏ qua lượt khi ZCA đăng xuất** cho cả lời nhắc cá nhân (trước đây lời nhắc bị đánh dấu đã gửi dù tin không đi). Thêm vào vì đụng đúng đoạn gửi tin.
- **Tag người lấy từ `AgentInput.taggedUsers`** (`extractTaggedUsers` trong `zca-bot-feature.service.ts`), chỉ gắn ở bước xử lý tin chính (bước 8). Sửa thẻ chờ (`edit <code>`) chạy lại tool trên câu sửa không có tag ⇒ người được nhắc bị mất (đã ghi vào docs).
- `TasksService` chỉ gọi `ReminderTargetService` khi bản sửa đụng tới trường nhắc; sửa tiêu đề/hoàn thành giữ nguyên nhắc, không truy vấn kênh.
- Tách hàm đọc lỗi API thành `reminderApiErrorMessage` (module reminders) dùng cho cả task và lời nhắc; bỏ `taskApiErrorMessage`, `TaskReminderChannelOptions`, `GET /api/tasks/reminder-channels` (thay bằng `/api/reminder-targets/channels`).
- Stub test dùng chung nằm ở `reminder-target.fixtures.spec.ts` (đuôi `.spec.ts` để không vào bản build; file không có test).
- Migration lấy số `1724930000000` (chừa `17249200…` phòng phiên khác thêm migration).

Kiểm chứng:

- `npm run typecheck` ✅, `npm run lint` ✅ (api/web/contracts).
- `npm run test`: api 577/577 ✅ (gồm test DI `AppModule`), web 105/105 ✅.
- `npm run build --workspace @zalobot/web` ✅.
- `node .claude/hooks/docs-drift-check.mjs` và `--all` ✅.
- ❌ Chưa xem UI trên trình duyệt (preview dev server trước đó lỗi `EPERM uv_cwd`).
- ❌ Chưa chạy migration trên DB thật, chưa thử tag/nhắn riêng trên Zalo thật.

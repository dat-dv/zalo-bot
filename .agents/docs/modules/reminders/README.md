---
metadata:
  agent-artifact:
    id: docs-module-reminders
    type: documentation
    depends_on:
      - .agents/knowledge/modules/reminders/README.md
      - apps/web/src/modules/reminders/api/reminders-api.ts
      - apps/web/src/modules/reminders/api/reminders-query.ts
      - apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminders-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-reminder-dialog.tsx
      - apps/web/src/modules/reminders/model/reminder-create-form.ts
      - apps/web/src/shared/ui/form-dialog.tsx
      - apps/api/src/reminders/reminders.controller.ts
      - apps/api/src/reminders/reminders.service.ts
      - apps/api/src/reminders/reminder-scheduler.service.ts
      - apps/api/src/reminders/reminder.processor.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/reminders/reminder-target.ts
      - apps/api/src/reminders/reminder-times.ts
      - apps/api/src/database/migrations/1724940000000-CreateReminderTimes.ts
      - apps/web/src/modules/reminders/model/reminder-times.ts
      - apps/web/src/modules/dashboard/presentation/components/reminder-times-field.tsx
      - apps/api/src/reminders/reminder-target.service.ts
      - apps/api/src/reminders/reminder-targets.controller.ts
      - apps/api/src/database/migrations/1724930000000-AddReminderTargets.ts
      - apps/api/src/zca/text/strategies/set-reminder-tool.strategy.ts
      - apps/api/src/zca/zca-messenger.service.ts
      - apps/web/src/modules/reminders/api/reminder-targets-api.ts
      - apps/web/src/modules/reminders/api/reminder-targets-query.ts
      - apps/web/src/modules/reminders/model/reminder-target.ts
      - apps/web/src/modules/dashboard/presentation/components/reminder-target-fields.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminder-target-summary.tsx
---

# Module lời nhắc (Reminders)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/reminders/README.md).

## 1. Nghiệp vụ

Lời nhắc là một tin nhắn Zalo mà bot tự gửi khi tới giờ: mặc định vào chat riêng của người tạo, hoặc vào một nhóm và tag đúng người được chọn (mục 2). Người dùng tạo lời nhắc bằng cách chat với bot (AI gọi tool `SET_REMINDER`, phải xác nhận như mọi thao tác chờ duyệt) hoặc ngay trên dashboard. Trên dashboard, người dùng thêm, xem, sửa, hoãn và xoá lời nhắc. Lời nhắc vẫn **thuộc người tạo**: trang `/reminders` chỉ hiện lời nhắc của chính mình, kể cả khi nó gửi vào nhóm.

## 2. Đích nhắc (dùng chung với nhắc việc)

**Đích nhắc** trả lời ba câu: gửi vào đâu, nhắc ai, nhắc thế nào. Phần này dùng chung cho lời nhắc và **nhắc việc** của task ([`tasks/README.md`](../tasks/README.md#2-nhắc-việc)), viết một lần ở `apps/api/src/reminders/`. Lý do: hai loại nhắc chỉ khác nhau ở *nội dung* và *khi nào gửi*, còn chọn kênh, chọn người, tag, nhắn riêng thì giống hệt, làm hai lần sẽ lệch nhau rất nhanh.

### Ba phần của đích nhắc

| Phần | Ý nghĩa | Quy tắc |
| --- | --- | --- |
| **Kênh nhận nhắc** | Nhóm hoặc chat riêng nhận tin | Mặc định: lời nhắc → chat riêng người tạo; nhắc việc → nơi đã nhắn bot. Chọn kênh khác thì phải là kênh **đang listen**. `dashboard-owner` và tài khoản chỉ có **ID Zalo Bot cũ** (20 ký tự hex) không có chat riêng mà ZCA gửi được, nên phải tự chọn |
| **Người được nhắc** | Ai nhận nhắc | **Bắt buộc khi có nhắc.** Nhóm: chọn 1–10 thành viên. Chat riêng: chính người của chat đó, không cần chọn. Đổi sang kênh khác thì danh sách bị xoá vì nhóm mới có thành viên khác, nên phải chọn lại |
| **Cách nhắc** | `mention` (tag trong nhóm, mặc định) hoặc `direct` (nhắn riêng từng người) | Chỉ có ý nghĩa khi đã chọn người |

### Vì sao chọn người như vậy

- **Trên dashboard** chỉ chọn được người trong danh sách thành viên của nhóm (lấy qua ZCA, có cache). Nhờ vậy UID luôn đúng, và không thể nhắc người ngoài nhóm. ZCA đang đăng xuất thì không lấy được danh sách, API trả lỗi rõ ràng.
- **Trên Zalo** bot chỉ dùng **tag thật** trong tin nhắn (`@Trí`), không cho AI đoán người theo tên, để không nhắc nhầm người trùng tên.
- **Nhắn riêng có thể thất bại** nếu người đó chưa kết bạn với tài khoản bot. Khi đó bot gửi bù **một** tin vào nhóm và tag những người không nhắn riêng được, để không ai bị lỡ nhắc.

### Gửi đi thế nào

- Tin nhắc có dạng: tiêu đề, **dòng tag** (`@Trí @Đạt`), rồi nội dung. Vị trí tag được tính theo cách `zca-js` yêu cầu (đơn vị UTF-16 của JavaScript).
- Đổi kênh, đổi người hoặc đổi cách nhắc **không gửi lại** những lần đã gửi, chỉ áp cho các lần chưa gửi. Muốn nhắc thêm thì thêm giờ mới.
- Nhóm đã bị admin bỏ listen ⇒ không gửi (ghi log). Nhắc nhở cũ do `dashboard-owner` tạo trỏ vào `dashboard-owner` cũng bị bỏ qua, vì trước giờ nó chưa bao giờ tới được ai.
- Đích là **ID Zalo Bot cũ** (ví dụ lời nhắc cũ chưa chọn kênh của tài khoản ID cũ) ⇒ bỏ qua và ghi cảnh báo, không thử lại, vì ZCA không có cuộc trò chuyện nào với ID này. Cách sửa: gộp ID cũ vào UID ZCA của người đó (gộp tài khoản chuyển luôn kênh nhận nhắc), hoặc sửa lời nhắc và chọn kênh.
- Danh sách kênh và thành viên mở cho **mọi** người dùng dashboard (trước đây chỉ admin xem được thành viên nhóm). Đây là đánh đổi có chủ ý để ai cũng chọn được người được nhắc.

### Code

- Backend: `reminder-target.ts` (hàm thuần: dựng tin có tag, chuẩn hoá người, so sánh đích), `ReminderTargetService` (danh sách kênh/thành viên, kiểm tra đích, gửi tin), `ReminderTargetsController` (`/api/reminder-targets/channels`, `/api/reminder-targets/channels/:chatId/members`). `ZcaMessengerService.sendMessageWithMentions` gửi một tin có tag.
- Migration `AddReminderTargets` thêm vào `reminders`: `chat_id` (để trống = chat riêng người tạo, nên **nhắc nhở cũ chạy y như trước**), `remind_users`, `remind_mode`; thêm `remind_users`, `remind_mode` vào `tasks`.
- Web: `reminders/api/reminder-targets-*.ts`, `reminders/model/reminder-target.ts` (hàm thuần, có unit test), và ở module dashboard: `ReminderTargetFields` (bộ ô chọn dùng cho cả hai form và hai bảng), `ReminderTargetSummary` (dòng tóm tắt dưới giờ nhắc).

### Nhiều lần nhắc

Một lời nhắc (giống việc cần làm) có thể nhắc **nhiều lần**, tối đa 10, ví dụ "uống thuốc 8h và 20h". Mỗi lần là một dòng trong bảng `reminder_times`, có dấu "đã gửi" riêng.

- **Lặp ngày/tuần áp cho từng giờ**: lời nhắc lặp hằng ngày có 8h và 20h thì gửi xong lần 8h, dòng đó tự dời sang 8h hôm sau. Bot ngừng một hôm (ví dụ ZCA đăng xuất) thì không gửi dồn các ngày đã lỡ, chỉ nhảy tới lần kế tiếp.
- Lời nhắc không lặp chuyển **đã xong** khi mọi lần đã gửi.
- `reminders.remind_at` vẫn giữ, nghĩa là **lần nhắc kế tiếp**, để danh sách, trang Tổng quan và lệnh `/reminders` vẫn sắp xếp như cũ.
- Lời nhắc chưa bao giờ bị server từ chối vì giờ đã qua (giờ đã qua thì bot gửi ngay ở lượt kế tiếp, form dashboard mới kiểm tra), nên vẫn giữ như vậy. Việc cần làm thì server từ chối giờ mới ở quá khứ.
- Migration `CreateReminderTimes` chuyển mỗi lời nhắc cũ thành một dòng; cột giờ dùng cùng kiểu `timestamp` với `reminders.remind_at` để giá trị đọc ra y như trước.

## 3. Ai sở hữu code nào

- `apps/web/src/modules/reminders` có thư mục `api/` và `model/`:
  - `reminders-api.ts`: `getReminders`, `createReminder`, `updateReminder`, `deleteReminder`, gọi `API_ROUTES.reminders` (`/api/reminders`).
  - `reminders-query.ts`: query key `['reminders']`, các hook `useRemindersQuery`, `useCreateReminderMutation`, `useUpdateReminderMutation`, `useDeleteReminderMutation`. Sau khi thêm/sửa/xoá thành công sẽ làm mới cache `reminders` và `dashboard`.
  - `model/reminder-create-form.ts`: hàm thuần (có unit test) đặt giá trị mặc định và kiểm tra form thêm lời nhắc.
- **Màn hình nằm ở module dashboard**: `RemindersScreen`, `RemindersTable` và `CreateReminderDialog` trong `apps/web/src/modules/dashboard/presentation/components/`. Trang `/reminders` (`apps/web/app/(private)/reminders/page.tsx`) import từ `@/modules/dashboard/view/reminders-screen`. Khi cần sửa giao diện, hãy mở thư mục dashboard, không phải thư mục reminders.
- Backend: `apps/api/src/reminders` gồm `RemindersController`, `RemindersService`, `ReminderSchedulerService` và worker BullMQ `ReminderProcessor` (queue `reminders`).

## 4. Màn hình Nhắc nhở

- Dữ liệu lấy từ `useRemindersQuery`. Nếu API trả danh sách rỗng, màn hình dùng tạm `reminders` trong dữ liệu dashboard.
- Bảng có ô tìm kiếm theo tiêu đề và các cột: tiêu đề, loại thông báo (`text` tin nhắn / `call` cuộc gọi), thời điểm nhắc, lặp lại (`none` / `daily` / `weekly`), **Gửi tới** (kênh · người được nhắc · "Nhắn riêng"; chỉ trên trang `/reminders`), thao tác.
- **Thêm lời nhắc**: nút `+ Thêm lời nhắc` trên toolbar (desktop) hoặc ở thanh hành động dưới cùng (điện thoại) mở hộp thoại gồm tiêu đề, **các giờ nhắc** (mỗi giờ một ô, nút **+ Thêm giờ nhắc**), **đích nhắc** (Gửi nhắc vào → Nhắc ai → Cách nhắc; ô **Nhắc ai** luôn hiện: chưa chọn kênh thì nhắc chọn kênh trước, chat riêng thì hiện sẵn người đó, nhóm thì bắt buộc chọn ít nhất 1 người), loại thông báo, kiểu lặp.
  - "Gọi điện" chỉ chọn được khi gửi vào **chat riêng của chính mình**: một cuộc gọi chỉ tới được một người, gọi "vào nhóm" không có nghĩa.
  - Mặc định nhắc **sau 1 giờ**, bằng tin nhắn, không lặp, để người dùng chỉ cần gõ tiêu đề là lưu được.
  - Không cho chọn thời điểm đã qua: bộ hẹn giờ sẽ bắn ngay lời nhắc quá giờ ở lượt chạy kế tiếp, nên đó gần như luôn là chọn nhầm. Phút hiện tại vẫn được chấp nhận vì ô nhập chỉ chính xác tới phút. Form kiểm tra lại lúc bấm Lưu phòng khi form để mở lâu.
  - Giờ nhập theo múi giờ của trình duyệt rồi đổi sang ISO trước khi gửi.
- Sửa trực tiếp trên dòng (tiêu đề, thời điểm, loại thông báo, kiểu lặp, đích nhắc) rồi bấm Lưu hoặc Huỷ. Phần đích nhắc chỉ được gửi lên khi thật sự đổi; API từ chối thì toast hiện lý do.
- Nút **Nhắc lại** (snooze) chỉ dời **lần nhắc kế tiếp** thêm 15 phút, các giờ khác giữ nguyên.
- Xoá có hộp thoại xác nhận của trình duyệt. Mỗi thao tác thành công hiện toast.
- Khi lỗi: hiện dải cảnh báo kèm nút Thử lại.

## 5. API backend

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/reminders` | Lời nhắc chưa kích hoạt (`isTriggered = false`) của người dùng, sắp theo giờ nhắc tăng dần, kèm tên kênh nhận nhắc (`chatName`) |
| GET | `/api/reminders/:id` | Một lời nhắc, 404 nếu không thuộc người dùng |
| POST | `/api/reminders` | Bắt buộc `title`, `remindAt` hợp lệ; tuỳ chọn `notifyType`, `repeatType`, `chatId`, `remindUserIds`, `remindMode` |
| PATCH | `/api/reminders/:id` | Sửa tiêu đề, danh sách giờ nhắc (`remindTimes`), loại thông báo, kiểu lặp, đích nhắc. Thêm giờ mới thì lời nhắc đã xong quay lại trạng thái chờ; chỉ đổi đích thì không |
| DELETE | `/api/reminders/:id` | Xoá, trả `{ deleted: true }` |

Mọi endpoint đều lọc theo người dùng đang đăng nhập dashboard. Controller bỏ qua `status` gửi lên trong body. Chọn "Gọi điện" mà đích không phải chat riêng của chính mình ⇒ 400.

## 6. Bộ hẹn giờ gửi nhắc (`ReminderSchedulerService`)

Lời nhắc chạy trên hàng đợi BullMQ `reminders` (cơ chế chung xem [Dịch vụ nền của Backend](../../global/backend-runtime-services.md)), chia hai bước:

- **Quét** (job `scan`, **mỗi 30 giây**): lấy các lần nhắc đã tới giờ (`remindAt <= now`) của lời nhắc chưa kích hoạt, giành quyền gửi từng lần (đánh dấu đã gửi, hoặc dời sang lần lặp kế tiếp), rồi đưa mỗi lần vào hàng đợi gửi. Không đưa được vào hàng đợi thì trả lần nhắc về như cũ để lượt sau thử lại.
- **ZCA đang đăng xuất thì bỏ qua cả lượt quét**, lời nhắc chờ tới lần đăng nhập sau. Nếu ZCA đăng xuất đúng lúc đang chờ gửi thì lần nhắc cũng được trả về để gửi sau khi đăng nhập lại.
- **Gửi** (job `deliver`): đọc lại lời nhắc (đã bị xoá thì thôi), định dạng giờ của lần nhắc theo múi `Asia/Ho_Chi_Minh` và ngôn ngữ ưa thích của người dùng, gửi tới **đích nhắc** qua `ReminderTargetService.deliver` (kênh đã chọn, hoặc chat riêng người tạo với lời nhắc cũ). Gửi lỗi thì BullMQ tự thử lại tối đa 5 lần trước khi bỏ.
- Lặp `daily` thì dời sang ngày hôm sau, `weekly` dời 7 ngày và vẫn ở trạng thái chờ. Không lặp thì chuyển sang `completed`.
- **Giới hạn đã biết**: chọn loại `call` chỉ được lưu và hiển thị; bộ hẹn giờ luôn gửi tin nhắn chữ, chưa có luồng gọi điện. Làm cuộc gọi thật là việc riêng (cần tìm API gọi của ZCA).

## 7. Tạo lời nhắc từ chat

- AI dùng tool `SET_REMINDER`. Trong nhóm Zalo, tin nhắn chỉ tới được AI khi người gửi @mention bot hoặc dùng tiền tố của nhóm (xem tài liệu module ZCA).
- **Lời nhắc vẫn mặc định là việc cá nhân**: "3h nhắc tôi đón con" nhắn trong nhóm vẫn gửi vào chat riêng của người nhắn, như trước. Chỉ khi tin có **tag người** ("3h nhắc @Trí gọi khách") hoặc nói "nhắc cả nhóm" thì bot mới nhắc trong nhóm. Nhắc trong nhóm luôn tag ít nhất một người: "nhắc cả nhóm" mà không tag ai thì bot tag chính người nhắn. "nhắc tôi và @Trí" thì tag cả người nhắn. "nhắn riêng" / "inbox" thì chọn cách nhắn riêng.
- Thẻ xác nhận có thêm **Gửi tới**, **Nhắc ai**, **Cách nhắc**; tóm tắt sau khi duyệt có `👤 @Trí (nhắn riêng)`.
- Sửa thẻ chờ (`edit <code> ...`) chạy lại tool trên câu sửa, mà câu sửa không có tag, nên người được nhắc bị mất. Muốn đổi người thì huỷ và nhắn lại.
- Thao tác chờ duyệt được lưu trong Redis dưới dạng JSON, nên `remindAt` bị biến thành chuỗi. Khi người dùng xác nhận, `parseReminderPayload` (trong `transaction-confirmation.service.ts`) chuyển lại thành `Date` bằng `toValidReminderDate` trước khi tạo lời nhắc. Thiếu bước này thì việc tạo lời nhắc sẽ lỗi.
- Lệnh nhanh `/reminders` (hoặc `/reminder`) liệt kê các lời nhắc sắp tới ngay trong chat.

## 8. Kiểm thử

Chạy `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` và `npm run build` tại thư mục gốc. Thử tay: nhắn bot "nhắc tôi 5 phút nữa uống nước", xác nhận mã, chờ tối đa 30 giây sau giờ hẹn để nhận tin (cần Redis đang chạy, vì bộ hẹn giờ dùng BullMQ).

# Điều tra: tin bổ sung tạo thẻ chờ mới thay vì sửa thẻ cũ, và mất giờ nhắc

- Route: `investigate` · Authority: `propose-only` (chưa sửa code)
- Ngày: 25/10/2026 · Nhánh: `claude/relaxed-shannon-91cdf4` (base `b8e081c`)
- Phạm vi đọc: `apps/api/src/zca/text`, `apps/api/src/zca/confirmation`, `apps/api/src/zca/zca-bot-feature.service.ts`, `apps/api/src/zca/memory`, `apps/api/src/reminders/reminder-times.ts`

## 1. Hiện tượng

| Giờ | Ai | Tin | Bot làm gì |
| --- | --- | --- | --- |
| 12:02 | Diệu Hằng | `@Đen 12:00 ngày 25/10/2026 Đạt hứa … 14/2 8/3 20/10 sinh nhật Hằng … nhắc Đạt giúp Hằng nha` | Thẻ chờ CREATE_TASK **[446]**, 3 giờ nhắc `09:00 14/02/2027 (Hàng tháng); 09:00 08/03/2027; 09:00 20/10/2027`, Nhắc ai: @Diệu Hằng |
| 12:04 | Diệu Hằng | `@Đen tag @Văn Đạt nha` | Thẻ **mới [950]** (không sửa [446]) |
| sau đó | (duyệt) | | `✅ [950] Thêm việc: … · ⏰ nhắc 09:00 14/02/2027 (hàng tháng) · 👤 @Văn Đạt` → chỉ còn 1 giờ nhắc, mất 8/3 và 20/10; kèm "Bạn còn 1 yêu cầu chờ xác nhận" |
| 12:07 | bot | | [446] hết hạn, gửi tin hết hạn |

Mong đợi: tin 12:04 của cùng người, cùng chat, khi [446] còn hạn, được coi là sửa [446]: một thẻ mới thay [446] (thu hồi [446]), giữ đủ 3 giờ nhắc, Nhắc ai đổi thành @Văn Đạt.

## 2. Kết luận ngắn

1. **Tin không có `edit <code>` không bao giờ vào luồng sửa.** Luồng sửa chỉ được kích hoạt bằng tiền tố `edit|sửa|chỉnh sửa|sửa lại`. Tin "tag @Văn Đạt nha" rơi xuống luồng LLM chính, nơi mọi tool call đều tạo một thẻ chờ **mới**, và không có bước nào thay thế thẻ đang chờ của cùng người trong cùng chat. Đây là đúng với contract hiện tại (sửa chỉ qua `edit <code>`), nên là **khoảng trống thiết kế**, không phải regression.
2. **`remindTimes` chỉ còn 1 phần tử vì LLM tự dựng lại toàn bộ CREATE_TASK từ văn bản hiển thị**, không có dữ liệu có cấu trúc của [446]. Ở luồng chính, ngữ cảnh duy nhất LLM thấy là khối trí nhớ ngắn hạn (tin gốc + văn bản thẻ [446]), mà khối đó lại dặn "TUYỆT ĐỐI KHÔNG gọi tool" cho nội dung bên trong. LLM chỉ chép lại giờ có lặp (14/02 hằng tháng) và bỏ hai giờ một lần. Code không mang payload [446] sang [950].
3. Ngay cả khi người dùng gõ đúng `edit 446 tag @Văn Đạt`, luồng sửa hiện tại **cũng sai**: không mang người được tag theo (vẫn nhắc @Diệu Hằng), và đưa payload cho LLM theo dạng lưu trữ, khác dạng tham số tool, nên dễ mất giờ nhắc (xem §4).

Độ tin cậy: **cao** cho (1) và (3) (đọc code, đường đi xác định). **Cao** cho cơ chế của (2), nhưng chưa xác nhận args chính xác LLM trả về lúc 12:04 vì không có log prod (xem §7).

## 3. Nguyên nhân gốc và bằng chứng

### RC1: định tuyến chỉ nhận lệnh sửa có tiền tố

- Lối vào đầu tiên của mọi tin văn bản: `ZcaBotFeatureService.onMessage` gọi `confirmationService.handleCommand` ([zca-bot-feature.service.ts:938-971](apps/api/src/zca/zca-bot-feature.service.ts:938)).
- `handleCommand` chỉ vào `processEdit` khi tin khớp regex `^(?:edit|chỉnh\s*sửa|chinh\s*sua|sửa\s*lại|sua\s*lai|sửa|sua)…` ([transaction-confirmation.service.ts:1030-1057](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:1030)); không khớp thì `return false` ([:1059](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:1059)).
- `TextInputService.process` gọi lại `handleCommand` cùng regex ([text-input.service.ts:117-127](apps/api/src/zca/text/text-input.service.ts:117)), vẫn `false`.
- Rơi xuống luồng LLM chính ([text-input.service.ts:166-249](apps/api/src/zca/text/text-input.service.ts:166)): đưa cả bộ tool, mọi tool call đều chạy `strategy.execute` ([:240-247](apps/api/src/zca/text/text-input.service.ts:240)). Prompt không có thông tin nào về thẻ đang chờ của người gửi.
- `CreateTaskToolStrategy.execute` → `createPendingTask` ([create-task-tool.strategy.ts:63-78](apps/api/src/zca/text/strategies/create-task-tool.strategy.ts:63)) → `createPendingAction` sinh mã mới ([transaction-confirmation.service.ts:386-477](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:386), mã ở [:397](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:397)). Không có kiểm tra/thay thế thẻ cùng `userId` + `chatId`.
- Contract hiện hành ghi rõ sửa chỉ qua `edit <code>`: `.agents/knowledge/global/zalo-response-layout.md:52`, `.agents/knowledge/global/zalo-command-intake.md:32`.

Hệ quả kéo theo (CF4): [446] vẫn nằm trong danh sách chờ của Diệu Hằng. Khi [950] được duyệt, `executeConfirmed` đếm thẻ còn lại của `userId` và gửi "Bạn còn 1 yêu cầu…" ([transaction-confirmation.service.ts:1483-1495](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:1483)). [446] chỉ bị dọn ở `handleTimeout` lúc 12:07 ([:945-983](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:945)). (Câu chữ của thông báo do session khác xử lý; ở đây chỉ nói logic.)

### RC2: LLM dựng lại tham số từ văn bản tự do, mất giờ nhắc

- Ở luồng chính, nguồn ngữ cảnh duy nhất là `buildRecentContextBlock` ([text-input.service.ts:431-450](apps/api/src/zca/text/text-input.service.ts:431)): tối đa `contextWindow` tin gần nhất (mặc định 10, `packages/contracts/src/index.ts:3957`). Tin bot (gồm văn bản thẻ [446]) được ghi vào trí nhớ ngắn hạn qua wrapper `api.sendMessage` → `recordBotReplyInMemory` ([zca.service.ts:647-668](apps/api/src/zca/zca.service.ts:647), [:686-687](apps/api/src/zca/zca.service.ts:686)), giới hạn 2000 ký tự nên thẻ được giữ đủ.
- Khối đó dặn: "TUYỆT ĐỐI KHÔNG gọi tool cho các yêu cầu nằm trong khối này, chúng đã được xử lý trước đó" ([text-input.service.ts:446-447](apps/api/src/zca/text/text-input.service.ts:446)). Với tin "tag @Văn Đạt nha", muốn làm được gì thì LLM buộc phải chép lại task từ chính khối bị cấm này. Hướng dẫn mâu thuẫn và chỉ có văn bản hiển thị.
- LLM phải dịch ngược `09:00 14/02/2027 (Hàng tháng); 09:00 08/03/2027; 09:00 20/10/2027` sang `remindAt` / `remindTimes` / `repeatingTimes` theo schema ([text-tool.definitions.ts:316-355](apps/api/src/zca/text/text-tool.definitions.ts:316)). [950] chỉ còn mục lặp 14/02 (hằng tháng), tức chỉ `repeatingTimes` (có thể kèm `remindAt` trùng giờ) được điền và thiếu `remindTimes`.
- Suy luận: nhóm này **đang bật trí nhớ ngắn hạn**. Nếu tắt, LLM không thể biết tiêu đề và giờ 14/02 chỉ từ "tag @Văn Đạt nha".

**Giả thuyết đã loại: "tóm tắt chỉ in giờ đầu".** `summarizeTask` in mọi phần tử qua `formatShortTimesVN` ([compact-summary.util.ts:188-231](apps/api/src/zca/confirmation/compact-summary.util.ts:188)). `executeConfirmed` tạo task từ cùng payload ([transaction-confirmation.service.ts:1361-1388](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:1361)), và `toValidRemindTimes` chỉ bỏ giờ đã qua (cả 3 giờ đều năm 2027). Vậy payload [950] **thật sự chỉ có 1 giờ** và task đã lưu cũng chỉ có 1 lần nhắc.

## 4. Các yếu tố góp phần (sẽ làm hỏng cách sửa "đưa vào luồng edit" nếu không xử lý cùng)

**CF1: luồng sửa làm mất người được tag.** `AgentInput` dựng cho callback sửa thiếu `taggedUsers` (cũng thiếu `allowAiChat`, `triggerPrefixes`, `messageId`, cấu hình trí nhớ) ([zca-bot-feature.service.ts:952-960](apps/api/src/zca/zca-bot-feature.service.ts:952)); còn luồng chính thì có ([:1305](apps/api/src/zca/zca-bot-feature.service.ts:1305)). Trong strategy, `reminderUsersOrSender` thấy không ai được tag nên nhắc người gửi ([reminder-target-args.util.ts:35-42](apps/api/src/zca/text/reminder-target-args.util.ts:35), [create-task-tool.strategy.ts:59-62](apps/api/src/zca/text/strategies/create-task-tool.strategy.ts:59)). Vì vậy `edit 446 tag @Văn Đạt` vẫn ra "Nhắc ai: @Diệu Hằng". Ngược lại, `remindUsers` cũ trong payload không được giữ: `edit 446 đổi giờ 10h` sẽ đổi người nhắc về người gửi.

**CF2: payload và tham số tool không cùng dạng khi sửa.** `handleEditPendingAction` đưa LLM `JSON.stringify(pending.payload)` ([text-input.service.ts:332-339](apps/api/src/zca/text/text-input.service.ts:332)), tức dạng lưu trữ `remindTimes: [{ at, repeat: { repeatType, repeatWeekdays } }]`. Trong khi đó tool nhận `remindTimes: string[]` và `repeatingTimes: [{ at, repeatType, repeatWeekdays }]` ([text-tool.definitions.ts:322-355](apps/api/src/zca/text/text-tool.definitions.ts:322)). Nếu LLM chép nguyên `remindTimes` dạng object, `reminderTimesFromArgs` lọc bỏ hết vì chỉ nhận string, và do `remindTimes` là mảng nên cũng bỏ qua `remindAt` ([reminder-target-args.util.ts:48-55](apps/api/src/zca/text/reminder-target-args.util.ts:48)). Kết quả là mất mọi giờ nhắc một lần.

**CF3: `remindAt` bị bỏ qua khi có `remindTimes`.** `Array.isArray(args.remindTimes) ? args.remindTimes : [args.remindAt]` ([reminder-target-args.util.ts:49](apps/api/src/zca/text/reminder-target-args.util.ts:49)). Nếu LLM điền `remindAt = A` và `remindTimes = [B, C]` (không lặp lại A), giờ A mất mà không báo. Schema mô tả hai trường tách rời nên LLM dễ trả kiểu này.

## 5. Phạm vi ảnh hưởng

- Mọi loại thẻ chờ có tool tương ứng: RECORD_TRANSACTION, MANAGE_DEBT, SET_REMINDER, CREATE_TASK, CREATE_CALENDAR_EVENT, CREATE_PLACE… Tin bổ sung không có `edit` luôn sinh thẻ mới, thẻ cũ treo tới hết hạn.
- Trường nhiều giá trị (giờ nhắc, người nhắc, nag) dễ mất nhất khi LLM dựng lại, ở cả luồng chính lẫn luồng `edit`.
- Chat 1-1 cũng bị (đường đi giống hệt; chỉ phần "Nhắc ai" khác).

## 6. Đề xuất sửa (chỉ logic, không đụng câu chữ)

Mức rủi ro: **MEDIUM**, vì thay đổi cách định tuyến tin ở mọi chat đang có thẻ chờ. Cần `implementation_plan.md` được duyệt trước khi sửa.

### Bước A: tin bổ sung của cùng người, cùng chat sẽ thay thẻ đang chờ (RC1, CF4)

Khuyến nghị: để LLM quyết định ý định, còn việc thay thế làm bằng code qua luồng sửa sẵn có.

1. Trong `TextInputService.process`, trước lời gọi LLM, lấy các thẻ còn hạn của người gửi **trong chat này**: `getPendingListForUser(senderId)` lọc `chatId === chatId`, chưa hết hạn, và `isTextToolType(actionType)`.
2. Nếu có, thêm vào system prompt một khối "THẺ ĐANG CHỜ XÁC NHẬN CỦA NGƯỜI NHẮN" (mã, loại, tiêu đề, tham số theo **dạng tham số tool**, xem B2). Đồng thời mở thêm một tool nội bộ `AMEND_PENDING { code, instruction }`, **chỉ khi có thẻ chờ**. Hướng dẫn: tin bổ sung hoặc sửa thẻ đó (đổi giờ, thêm/bớt người, "tag @X", sửa tiêu đề…) thì gọi `AMEND_PENDING`, không gọi lại tool tạo mới; yêu cầu mới độc lập thì gọi tool như thường.
3. Chặn `AMEND_PENDING` ngay trong vòng lặp tool call của `TextInputService` (không cần strategy riêng). Kiểm tra mã thuộc **chính người gửi** và **chat này** rồi đi vào luồng sửa hiện có. `processEdit` đã thu hồi thẻ cũ và xoá pending cũ ([transaction-confirmation.service.ts:1129-1132](apps/api/src/zca/confirmation/transaction-confirmation.service.ts:1129)), nên [446] biến mất, không còn tin hết hạn hay "Bạn còn 1". Trong `transaction-confirmation.service.ts` chỉ thêm một method public mỏng (ví dụ `amendPending(userId, chatId, code, instruction, onEdit)`) bọc `processEdit`, để hạn chế xung đột với session đang sửa câu chữ ở file này.
4. Quyền: sửa ngầm (không có `edit`) chỉ cho **chủ thẻ**. `edit <code>` tường minh giữ quy tắc hiện tại (chủ thẻ, tài khoản bot, người có quyền toàn cục).

Phương án đã cân nhắc và không chọn:
- Regex nhận diện câu bổ sung ("tag", "thêm", "đổi"…): dễ vỡ, dễ nuốt yêu cầu mới.
- Tự thay thẻ cũ khi LLM gọi lại cùng loại tool trong vài phút: sẽ xoá nhầm khi người dùng cố ý tạo việc thứ hai.

### Bước B: luồng sửa không làm mất dữ liệu (RC2, CF1–CF3)

1. **Mang đủ ngữ cảnh vào luồng sửa**: callback sửa ở [zca-bot-feature.service.ts:952-960](apps/api/src/zca/zca-bot-feature.service.ts:952) dùng chung builder `AgentInput` với luồng chính ([:1295-1312](apps/api/src/zca/zca-bot-feature.service.ts:1295)), có `taggedUsers`, `allowAiChat`, `triggerPrefixes`, `messageId`, trí nhớ.
2. **Đưa LLM tham số theo dạng tool**: thêm hàm thuần `pendingPayloadToToolArgs(actionType, payload)`. Với CREATE_TASK / SET_REMINDER: giờ một lần chuyển thành `remindTimes: string[]`, giờ lặp chuyển thành `repeatingTimes: [{ at, repeatType, repeatWeekdays }]`, bỏ `remindAt` trùng, bỏ `remindUsers` (người lấy từ tag). Dùng hàm này thay cho `JSON.stringify(pending.payload)` ở [text-input.service.ts:339](apps/api/src/zca/text/text-input.service.ts:339).
3. **Gộp tất định sau LLM**: `args = { ...oldArgs, ...newArgs }`. Khoá LLM **bỏ trống** thì giữ giá trị cũ; khoá được đặt **rỗng tường minh** (`""`, `[]`, `false`) thì xoá. Nhờ vậy "tag @Văn Đạt" giữ nguyên 8/3 và 20/10 dù LLM chỉ trả `title`.
4. **Người được nhắc khi sửa**: tin sửa có tag thì dùng những người được tag (thêm người gửi nếu `remindSelf`); không tag ai thì giữ `remindUsers` / `remindMode` của thẻ cũ. Truyền thẻ cũ vào strategy qua một trường tuỳ chọn của `TextToolContext` (ví dụ `amends?: PendingAction`), dùng ở `CreateTaskToolStrategy` và `SetReminderToolStrategy`.
5. **`reminderTimesFromArgs` gộp `remindAt` với `remindTimes`** (đã có khử trùng theo thời điểm) thay vì bỏ `remindAt` ([reminder-target-args.util.ts:49](apps/api/src/zca/text/reminder-target-args.util.ts:49)).

### Kiểm thử hồi quy đề xuất

- `text-input.service.spec.ts`:
  - Có thẻ CREATE_TASK 3 giờ nhắc của `u1` trong `g1`. Gửi "tag @Văn Đạt nha" với `taggedUsers: [Văn Đạt]`; LLM giả lần 1 trả `AMEND_PENDING { code }`, lần 2 trả `CREATE_TASK { title }`. Kỳ vọng: còn đúng 1 thẻ chờ (thẻ cũ bị xoá và thu hồi), payload mới có đủ 3 giờ (giữ repeat của 14/02), `remindUsers = [Văn Đạt]`.
  - Không mở `AMEND_PENDING` khi người gửi không có thẻ chờ, hoặc thẻ thuộc người khác / chat khác.
  - Đang có thẻ chờ mà LLM trả RECORD_TRANSACTION (yêu cầu độc lập) thì thẻ cũ vẫn còn.
  - `edit <code> đổi giờ 10h` không tag ai thì giữ `remindUsers` cũ.
- `reminder-target-args.util.spec.ts`: `remindAt` + `remindTimes` được gộp; `requestedTimesFromArgs(pendingPayloadToToolArgs(p))` khôi phục đúng `p.remindTimes` (round-trip).
- `zca-bot-feature` (spec hiện có): `edit <code> tag @X` mang `taggedUsers` vào `handleEditPendingAction`.
- Lệnh: `npm run test --workspace @zalobot/api`, `npm run typecheck --workspace @zalobot/api`, `npm run lint --workspace @zalobot/api`.

### Tài liệu cần cập nhật ở Phase 2

- `.agents/knowledge/global/zalo-response-layout.md` (quy tắc sửa: sửa ngầm bằng tin bổ sung, giữ trường cũ, người được nhắc) và `.agents/knowledge/global/zalo-command-intake.md` (bước 2 và 5), cùng bản tiếng Việt tương ứng trong `.agents/docs/global/`.
- `CONTEXT.md`: thêm thuật ngữ "Tin bổ sung" trong mục Thao tác chờ duyệt.

## 7. Còn chưa xác nhận và cách kiểm

- **Args chính xác LLM trả lúc 12:04**: tìm trong log server quanh 12:04 ngày 25/10/2026 dòng `LLM resolved tool "CREATE_TASK" with args:` ([text-input.service.ts:223-225](apps/api/src/zca/text/text-input.service.ts:223)) để biết LLM điền `repeatingTimes` / `remindAt` ra sao.
- **Trí nhớ ngắn hạn của nhóm**: xem trang cấu hình kênh (`/zca/thread?id=<threadId>`), mục "Ngữ cảnh".
- **Task đã lưu từ [950]**: trang `/activity` hoặc `/tasks` sẽ cho thấy chỉ có 1 lần nhắc (14/02/2027, hằng tháng). Cần sửa tay trên dashboard: thêm 8/3, 20/10, đổi 14/02 sang một lần.
- Không chạy được script tái hiện `requestedTimesFromArgs`: worktree chưa build `@zalobot/contracts`, và build sẽ ghi file ra repo. Kết luận dựa trên đọc code.

## 8. Ngoài phạm vi (đề xuất task riêng)

- **Không có kiểu lặp hằng năm.** `repeatType` chỉ có `daily | weekdays | weekly | monthly` ([text-tool.definitions.ts:336](apps/api/src/zca/text/text-tool.definitions.ts:336); CONTEXT.md, mục "Lặp lại"). Vì vậy ngay từ thẻ [446], LLM đã biến "14/2 mỗi năm" thành "hằng tháng" (sẽ nhắc vào ngày 14 mỗi tháng), còn 8/3 và 20/10 chỉ nhắc một lần năm 2027. "Sinh nhật Hằng" không có ngày nên bị bỏ mà bot không hỏi lại. Thêm `yearly` là thay đổi domain (contracts, `reminder-schedule`, UI dashboard, CONTEXT.md), nên làm riêng.

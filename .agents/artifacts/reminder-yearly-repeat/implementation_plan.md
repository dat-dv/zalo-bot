# Kế hoạch: nhắc dịp hằng năm + bot hỏi lại khi thiếu thông tin

Route: `implement` · Phase 1 (`inspect-and-plan`) · Rủi ro: **MEDIUM** (nhiều file, đổi hành vi bot; không có migration)
Cơ sở: [research_report.md](research_report.md) — người dùng chọn phương án **A + C1** ngày 25/10/2026.

## Mục tiêu

Với tin "mỗi dịp 14/2, 8/3, 20/10 và sinh nhật nhắc Đạt mua hoa", bot phải:

1. Tạo lời nhắc với ba giờ nhắc **lặp hằng năm**: 14/02/2027, 08/03/2027, 20/10/2027.
2. Đồng thời hỏi lại: "Sinh nhật ngày nào để mình nhắc?". Câu hỏi được gửi đi kể cả ở nhóm tắt trò chuyện tự do.
3. Không bao giờ dùng "Hàng tháng" cho một dịp hằng năm.

## Ngoài phạm vi

- Âm lịch: `yearly` chỉ tính theo dương lịch.
- Nhắc sinh nhật tự động từ trường `birthday` trong Hồ sơ.
- Sửa nhãn `(Lặp: monthly)` trong danh sách lời nhắc nhanh.
- Cách Việc lặp lại sau khi đánh dấu xong.
- Sửa bản ghi lỗi đang có trên prod. Người dùng tự đổi sang "Hàng năm" trên dashboard sau khi deploy.

## Các bước

### 1. Contracts — `packages/contracts/src/index.ts`

- `ReminderRepeatType` thêm `'yearly'`, `REMINDER_REPEAT_TYPES` thêm `'yearly'` ở cuối. Cập nhật comment: yearly = cùng ngày và tháng của giờ đó; 29/2 thì năm không nhuận nhắc 28/2.
- `shortestRepeatGapMinutes`: thêm `case 'yearly': return 365 * DAY_MINUTES;`.
- i18n: vi `'reminders.repeatType.yearly': 'Hàng năm'`, en `'reminders.repeatType.yearly': 'Yearly'`.

Kết quả: ô chọn lặp trên dashboard (`reminder-times-field.tsx`), cột Lặp lại trong bảng và thẻ xác nhận trên Zalo (`repeatLabel`) tự có "Hàng năm". Không phải sửa code web.

### 2. Bộ lập lịch — `apps/api/src/reminders/reminder-schedule.ts`

- `REPEATING_TYPES` thêm `'yearly'`.
- `nextOccurrence`: dùng chung vòng lặp với `monthly`, chỉ khác bước nhảy (1 tháng hoặc 12 tháng). Ngày lấy theo anchor, ngày đó không có trong tháng thì dùng ngày cuối tháng; giờ lấy theo anchor (giờ Việt Nam); các lần đã lỡ thì bỏ qua. Cập nhật comment của hàm.
- Thêm hàm thuần `upcomingTime(at, repeat, now)`. Hàm trả về `at` khi `at` còn ở tương lai hoặc giờ đó không lặp. Ngược lại, hàm trả về `nextOccurrence(at, at, repeat, now)`. Mục đích: một giờ **lặp** đưa vào mà đã qua thì bắt đầu từ lần kế tiếp. Điều này khớp quy tắc "lần bị lỡ không gửi bù".
  - Giới hạn đã biết: lần dời này lấy ngày mới làm anchor. Ví dụ giờ hằng tháng đặt ngày 31 đã qua, dời sang 30/11, thì các tháng sau sẽ nhắc ngày 30. Chấp nhận được, vì prompt yêu cầu LLM đưa ngày ở tương lai; hàm này chỉ là lưới an toàn.

### 3. Dùng `upcomingTime` ở ba chỗ nhận giờ nhắc từ bot

- `apps/api/src/zca/text/reminder-target-args.util.ts` → `requestedTimesFromArgs(args, now = new Date())`: mỗi mục `repeatingTimes` đã qua thì dời sang lần kế tiếp **trước khi** khử trùng lặp theo thời điểm. Nhờ vậy thẻ xác nhận hiện đúng ngày.
- `apps/api/src/zca/confirmation/transaction-confirmation.service.ts` → `toValidRemindTimes` (Việc, lúc duyệt): giờ lặp đã qua (thẻ có thể chờ tới 5 phút) thì dời, thay vì bỏ. Giờ một lần đã qua vẫn bỏ như cũ.
- Cùng file → `parseReminderPayload` (Lời nhắc, lúc duyệt): giờ lặp đã qua thì dời, thay vì gửi ngay. Giờ một lần đã qua vẫn gửi ở lượt quét kế tiếp như cũ.

### 4. Tool `ASK_CLARIFICATION` (C1)

- `text-tool.enum.ts`: thêm `ASK_CLARIFICATION`.
- `text-tool.definitions.ts`: thêm định nghĩa tool.
  - Mô tả: "Hỏi lại người dùng khi một yêu cầu cần dùng công cụ nhưng thiếu thông tin bắt buộc mà không suy ra được, ví dụ nhắc sinh nhật mà không nói ngày. Gọi **cùng lúc** với các tool cho phần đã đủ thông tin. Không dùng để trò chuyện hay hỏi lại điều đã rõ."
  - Tham số: `question` (STRING, bắt buộc), là một câu hỏi ngắn bằng tiếng Việt.
- Strategy mới `strategies/ask-clarification-tool.strategy.ts`: lấy `question` đã cắt khoảng trắng, tối đa 500 ký tự, rồi gửi bằng `zcaMessenger.sendMessage(chatId, question)`. Câu hỏi rỗng thì không gửi gì, chỉ ghi log cảnh báo.
- Đăng ký strategy ở `text-tool.providers.ts` và `text-tool.factory.ts` (thêm tham số tuỳ chọn ở **cuối** constructor để các spec hiện có không phải đổi thứ tự).
- `text-input.service.ts`: khi có nhiều tool call, chạy `ASK_CLARIFICATION` **sau cùng** (sắp xếp ổn định) để câu hỏi xuất hiện sau thẻ xác nhận. Vì đây là tool, câu hỏi được gửi kể cả khi `allowAiChat === false`.
- Không đụng tới: luồng `edit <code>`, vì nó chỉ đưa tool của thao tác đang chờ. Luồng ảnh hoá đơn dùng `ZALO_TOOL_DEFINITIONS` và chỉ xử lý `RECORD_TRANSACTION`; nếu LLM gọi `ASK_CLARIFICATION` ở đó thì bot rơi về câu báo hiện có ("nhắn lại thông tin chi tiêu"). Chấp nhận, không sửa.

### 5. Mô tả tool và prompt cho LLM

- `text-tool.definitions.ts`, trong cả `SET_REMINDER` và `CREATE_TASK`:
  - Enum `repeatType` thêm `yearly`; mô tả thêm "yearly = hằng năm (cùng ngày và tháng): ngày lễ 14/2, 8/3, 20/10, sinh nhật, ngày kỷ niệm".
  - Ví dụ trong `repeatingTimes` thêm "14/2 hằng năm".
  - Mô tả `at`: "lần gần nhất **trong tương lai**".
- `text-input.service.ts`, mục nhắc nhở của system prompt:
  - Dịp hằng năm ("mỗi dịp", "hằng năm", "mỗi năm", sinh nhật, kỷ niệm) → `repeatType: yearly`, `at` = lần gần nhất trong tương lai. **Không** dùng `monthly` cho dịp hằng năm.
  - Dịp hằng năm ưu tiên `SET_REMINDER` thay vì `CREATE_TASK`, trừ khi người dùng nói rõ "thêm việc". Lý do: đánh dấu Việc là xong sẽ dừng nhắc mọi năm sau.
- Thêm vào mục "QUY TẮC QUAN TRỌNG KHI GỌI TOOL":
  - **Thiếu thông tin**: phần nào của yêu cầu thiếu thông tin bắt buộc không suy ra được thì không đoán, không bỏ qua. Gọi `ASK_CLARIFICATION` cho phần đó, vẫn gọi tool cho phần đã đủ.
  - Bot chỉ tính dương lịch: người dùng nói "âm lịch" thì hỏi lại hoặc nói rõ qua `ASK_CLARIFICATION`.

### 6. Comment entity (không có migration)

`reminder-time.entity.ts`, `task-reminder-time.entity.ts`: comment `repeat_type` thêm `yearly`, comment `anchor_at` thêm "a yearly repeat keeps its day and month". Cột là `varchar` không có CHECK, nên không cần migration.

### 7. Test

| File | Ca kiểm tra |
| --- | --- |
| `apps/api/src/reminders/reminder-schedule.spec.ts` | yearly: 14/2/2027 08:00 → 14/2/2028 08:00 (giờ VN); anchor 29/2/2028 → 28/2/2029 → … → 29/2/2032; bỏ qua các năm đã lỡ; `repeatOf({ repeatType: 'yearly' })`; `claimedState` dời `remindAt` và giữ `anchorAt`; `checkReminderRules` chấp nhận nhắc lại 24h × 10 với yearly; `upcomingTime` (tương lai giữ nguyên, quá khứ dời, không lặp giữ nguyên) |
| `apps/api/src/zca/text/reminder-target-args.util.spec.ts` | `repeatingTimes` yearly được nhận; `at` = 20/10/2026 khi now = 25/10/2026 → 20/10/2027 |
| `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts` | `toValidRemindTimes` dời giờ lặp đã qua, vẫn bỏ giờ một lần đã qua; `parseReminderPayload` dời giờ lặp đã qua, giữ giờ một lần đã qua |
| `apps/api/src/zca/confirmation/compact-summary.util.spec.ts` hoặc `dto-descriptor.util.spec.ts` | thẻ hiện "(hàng năm)" |
| `apps/api/src/zca/text/strategies/ask-clarification-tool.strategy.spec.ts` (mới) | gửi câu hỏi đã cắt khoảng trắng; câu hỏi rỗng thì không gửi; cắt còn 500 ký tự |
| `apps/api/src/zca/text/text-input.service.spec.ts` | `ASK_CLARIFICATION` chạy sau `SET_REMINDER`; vẫn gửi khi `allowAiChat === false` |
| `apps/api/src/zca/text/text-tool.factory.spec.ts` | factory trả về strategy mới |

### 8. Tài liệu (Hard Completion Gate)

- `CONTEXT.md`, mục "Lặp lại": thêm "hằng năm (cùng ngày và tháng; 29/2 thì năm không nhuận nhắc 28/2), chỉ tính dương lịch"; thêm "giờ lặp đặt vào thời điểm đã qua thì bắt đầu từ lần kế tiếp".
- Knowledge (EN):
  - `modules/reminders/README.md`: mục Repeat, `upcomingTime`, các chỗ dùng ở bước 3.
  - `modules/tasks/README.md`: giờ lặp đã qua lúc duyệt được dời.
  - `modules/zca/README.md`: 16 tool, `ASK_CLARIFICATION`.
  - `global/llm-providers.md`: tool catalog, thứ tự chạy, hành vi khi `allowAiChat` tắt.
  - `global/zalo-command-intake.md`: bước 5.
- Docs (VI), cùng nội dung bằng tiếng Việt: `modules/reminders/README.md` (thêm dòng "Hằng năm" vào bảng mục 2b), `modules/tasks/README.md`, `modules/zca/README.md`, `global/llm-providers.md`, `global/zalo-command-intake.md`. Không có file docs mới, nên không phải sửa `.agents/docs/README.md`, trừ khi lệnh kiểm tra drift yêu cầu.

## Kiểm chứng

```bash
npm run typecheck
npm run lint
npm run test --workspace @zalobot/api
npm run test --workspace @zalobot/web
node .claude/hooks/docs-drift-check.mjs
```

Các lệnh trên **không** kiểm chứng được cách LLM thật chọn tool. Cần thử tay sau khi deploy, trong một nhóm test, với đúng câu trong log 25/10, rồi kiểm tra ba điều:

1. Thẻ xác nhận có ba giờ "(hàng năm)".
2. Bot hỏi ngày sinh nhật.
3. Không có "Hàng tháng".

## Rollback

- Code cũ đọc `yearly` thành `none`. Lần nhắc sẽ chạy một lần rồi được đánh dấu đã gửi, không có lỗi.
- Không có migration nên không phải hoàn tác dữ liệu.

## Commit

Một commit trên branch `claude/confident-snyder-c01b12`, gồm cả artifact. Hook pre-commit tự tăng version và ghi CHANGELOG; không sửa version bằng tay. Việc merge vào `main` sẽ hỏi lại người dùng.

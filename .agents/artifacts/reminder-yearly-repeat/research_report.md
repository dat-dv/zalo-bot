# Nhắc các dịp lặp lại hằng năm (14/2, 8/3, 20/10, sinh nhật)

Route: `research` · Authority: `research-only` · Ngày: 25/10/2026 · Mã nguồn tại `b8e081c`

## 1. Câu hỏi

Log nhóm Zalo ngày 25/10/2026: một người nhờ bot "mỗi dịp 14/2, 8/3, 20/10 nhắc Đạt mua hoa", kèm sinh nhật nhưng không nói ngày. Bot chọn kiểu lặp **Hàng tháng** cho 14/2, nên việc đã lưu sẽ nhắc vào ngày 14 mỗi tháng từ 02/2027. Sinh nhật bị bỏ qua mà không hỏi lại.

Cần chọn: (A) thêm kiểu lặp `yearly`, hay (B) chỉ sửa mô tả tool/prompt.

## 2. Phát hiện từ mã nguồn

| # | Phát hiện | Bằng chứng |
| --- | --- | --- |
| F1 | Không có kiểu lặp theo năm. Tool của LLM chỉ cho `daily`, `weekdays`, `weekly`, `monthly`, nên với dịp hằng năm LLM chỉ chọn được giá trị gần nhất là `monthly`. | `packages/contracts/src/index.ts:3224` (`ReminderRepeatType`), `apps/api/src/zca/text/text-tool.definitions.ts:153` và `:336` (enum) |
| F2 | Cột `repeat_type` là `varchar` và không có ràng buộc CHECK, ở cả `reminder_times` lẫn `task_reminder_times` (cột cũ `reminders.repeat_type` cũng vậy). Thêm một giá trị mới **không cần migration schema**. | `apps/api/src/database/migrations/1724960000000-AddReminderRepeatAndNag.ts:33,41`, `1724650000000-InitSchema.ts:69` |
| F3 | Bộ lập lịch đã có sẵn mẫu dùng `anchor_at` cho `monthly` (giữ ngày gốc, tháng ngắn hơn thì dùng ngày cuối tháng). `yearly` làm theo đúng mẫu đó: giữ ngày và tháng của anchor, 29/2 thì năm không nhuận nhắc 28/2. `shortestRepeatGapMinutes` là một `switch` liệt kê đủ mọi kiểu, nên thiếu nhánh mới là `typecheck` báo lỗi ngay. | `apps/api/src/reminders/reminder-schedule.ts:76-108`, `:119` (`REPEATING_TYPES`); `packages/contracts/src/index.ts:3263-3285` |
| F4 | Dashboard và thẻ xác nhận trên Zalo **tự hiện kiểu lặp mới**: ô chọn lặp render từ `REMINDER_REPEAT_TYPES`, nhãn lấy theo khoá i18n `reminders.repeatType.<type>` (bảng, thẻ xác nhận, `repeatLabel`). Chỉ cần thêm khoá vi/en. | `apps/web/src/modules/dashboard/presentation/components/reminder-times-field.tsx:110`, `reminders-table.tsx:116`, `apps/api/src/reminders/reminder-rule.format.ts:24` |
| F5 | **Không thể làm bot "hỏi lại" cho chắc chỉ bằng prompt.** Khi LLM vừa gọi tool vừa trả về text, phần text bị bỏ. Khi LLM chỉ trả về text (câu hỏi lại), câu đó bị thay bằng kết quả của một lượt gọi LLM thứ hai không có tool, vốn không biết ngữ cảnh tool và có thể trả lời kiểu "ok mình sẽ nhắc". Ở kênh tắt `allowAiChat` thì bot im lặng luôn. | `apps/api/src/zca/text/text-input.service.ts:204-275` (`chitChatReply ?? response.text`, `if (input.allowAiChat === false) return;`) |
| F6 | Một **Việc** đã xong thì dừng mọi lần nhắc, kể cả các lần lặp ở những năm sau. Nếu ai đó đánh dấu "mua hoa" là xong sau 14/2, bot sẽ không nhắc 8/3, 20/10 và cả năm sau. Bấm "Đã xong" trên một **Lời nhắc** cũng dừng hẳn, nhưng lời nhắc không có trạng thái "cần làm/đã xong" theo nghĩa công việc, nên ít bị bấm nhầm hơn. | `CONTEXT.md` mục "Nhắc việc", "Lời nhắc đã xong"; `.agents/knowledge/modules/reminders/README.md` mục *Repeat & remind again* |
| F7 | Giờ nhắc đã qua trong payload bị **bỏ âm thầm**. Nếu LLM ghi 20/10/2026 (đã qua so với 25/10/2026) cho một dịp hằng năm, lần đó biến mất thay vì được dời sang 20/10/2027. | `apps/api/src/zca/confirmation/transaction-confirmation.service.ts:118-131` (`toValidRemindTimes`) |
| F8 | Hồ sơ Người liên quan đã có trường `birthday` (`date`, `YYYY-MM-DD`). Đây là nguồn ngày sinh có thể dùng sau này, hiện chưa nối với nhắc. | `apps/api/src/database/entities/debt-contact.entity.ts:60-61` |
| F9 | Lỗi phụ: lệnh xem lời nhắc nhanh in thẳng giá trị kỹ thuật `(Lặp: monthly)` thay vì nhãn tiếng Việt. Lỗi này có với mọi kiểu lặp, không chỉ kiểu mới. | `apps/api/src/zca/text/strategies/reminders-quick-tool.strategy.ts:38` |

**Suy luận (chưa kiểm chứng trên log)**: thẻ xác nhận có hiện "(hàng tháng)" cạnh giờ nhắc (`compact-summary.util.ts:203`), nên người duyệt đã có thể thấy lỗi. Nhưng một thẻ có nhiều giờ nhắc thì dễ bị duyệt mà không đọc kỹ.

## 3. Các phương án

### A. Thêm kiểu lặp `yearly`, kèm sửa mô tả tool và prompt

Những chỗ phải sửa:

| Tầng | File | Thay đổi |
| --- | --- | --- |
| Contracts | `packages/contracts/src/index.ts` | `ReminderRepeatType` + `REMINDER_REPEAT_TYPES` thêm `'yearly'`; `shortestRepeatGapMinutes` → 365 ngày; comment; i18n `reminders.repeatType.yearly` = `Hàng năm` / `Yearly` |
| Scheduler | `apps/api/src/reminders/reminder-schedule.ts` | `REPEATING_TYPES` + nhánh `yearly` trong `nextOccurrence` (ngày/tháng của anchor, giờ của anchor, 29/2 → 28/2 rồi trở lại 29/2 ở năm nhuận); test trong `reminder-schedule.spec.ts` |
| LLM | `apps/api/src/zca/text/text-tool.definitions.ts` (2 chỗ), `text-input.service.ts` (prompt) | enum + mô tả `yearly = hằng năm (cùng ngày tháng)`; ví dụ "14/2 hằng năm", "sinh nhật 5/7"; quy tắc: ngày lễ/sinh nhật/kỷ niệm → `yearly`, **không** dùng `monthly`; `at` = lần gần nhất **trong tương lai** |
| DB | không có migration | Chỉ sửa comment ở `reminder-time.entity.ts` và `task-reminder-time.entity.ts` |
| Web | không phải sửa code | Ô chọn và bảng tự có "Hàng năm" (F4); có thể thêm test hiển thị |
| Docs | `CONTEXT.md` ("Lặp lại"), knowledge + docs `modules/reminders`, `modules/tasks` | Cập nhật định nghĩa và hợp đồng |

- **Ưu**: đúng nghiệp vụ, dùng được cả trên Zalo lẫn dashboard, khớp mẫu sẵn có (`monthly` + `anchor_at`), không cần migration.
- **Rủi ro**: thấp. Nếu rollback code cũ, `repeatOf` sẽ đọc `yearly` thành `none`: lần nhắc chạy một lần rồi bị đánh dấu đã gửi, không có lỗi. Down-migration `1724960000000` đã đưa mọi giá trị lạ về `none`.
- **Khối lượng**: nhỏ đến vừa (khoảng 6 file code + test + docs).

### B. Chỉ sửa mô tả tool và prompt (không thêm kiểu lặp)

Với mô hình hiện tại, bot không thể lưu một lần nhắc lặp theo năm. LLM chỉ còn ba cách:

1. Tạo **một lần nhắc duy nhất** cho dịp kế tiếp (14/02/2027…), rồi báo "bot chưa hỗ trợ lặp hằng năm". Bot trả lời thật thà, nhưng từ 2028 sẽ không nhắc nữa.
2. Tạo sẵn nhiều lần nhắc một lần (3 dịp × 3 năm = 9, gần chạm giới hạn 10). Danh sách rối, hết hạn âm thầm, mỗi việc chỉ chứa được khoảng 3 năm.
3. Từ chối và chỉ người dùng tự tạo trên dashboard, nhưng dashboard cũng không có kiểu lặp năm.

- **Ưu**: sửa rất ít, chỉ đụng prompt.
- **Nhược**: **không đáp ứng yêu cầu** "mỗi dịp hằng năm". Việc hỏi lại sinh nhật vẫn không chạy được, vì prompt không khắc phục được F5.

### C. Cơ chế hỏi lại khi thiếu thông tin (bổ sung cho A hoặc B)

F5 cho thấy một câu dặn trong prompt kiểu "hãy hỏi lại khi thiếu ngày" sẽ không đến được người dùng. Có hai cách:

- **C1 (khuyến nghị)**: thêm tool `ASK_CLARIFICATION { question }`. LLM gọi tool này **song song** với `CREATE_TASK`/`SET_REMINDER`, ví dụ: tạo nhắc cho 14/2, 8/3, 20/10 và hỏi "Sinh nhật ngày nào để mình nhắc?". Strategy gửi đúng câu hỏi đó vào chat. Vì đây là tool nên vẫn chạy khi `allowAiChat` tắt, và dùng lại được cho các tool khác (thiếu số tiền, thiếu người…).
- **C2**: thêm trường `followUpQuestion` vào hai tool nhắc. Cách này hẹp hơn và gượng khi người dùng **chỉ** nói "nhắc sinh nhật" mà không có ngày nào khác, vì khi đó không có lần nhắc nào để gắn câu hỏi vào.

Đi kèm: khi một giờ nhắc **có lặp** mà `at` đã qua (F7), dời `at` sang lần lặp kế tiếp (`nextOccurrence`) thay vì bỏ. Lần nhắc một lần đã qua thì vẫn bỏ như hiện nay.

### So sánh

| Tiêu chí | A | B | A + C1 |
| --- | --- | --- | --- |
| Nhắc đúng 14/2, 8/3, 20/10 mỗi năm | ✅ | ❌ (chỉ 1 lần hoặc vài năm) | ✅ |
| Không dùng nhầm `monthly` | ✅ (có lựa chọn đúng + prompt) | ⚠️ (LLM vẫn phải tự xoay xở) | ✅ |
| Hỏi lại ngày sinh nhật | ❌ | ❌ | ✅ |
| Migration DB | không | không | không |
| Dashboard | tự có "Hàng năm" | không đổi | tự có "Hàng năm" |
| Khối lượng | nhỏ–vừa | rất nhỏ | vừa |
| Rủi ro | thấp | thấp | thấp–vừa (thêm tool vào catalog, phải thử với cả 3 provider) |

## 4. Khuyến nghị

**Làm A + C1** trong cùng một thay đổi:

1. Thêm `yearly` (contracts, scheduler, tool, prompt, i18n, docs).
2. Thêm tool `ASK_CLARIFICATION` để bot hỏi ngày khi người dùng nhắc tới dịp mà không có ngày.
3. Một lần nhắc **có lặp** với `at` đã qua thì dời sang lần kế tiếp thay vì bỏ.
4. Prompt hướng dẫn: với dịp hằng năm ("mỗi dịp", "hằng năm", "sinh nhật", "kỷ niệm"), ưu tiên **Lời nhắc** (`SET_REMINDER`) thay vì Việc, trừ khi người dùng nói rõ "thêm việc". Lý do là F6: đánh dấu Việc là xong sẽ dừng mọi năm sau.

Phương án B riêng lẻ không đủ: nó chỉ giúp bot không nhắc sai, chứ không làm được việc nhắc hằng năm.

## 5. Điểm chưa chắc / cần người dùng quyết định

1. **Việc hay Lời nhắc cho dịp hằng năm?** Khuyến nghị là Lời nhắc (F6). Nếu muốn giữ là Việc, cần một quy tắc mới, ví dụ việc có lần lặp năm tự mở lại sau mỗi lần nhắc. Thay đổi đó lớn hơn và nằm ngoài phạm vi này.
2. **Âm lịch**: nhiều sinh nhật, ngày giỗ ở Việt Nam tính theo âm lịch. `yearly` ở đây chỉ tính theo **dương lịch**. Đề xuất cho LLM nói rõ là chưa hỗ trợ âm lịch khi người dùng nhắc tới, và để âm lịch làm phần sau nếu cần (phải có bảng hoặc thư viện đổi lịch).
3. **Bản ghi lỗi đang có** (việc 14/2 lặp hằng tháng): sau khi deploy, nên sửa tay trên dashboard (đổi sang "Hàng năm") thay vì viết migration dữ liệu. Đây là dữ liệu prod, chỉ người dùng mới làm được.
4. **C1 hay C2** cho cơ chế hỏi lại.

## 6. Ngoài phạm vi, nên làm riêng

- F9: hiện nhãn tiếng Việt thay vì `(Lặp: monthly)` trong danh sách lời nhắc nhanh.
- F8: nhắc sinh nhật tự động từ `birthday` trong Hồ sơ Người liên quan.

## 7. Bước tiếp theo đề xuất

Nếu người dùng chọn **A + C1**: chuyển sang route `implement`, viết `.agents/artifacts/reminder-yearly-repeat/implementation_plan.md` (các bước, test cho `nextOccurrence` năm nhuận và dời `at` đã qua, thử prompt với log thật), rồi dừng chờ duyệt trước khi sửa code.

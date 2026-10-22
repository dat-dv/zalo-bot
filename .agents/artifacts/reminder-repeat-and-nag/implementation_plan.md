# Kế hoạch (bản 2): "Lặp lại" riêng cho từng giờ nhắc và "Nhắc lại" cho việc cần làm và lời nhắc

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Mức rủi ro: **HIGH**. Có thay đổi schema DB (có chuyển dữ liệu), thuật toán quét và giành quyền gửi của BullMQ, contract API, form web và tool của bot.
- Branch: `feat/reminder-repeat-and-nag`, worktree `.claude/worktrees/repeat-nag`, tách từ `main` local `08b8a6f`.
  - `08b8a6f` gồm tab "Đã xong" và "Nhắc ai", **chưa push**. Khi push việc này, 2 commit đó sẽ đi kèm; em hỏi anh trước khi push.

## 0. Vì sao có bản 2

Bản 1 (anh đã duyệt) lưu quy tắc lặp ở **bảng cha** (`tasks` / `reminders`), nên mọi giờ của một việc hay một lời nhắc đều lặp giống nhau.

Anh yêu cầu thêm (qua phiên "Xem lại reminder cũ"): **mỗi giờ nhắc có ô Lặp lại riêng**, áp cho cả trang lời nhắc lẫn trang việc cần làm. Ví dụ cùng một lời nhắc: 08:00 lặp hằng ngày, còn 14:00 ngày 25/10 chỉ nhắc một lần.

Em đã dừng viết code khi nhận yêu cầu. Phần đã viết dở, **chưa commit**, nằm trong worktree:

| Phần đã làm | Dùng lại được? |
| --- | --- |
| Contracts: `ReminderRepeatType` (5 mẫu), `REMINDER_NAG_LIMITS`, `validateReminderRule`, i18n | Có; sửa để kiểm tra theo từng giờ |
| `reminders/reminder-schedule.ts` (hàm thuần `nextOccurrence`, `dueOccurrence`, `claimedState`, `releasedState`) và 12 test | Có; chỉ đổi chỗ lấy quy tắc lặp: từ dòng giờ thay vì bảng cha |
| Migration `1724950000000-AddReminderRepeatAndNag` và entity | **Viết lại**: cột lặp chuyển xuống bảng giờ, thêm bước chép dữ liệu |
| `RemindersService`, `TasksService`, hai scheduler, payload BullMQ (`nag`), jobId theo từng lần gửi | Có; sửa phần đọc và ghi quy tắc |
| Thẻ xác nhận bot (dòng Lặp lại / Nhắc lại) | Sửa để hiện theo từng giờ |
| Web | Chưa làm |

## 1. Yêu cầu (đã chốt)

1. **Lặp lại riêng từng giờ nhắc:** Không lặp / Hằng ngày / Ngày thường (T2–T6) / Hằng tuần (chọn nhiều thứ; không chọn thì lặp đúng thứ của giờ đó) / Hằng tháng (cùng ngày; tháng ngắn hơn thì dùng ngày cuối tháng). Lần bị lỡ không gửi bù.
2. **Nhắc lại:** sau mỗi lần nhắc, nhắc thêm mỗi X phút/giờ (5 phút – 24 giờ), tối đa N lần (1–10).
   - Việc cần làm: dừng khi việc xong hoặc bị xoá.
   - Lời nhắc: dừng khi bấm Đã xong hoặc bị xoá.
   - **Dùng chung** cho cả việc hay lời nhắc (anh chọn phương án a): một quy tắc ở bảng cha, áp cho mọi giờ của việc / lời nhắc đó.
3. Việc cần làm bấm "xong" là dừng hết mọi lần nhắc. Mở lại thì lặp chạy tiếp từ lần kế tiếp sau lúc mở lại, không gửi bù.
4. Áp cho cả việc cần làm (`/tasks`: `CreateTaskDialog`, sửa trong `TasksTable`) và lời nhắc (`/reminders`: dialog, sửa trong bảng). **Giữ nguyên tab "Đã xong"** của lời nhắc.

## 2. Dữ liệu (1 migration, có chép dữ liệu)

Viết lại migration `1724950000000-AddReminderRepeatAndNag` (chưa chạy ở đâu nên được phép viết lại):

| Bảng | Thay đổi |
| --- | --- |
| `task_reminder_times`, `reminder_times` | Thêm `repeat_type varchar default 'none'`, `repeat_weekdays smallint[] default '{}'`, `anchor_at`, `nag_at`, `nag_left int default 0`. Các cột thời gian dùng cùng kiểu với `remind_at` của bảng đó |
| `tasks`, `reminders` | Thêm `nag_every_minutes int null`, `nag_count int null` (Nhắc lại dùng chung cho cả việc / lời nhắc) |
| Chép dữ liệu | `UPDATE reminder_times t SET repeat_type = r.repeat_type FROM reminders r WHERE t.reminder_id = r.id AND r.repeat_type <> 'none'` ⇒ lời nhắc lặp cũ chạy y như trước |
| `reminders.repeat_type` | **Giữ cột** để rollback an toàn, code mới không đọc nữa. Khi lưu, ghi giá trị "đại diện" (lặp của giờ đầu tiên) để bản cũ còn hiểu. Xoá cột ở một bản sau |
| `down()` | Chép ngược lặp của giờ đầu tiên lên `reminders.repeat_type` (đổi `weekdays` và `monthly` thành `none`), rồi xoá các cột mới |

## 3. Thuật toán

Giữ nguyên các phần sau từ bản 1:
- `nextOccurrence` theo giờ Việt Nam;
- quét lấy cả lần chính lẫn lần nhắc lại (`(sent_at IS NULL AND remind_at <= now) OR (nag_at <= now)`);
- giành quyền gửi bằng UPDATE có điều kiện;
- jobId riêng cho từng lần gửi, tin nhắc lại có dòng "🔁 Nhắc lại k/N";
- lời nhắc một lần chỉ tính là xong khi đã hết nhắc lại;
- mở lại việc thì dời lần bị lỡ.

Chỉ khác: **quy tắc lặp đọc từ chính dòng giờ** (`time.repeatType`, `time.repeatWeekdays`); **quy tắc nhắc lại đọc từ bảng cha** (`nag_every_minutes`, `nag_count`). Trạng thái nhắc lại (`nag_at`, `nag_left`) vẫn theo từng dòng giờ.

Kiểm tra đầu vào:
- Nhắc lại phải kết thúc trước lần lặp kế tiếp của **từng giờ** có lặp (`X × N` nhỏ hơn khoảng lặp ngắn nhất của giờ đó).
- Thứ trong tuần là 0–6.

## 4. API và contracts

- `IReminderTime` (trả về) thêm `repeatType`, `repeatWeekdays`.
- Request tạo/sửa của **task** và **reminder**: `remindTimes` nhận **cả hai dạng**:
  - dạng cũ: `string[]` (ISO), lặp lấy từ `repeatType` / `repeatWeekdays` cấp ngoài nếu có, không có thì `none`. Dạng này giữ cho bot, pending action cũ và client cũ chạy được;
  - dạng mới: `{ remindAt: string; repeatType?: ReminderRepeatType; repeatWeekdays?: number[] }[]`.
- Khi sửa danh sách giờ:
  - giờ giữ nguyên (cùng thời điểm) vẫn giữ dấu đã gửi;
  - nếu quy tắc lặp của giờ đó đổi thì cập nhật quy tắc, giữ trạng thái gửi;
  - giờ lặp đã bị dời `remind_at` thì đối chiếu theo `remind_at` hiện tại (đúng như hành vi đang có).
- `repeatType` cấp ngoài của lời nhắc vẫn được nhận (dạng cũ) và áp cho mọi giờ không ghi quy tắc riêng.
- List item: `repeatType` cấp ngoài của lời nhắc trả về giá trị "đại diện" cho client cũ. Client mới đọc từ `remindTimes[].repeatType`.

## 5. Web

- `ReminderTimesField`: **mỗi dòng giờ** thêm ô Lặp lại (select 5 mẫu). Chọn "Hằng tuần" thì hiện hàng nút T2…CN ngay dưới dòng đó. Có bản `compact` cho ô sửa trong bảng.
- Dùng chung cho dialog và sửa trong bảng của cả việc cần làm lẫn lời nhắc. Select "Lặp lại" cũ ở cấp lời nhắc **bị bỏ**.
- Nhắc lại: **một** công tắc "Nhắc lại" + "Mỗi …" + "Tối đa … lần", đặt dưới danh sách giờ, áp cho mọi giờ.
- Bảng: ô Nhắc lúc hiện "🔁 Hàng ngày" cạnh từng giờ, và tóm tắt nhắc lại.
- Model thuần trong `modules/reminders/model/reminder-times.ts` và file mới `reminder-repeat.ts`, có test.
- Không đụng logic tab "Đã xong" (`reminder-list-status.ts`, query `?status=`).

## 6. Bot

- `SET_REMINDER` và `CREATE_TASK`: thêm tham số `remindTimes` dạng object `{ at, repeatType?, repeatWeekdays? }[]`, vẫn nhận dạng cũ (`remindTimes: string[]`, `remindAt`, `repeatType`).
- Prompt: "8h hằng ngày và 14h thứ 7 tuần này" ⇒ hai giờ, giờ đầu `daily`, giờ sau `none`.
- Thẻ xác nhận và tóm tắt hiện từng giờ kèm lặp: "08:00 (hằng ngày), 14:00 25/10".

## 7. Kiểm thử

- Hàm thuần: lặp theo từng giờ; kiểm tra nhắc lại theo từng giờ.
- Service:
  - lời nhắc có hai giờ, một giờ lặp một giờ không: giờ lặp dời sang lần sau, giờ không lặp được đánh dấu gửi; lời nhắc chỉ xong khi giờ không lặp đã gửi **và** không còn giờ lặp nào (giờ lặp không bao giờ tự xong);
  - đổi quy tắc của giờ giữ nguyên.
- Migration: chạy `up` rồi `down` trên Postgres local (docker), kiểm tra lời nhắc `daily` cũ vẫn `daily` ở từng giờ.
- Web: model và form; tab Đã xong vẫn chạy.
- Bot: parse cả dạng cũ lẫn dạng mới.
- Chạy đủ typecheck, lint, test, build cho api, web, contracts; drift check.

## 8. Tài liệu

- Knowledge (EN) và docs (VI): `modules/reminders`, `modules/tasks`, `modules/dashboard`, `global/backend-runtime-services`.
- CONTEXT.md:
  - **Lần nhắc:** mỗi lần nhắc có thể lặp riêng.
  - Thêm **Lặp lại**, **Nhắc lại**.
  - **Nhắc việc:** có thể lặp và nhắc lại.

## 9. Đã chốt với anh

1. Lặp lại riêng cho từng giờ nhắc (yêu cầu chuyển qua phiên "Xem lại reminder cũ").
2. Nhắc lại **dùng chung** cho cả việc / lời nhắc (phương án a).

Còn chờ: anh duyệt bản 2 để em làm tiếp trên phần code đã có.

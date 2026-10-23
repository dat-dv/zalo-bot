# Walkthrough: Lặp lại riêng từng giờ nhắc và Nhắc lại tới khi xong

Branch: `feat/reminder-repeat-and-nag`, worktree `.claude/worktrees/repeat-nag`, tách từ `main` local `08b8a6f` (gồm tab Đã xong và Nhắc ai, chưa push).

## Đã làm (theo plan bản 2, phương án a)

- **Contracts:**
  - `ReminderRepeatType` có 5 kiểu: không lặp, hằng ngày, ngày thường, hằng tuần, hằng tháng.
  - Thêm `REMINDER_NAG_LIMITS`, `REMINDER_NAG_EVERY_OPTIONS`, `validateReminderRule`.
  - `IReminderTime` (dữ liệu trả về) có thêm `repeatType` và `repeatWeekdays`.
  - Thêm `IReminderTimeInput`. `ReminderTimeRequest` nhận cả chuỗi ISO lẫn dạng có kiểu lặp.
  - Thêm `nagEveryMinutes` / `nagCount` cho việc cần làm và lời nhắc; thêm chuỗi i18n vi/en.
- **Dữ liệu** (migration `1724960000000-AddReminderRepeatAndNag`):
  - Bảng giờ nhắc thêm `repeat_type`, `repeat_weekdays`, `anchor_at`, `nag_at`, `nag_left`.
  - `tasks` và `reminders` thêm `nag_every_minutes`, `nag_count`.
  - Kiểu lặp cũ của lời nhắc được chép xuống từng giờ.
- **API:**
  - Module thuần `reminder-schedule.ts`:
    - `nextOccurrence` tính theo giờ Việt Nam;
    - `dueOccurrence` / `claimedState` / `releasedState` cho bước quét, giành quyền gửi và trả lại;
    - `repeatChangeState` khi một giờ đổi kiểu lặp;
    - `checkReminderRules` để kiểm tra nhắc lại.
  - `planReminderTimes` mang theo kiểu lặp của từng giờ (`repeatChanges` cho giờ giữ nguyên nhưng đổi kiểu lặp).
  - Hai service và hai scheduler: quét cả lần chính lẫn lần nhắc lại; mỗi lần gửi một jobId; tin nhắc lại có "🔁 Nhắc lại k/N".
  - Việc xong hoặc lời nhắc Đã xong thì xoá nhắc lại đang chờ. Mở lại việc thì dời giờ lặp đã lỡ sang lần kế tiếp.
- **Bot:**
  - Tham số mới `repeatingTimes` (`{ at, repeatType, repeatWeekdays }`), `nagEveryMinutes`, `nagCount`; prompt được cập nhật.
  - Payload chờ duyệt lưu giờ kèm kiểu lặp, khôi phục lại sau khi qua Redis.
  - Thẻ xác nhận và tóm tắt ghi từng giờ kèm kiểu lặp, cùng dòng Nhắc lại.
- **Web:**
  - `ReminderTimesField`: mỗi dòng có select Lặp lại, chọn Hằng tuần thì hiện nút T2…CN.
  - Component mới `ReminderNagFields` cho phần Nhắc lại.
  - Dùng ở dialog tạo và ô sửa trong bảng của cả việc cần làm lẫn lời nhắc. Bỏ select "Kiểu lặp" chung cũ.
  - Bảng hiện 🔁 khi có giờ lặp, kèm tóm tắt nhắc lại.
- **Tài liệu:** knowledge/docs của reminders, tasks, dashboard, backend-runtime-services; CONTEXT.md (Lần nhắc, Lặp lại, Nhắc lại, Nhắc việc, Lời nhắc đã xong).

## Kiểm chứng

- API: typecheck, lint, test (652) và build đều pass.
- Web: typecheck, lint, test (130) và build đều pass. Contracts: typecheck và lint pass.
- Migration trên Postgres 16 tạm (container, đã xoá sau khi chạy):
  - chạy đủ chuỗi migration;
  - down rồi up với dữ liệu mẫu: lặp `daily` được chép xuống cả hai giờ, `monthly` thành `none` khi down;
  - up lại chạy được.
- Tích hợp với Postgres thật:
  - quét và giành quyền gửi: giờ một lần được đánh dấu gửi, giờ hằng ngày được dời; lượt quét thứ hai không lấy lại gì;
  - 11 phút sau đến lượt nhắc lại 1/2;
  - lời nhắc có giờ lặp không tự xong;
  - việc "ngày thường" vào thứ 6 được dời sang thứ 2; bấm xong thì xoá nhắc lại.
- `docs-drift-check`: PASS.
- **Chưa thử tay giao diện** (browser pane không mở được dev server local) và **chưa thử bot thật** trên Zalo.

## Lưu ý khi đưa lên

- Khi push nhánh này lên `main` thì 2 commit chưa push (`d995567` tab Đã xong và commit merge `08b8a6f`) sẽ đi kèm.
- Migration chỉ thêm cột và chép dữ liệu nhỏ; rollback được.

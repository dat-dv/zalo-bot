# Walkthrough: nhắc dịp hằng năm + bot hỏi lại

Thực hiện theo [implementation_plan.md](implementation_plan.md), được duyệt ngày 25/10/2026.

## Đã làm

1. **Kiểu lặp `yearly` ("Hàng năm")**
   - Contracts: `ReminderRepeatType`, `REMINDER_REPEAT_TYPES`, khoảng cách tối thiểu giữa hai lần lặp là 365 ngày, nhãn vi/en.
   - Dashboard và thẻ xác nhận trên Zalo tự hiện lựa chọn mới, không phải sửa code web.
2. **Bộ lập lịch** (`reminder-schedule.ts`)
   - Thêm nhánh `yearly` trong `nextOccurrence`: giữ ngày và tháng của anchor; 29/2 thì năm không nhuận nhắc 28/2.
   - Tách hàm `vnDayInMonth` dùng chung với `monthly`, hành vi của `monthly` giữ nguyên. Kế hoạch ghi là dùng chung cả vòng lặp; tôi chỉ dùng chung hàm tính ngày để không đổi hành vi `monthly` trong các trường hợp biên.
   - Thêm hàm `upcomingTime`: giờ lặp đã qua thì dời sang lần kế tiếp.
3. **Áp dụng dời giờ** ở 3 chỗ bot nhận giờ nhắc:
   - `requestedTimesFromArgs`: lúc đọc tham số LLM, nên thẻ xác nhận hiện đúng ngày.
   - `toValidRemindTimes`: lúc duyệt Việc, giờ lặp đã qua được dời thay vì bỏ.
   - `parseReminderPayload`: lúc duyệt Lời nhắc, giờ lặp đã qua được dời thay vì gửi ngay.
4. **Tool `ASK_CLARIFICATION`**
   - Thêm enum, định nghĩa tool, strategy, đăng ký vào factory và providers.
   - `TextInputService` chạy tool này sau cùng, nên câu hỏi nằm dưới các thẻ xác nhận; vẫn gửi khi `allowAiChat === false`.
5. **Prompt và mô tả tool**
   - Dịp hằng năm → `SET_REMINDER` với kiểu `yearly`, `at` là lần gần nhất trong tương lai, không dùng `monthly`.
   - Thêm quy tắc "THIẾU THÔNG TIN" để AI gọi `ASK_CLARIFICATION`; bot chỉ tính dương lịch.
6. **Comment entity**: không có migration.
7. **Tài liệu**: `CONTEXT.md`; knowledge (EN) và docs (VI) của reminders, tasks, zca, llm-providers, zalo-command-intake.

## Kiểm chứng đã chạy

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run test --workspace @zalobot/api`: 751/751 pass. Một test cũ dùng `'yearly'` làm ví dụ kiểu lặp không hợp lệ; tôi đổi ví dụ đó sang `'hourly'`.
- `npm run test --workspace @zalobot/web`: 141/141 pass.
- `node .claude/hooks/docs-drift-check.mjs` và `--all`: PASS.
- Prettier: các file code đều sạch. Một số file Markdown báo lệch định dạng, nhưng các file này đã lệch từ trước nên tôi không định dạng lại.

## Chưa kiểm chứng

- Cách LLM thật chọn tool (Gemini/OpenAI/Qwen). Sau khi deploy, cần gửi đúng câu trong log ngày 25/10 vào một nhóm test và kiểm tra:
  1. Thẻ xác nhận có ba giờ "(hàng năm)": 14/02/2027, 08/03/2027, 20/10/2027.
  2. Bot hỏi ngày sinh nhật.
  3. Không có "Hàng tháng".
- Việc 14/2 đang lặp hằng tháng trên prod: người dùng đổi tay sang "Hàng năm" trên dashboard.

## Còn để ngỏ (ngoài phạm vi)

- Âm lịch.
- Nhắc sinh nhật tự động từ trường `birthday` trong Hồ sơ.
- Nhãn `(Lặp: monthly)` thô trong danh sách lời nhắc nhanh.

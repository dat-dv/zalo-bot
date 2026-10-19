# Chẩn đoán: `dto.remindAt.toISOString is not a function`

## Hiện tượng
Duyệt thao tác chờ `SET_REMINDER` (yes <code> / ❤️) → thẻ chờ bị thu hồi, bot báo
`⚠️ Có lỗi xảy ra khi thực hiện thao tác: dto.remindAt.toISOString is not a function`.

## Nguyên nhân gốc (độ tin cậy: cao)
1. `set-reminder-tool.strategy.ts:35` tạo payload với `remindAt: Date`.
2. Pending action được lưu Redis bằng `JSON.stringify` → `Date` thành chuỗi ISO.
3. Khi duyệt, `getPendingByCode` (`transaction-confirmation.service.ts:157`) đọc lại bằng
   `JSON.parse(raw) as PendingAction` — không khôi phục kiểu `Date`.
4. `transaction-confirmation.service.ts:1253` ép `pending.payload as unknown as CreateReminderDto`
   (ép kiểu 2 tầng — vi phạm strict-types) nên TypeScript không bắt được.
5. `reminders.service.ts:46` gọi `dto.remindAt.toISOString()` trong log → crash.

## Hệ quả phụ quan trọng
`reminderRepo.save()` chạy **trước** dòng log → bản ghi nhắc nhở **đã được lưu vào DB**
dù người dùng nhận thông báo lỗi. Nếu người dùng thử lại sẽ sinh nhắc nhở trùng.

Các loại pending khác (`occurredAt`, `dueAt` của giao dịch/nợ) đã được xử lý bằng
`instanceof Date ? ... : String(...)` nên không bị; `CREATE_TASK.due` là string nên an toàn.

## Đề xuất khắc phục (tối thiểu)
- `RemindersService.createReminder`: chuẩn hoá `remindAt` đầu vào (`Date | string`) thành
  `Date` hợp lệ trước khi `create`, ném lỗi nếu không hợp lệ; log dùng `saved.remindAt`.
- `SET_REMINDER` trong `transaction-confirmation.service.ts`: thay ép kiểu 2 tầng bằng
  hàm parse payload (type guard) khôi phục `remindAt` thành `Date`.
- Test hồi quy: payload đi qua `JSON.parse(JSON.stringify(...))` rồi `createReminder`
  không crash và lưu đúng thời điểm.
- Dọn dữ liệu: kiểm tra các reminder có thể bị tạo trùng do người dùng thử lại.

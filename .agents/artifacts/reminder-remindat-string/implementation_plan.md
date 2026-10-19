# Implementation Plan: Sửa lỗi `remindAt` bị chuỗi hoá qua Redis

Rủi ro: **MEDIUM** (2 file nguồn + test, không đổi schema/API/hợp đồng công khai).
Báo cáo chẩn đoán: [investigation.md](investigation.md).

## Mục tiêu
Duyệt pending `SET_REMINDER` (kể cả khi payload đọc lại từ Redis) phải tạo nhắc nhở
thành công, không crash, và không còn trạng thái "đã lưu DB nhưng báo lỗi".

## Thay đổi

### 1. `apps/api/src/reminders/reminders.service.ts`
- Thêm hàm thuần (private hoặc export để test) `toValidDate(value: Date | string, field: string): Date`:
  - `Date` → giữ nguyên; `string` → `new Date(value)`.
  - Nếu `Number.isNaN(getTime())` → `throw new Error('remindAt không hợp lệ.')`.
- `createReminder`: chuẩn hoá `remindAt` **trước** `reminderRepo.create`; dòng log dùng
  `saved.remindAt.toISOString()` (giá trị đã chuẩn hoá) thay vì `dto.remindAt`.
- Không đổi kiểu công khai `CreateReminderDto.remindAt: Date` (controller và tool strategy
  vẫn truyền `Date`). Biên giới nhận dữ liệu chưa tin cậy nằm ở bước 2.

### 2. `apps/api/src/zca/confirmation/transaction-confirmation.service.ts` (case `SET_REMINDER`, ~dòng 1249)
- Bỏ ép kiểu 2 tầng `pending.payload as unknown as CreateReminderDto` (vi phạm strict-types).
- Thêm hàm parse `parseReminderPayload(payload: unknown): CreateReminderDto` (type guard thủ công,
  cùng file hoặc cạnh `dto-descriptor.util.ts`):
  - Kiểm tra `userId` (string|number), `title` (string không rỗng), `remindAt` (Date hoặc
    chuỗi ISO hợp lệ → `Date`), các trường tùy chọn `notifyType`/`repeatType`/`status`
    thuộc tập giá trị cho phép.
  - Payload sai → ném lỗi rõ ràng (luồng hiện tại đã bắt lỗi và báo `⚠️ Có lỗi xảy ra...`).
- Thẻ xác nhận dùng `reminder.remindAt` đã lưu (đã có sẵn).
- Lưu ý: file này đang có thay đổi chưa commit của nhánh hiện tại → chỉ chạm đúng block
  `SET_REMINDER`, giữ nguyên phần còn lại.

### 3. Test hồi quy — `transaction-confirmation.service.spec.ts`
- Thêm test: tạo pending reminder, rồi mô phỏng round-trip Redis
  (`JSON.parse(JSON.stringify(payload))`, `remindAt` thành chuỗi) → `yes <code>` →
  `createdReminders[0].remindAt instanceof Date` và đúng thời điểm, tin nhắn thành công.
  (Cách mô phỏng: dùng fake `redisService` trong `createTestContext` nếu có; nếu không,
  thay `payload` trong pendingMap bằng bản đã JSON round-trip.)
- Thêm test: `remindAt` là chuỗi không hợp lệ → không gọi `createReminder`, báo lỗi.
- Nếu fake `remindersService` trong test không gọi qua `toValidDate`, bổ sung một unit test
  nhỏ cho `toValidDate` (Date / chuỗi ISO / chuỗi rác).

## Ngoài phạm vi
- Không sửa các loại pending khác (giao dịch/nợ đã tự xử lý `instanceof Date`; task dùng string).
- Không tự động dọn reminder trùng trong DB — chỉ báo cáo; người dùng quyết định riêng.
- Không refactor tổng thể cơ chế (de)serialize pending action.

## Xác minh
- `npm run typecheck --workspace @zalobot/api`
- `npm run lint --workspace @zalobot/api`
- `npm run test --workspace @zalobot/api`
- `node .claude/hooks/docs-drift-check.mjs`

## Tài liệu
Đây là sửa lỗi triển khai; hành vi nghiệp vụ dự kiến không đổi → theo repository-changes.md
không cần sửa `.agents/knowledge`/`.agents/docs`. Nếu docs-drift-check yêu cầu do chạm module
`reminders`/`zca`, sẽ bổ sung một dòng invariant ngắn ("pending payload dates are revived from
ISO strings before execution") vào `modules/reminders/` (EN) và bản giải thích tương ứng (VI).

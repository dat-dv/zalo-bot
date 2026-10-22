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
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
---

# Module lời nhắc (Reminders)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/reminders/README.md).

## 1. Nghiệp vụ

Lời nhắc là một tin nhắn Zalo mà bot tự gửi cho người dùng khi tới giờ. Người dùng tạo lời nhắc bằng cách chat với bot (AI gọi tool `SET_REMINDER`, phải xác nhận như mọi thao tác chờ duyệt) hoặc ngay trên dashboard. Trên dashboard, người dùng thêm, xem, sửa, hoãn và xoá lời nhắc.

## 2. Ai sở hữu code nào

- `apps/web/src/modules/reminders` có thư mục `api/` và `model/`:
  - `reminders-api.ts`: `getReminders`, `createReminder`, `updateReminder`, `deleteReminder`, gọi `API_ROUTES.reminders` (`/api/reminders`).
  - `reminders-query.ts`: query key `['reminders']`, các hook `useRemindersQuery`, `useCreateReminderMutation`, `useUpdateReminderMutation`, `useDeleteReminderMutation`. Sau khi thêm/sửa/xoá thành công sẽ làm mới cache `reminders` và `dashboard`.
  - `model/reminder-create-form.ts`: hàm thuần (có unit test) đặt giá trị mặc định và kiểm tra form thêm lời nhắc.
- **Màn hình nằm ở module dashboard**: `RemindersScreen`, `RemindersTable` và `CreateReminderDialog` trong `apps/web/src/modules/dashboard/presentation/components/`. Trang `/reminders` (`apps/web/app/(private)/reminders/page.tsx`) import từ `@/modules/dashboard/view/reminders-screen`. Khi cần sửa giao diện, hãy mở thư mục dashboard, không phải thư mục reminders.
- Backend: `apps/api/src/reminders` gồm `RemindersController`, `RemindersService` và `ReminderSchedulerService`.

## 3. Màn hình Nhắc nhở

- Dữ liệu lấy từ `useRemindersQuery`. Nếu API trả danh sách rỗng, màn hình dùng tạm `reminders` trong dữ liệu dashboard.
- Bảng có ô tìm kiếm theo tiêu đề và các cột: tiêu đề, loại thông báo (`text` tin nhắn / `call` cuộc gọi), thời điểm nhắc, lặp lại (`none` / `daily` / `weekly`), thao tác.
- **Thêm lời nhắc**: nút `+ Thêm lời nhắc` trên toolbar (desktop) hoặc ở thanh hành động dưới cùng (điện thoại) mở hộp thoại gồm tiêu đề, thời điểm nhắc, loại thông báo, kiểu lặp.
  - Mặc định nhắc **sau 1 giờ**, bằng tin nhắn, không lặp, để người dùng chỉ cần gõ tiêu đề là lưu được.
  - Không cho chọn thời điểm đã qua: bộ hẹn giờ sẽ bắn ngay lời nhắc quá giờ ở lượt chạy kế tiếp, nên đó gần như luôn là chọn nhầm. Phút hiện tại vẫn được chấp nhận vì ô nhập chỉ chính xác tới phút. Form kiểm tra lại lúc bấm Lưu phòng khi form để mở lâu.
  - Giờ nhập theo múi giờ của trình duyệt rồi đổi sang ISO trước khi gửi.
- Sửa trực tiếp trên dòng (tiêu đề, thời điểm, loại thông báo, kiểu lặp) rồi bấm Lưu hoặc Huỷ.
- Nút **Nhắc lại** (snooze) chỉ dời `remindAt` thêm 15 phút bằng PATCH.
- Xoá có hộp thoại xác nhận của trình duyệt. Mỗi thao tác thành công hiện toast.
- Khi lỗi: hiện dải cảnh báo kèm nút Thử lại.

## 4. API backend

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/reminders` | Lời nhắc chưa kích hoạt (`isTriggered = false`) của người dùng, sắp theo giờ nhắc tăng dần |
| GET | `/api/reminders/:id` | Một lời nhắc, 404 nếu không thuộc người dùng |
| POST | `/api/reminders` | Bắt buộc `title`, `remindAt` hợp lệ; tuỳ chọn `notifyType`, `repeatType` |
| PATCH | `/api/reminders/:id` | Sửa tiêu đề, giờ nhắc, loại thông báo, kiểu lặp. Đổi giờ nhắc thì lời nhắc quay lại trạng thái chờ |
| DELETE | `/api/reminders/:id` | Xoá, trả `{ deleted: true }` |

Mọi endpoint đều lọc theo người dùng đang đăng nhập dashboard. Controller bỏ qua `status` gửi lên trong body.

## 5. Bộ hẹn giờ gửi nhắc (`ReminderSchedulerService`)

- Cron chạy **mỗi 30 giây**, lấy các lời nhắc đã tới giờ (`remindAt <= now`) và chưa kích hoạt.
- Với mỗi lời nhắc: định dạng giờ theo múi `Asia/Ho_Chi_Minh` và ngôn ngữ ưa thích của người dùng, gửi tin qua `ZaloService.sendMessage`, rồi đánh dấu đã kích hoạt.
- Lặp `daily` thì dời sang ngày hôm sau, `weekly` dời 7 ngày và vẫn ở trạng thái chờ. Không lặp thì chuyển sang `completed`.
- **Giới hạn đã biết**: chọn loại `call` chỉ được lưu và hiển thị; bộ hẹn giờ luôn gửi tin nhắn chữ, chưa có luồng gọi điện.

## 6. Tạo lời nhắc từ chat

- AI dùng tool `SET_REMINDER`. Trong nhóm Zalo, tin nhắn chỉ tới được AI khi người gửi @mention bot hoặc dùng tiền tố của nhóm (xem tài liệu module ZCA).
- Thao tác chờ duyệt được lưu trong Redis dưới dạng JSON, nên `remindAt` bị biến thành chuỗi. Khi người dùng xác nhận, `parseReminderPayload` (trong `transaction-confirmation.service.ts`) chuyển lại thành `Date` bằng `toValidReminderDate` trước khi tạo lời nhắc. Thiếu bước này thì việc tạo lời nhắc sẽ lỗi.
- Lệnh nhanh `/reminders` (hoặc `/reminder`) liệt kê các lời nhắc sắp tới ngay trong chat.

## 7. Kiểm thử

Chạy `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` và `npm run build` tại thư mục gốc. Thử tay: nhắn bot "nhắc tôi 5 phút nữa uống nước", xác nhận mã, chờ tối đa 30 giây sau giờ hẹn để nhận tin.

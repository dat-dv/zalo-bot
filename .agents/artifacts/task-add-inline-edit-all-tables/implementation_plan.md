# Kế hoạch triển khai: Thêm cột & Inline Edit cho tất cả các Table còn lại

Tài liệu này mô tả chi tiết phương án bổ sung đầy đủ các cột dữ liệu, hành động và tính năng **Inline Editing** chuẩn Enterprise UI cho 4 bảng còn lại trong hệ thống: **Chi tiêu (`/expenses`)**, **Vay & Cho vay (`/debts`)**, **Lịch sự kiện (`/calendar`)**, và **Lời nhắc (`/reminders`)**.

---

## 1. Mục tiêu & Phạm vi triển khai

Đồng bộ trải nghiệm người dùng (UX) trên toàn bộ Web Dashboard theo chuẩn chung đã áp dụng thành công cho `/contacts` và `/tasks`:

- **Chỉnh sửa trực tiếp (Inline Edit)**: Double-click vào dòng hoặc bấm nút Sửa để mở form inline.
- **Phím tắt tiện lợi**: `Enter` để lưu, `Escape` để hủy.
- **Thao tác nhanh trên dòng (Quick Actions)**: Nút Sửa, Xóa, Đổi trạng thái, Ghi nhận trả nợ, Hoãn nhắc nhở.
- **Phản hồi tức thì**: Toast notification thông báo thành công sau mỗi thao tác.
- **Zero-Any & 100% i18n**: Định nghĩa đầy đủ DTO contracts và translation keys song ngữ (`vi` & `en`).

---

## 2. Chi tiết kế hoạch cho từng Table

### 2.1. Bảng Chi tiêu (`/expenses`)

- **Các cột mới & Cải tiến**:
  - `category`: Text / Select inline edit danh mục chi tiêu.
  - `note`: Text inline edit ghi chú.
  - `amount`: Number inline edit số tiền chi tiêu (tự động cập nhật thanh mini bar chart).
  - `paymentMethod`: Select inline edit phương thức/nguồn tiền.
  - `occurredAt`: Datetime picker inline edit thời gian giao dịch.
  - `actions`: Cột Thao tác với nút Sửa (✎) và Xóa (🗑) ở chế độ xem; Nút Lưu (✓) và Hủy (✕) khi đang sửa.
- **API & Hooks**:
  - Bổ sung `updateExpense` và `deleteExpense` trong `apps/web/src/modules/expenses/api/`.

---

### 2.2. Bảng Vay & Cho vay (`/debts`)

- **Các cột mới & Cải tiến**:
  - `direction`: Badge đổi chiều Vay / Cho vay.
  - `counterparty`: Tên người nợ / chủ nợ.
  - `remainingAmount`: Số tiền còn lại.
  - `dueAt`: Date picker inline edit hạn chót thanh toán.
  - `note`: Text inline edit ghi chú khoản nợ.
  - `actions`: Nút Sửa (✎), Nút Trả nợ nhanh / Tất toán (+), Nút Lưu (✓)/Hủy (✕).
- **API & Hooks**:
  - Tích hợp `useUpdateDebtMutation` trong `apps/web/src/modules/debts/api/debts-query.ts`.

---

### 2.3. Bảng Lịch sự kiện (`/calendar`)

- **Các cột mới & Cải tiến**:
  - Bổ sung cột Mô tả (`description`), Địa điểm (`location`), Thời gian kết thúc (`endAt`), Thao tác (`actions`).
  - `title`: Inline edit tiêu đề sự kiện.
  - `startAt` & `endAt`: Datetime picker inline edit.
  - `actions`: Nút Sửa, Nút Xóa sự kiện Google Calendar.
- **API & Hooks**:
  - Tạo `calendar-api.ts` và `calendar-query.ts` (`useCalendarEventsQuery`, `useUpdateCalendarEventMutation`, `useDeleteCalendarEventMutation`).

---

### 2.4. Bảng Lời nhắc (`/reminders`)

- **Các cột mới & Cải tiến**:
  - Bổ sung cột Hình thức (`notifyType`: 📞 Gọi / 💬 Nhắn), Lặp lại (`repeatType`), Thao tác (`actions`).
  - `title`: Inline edit tiêu đề lời nhắc.
  - `remindAt`: Datetime picker inline edit thời gian hẹn nhắc.
  - `notifyType`: Dropdown chọn hình thức nhắc.
  - `actions`: Nút Sửa (✎), Nút Xóa (🗑), Nút Hoãn 15 phút (⏳).
- **API & Hooks**:
  - Tạo `reminders-api.ts` và `reminders-query.ts` (`useRemindersQuery`, `useUpdateReminderMutation`, `useDeleteReminderMutation`).

---

## 3. Danh sách các file thay đổi dự kiến

### Shared Packages & Backend

- **[MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**: Thêm DTOs (`IUpdateExpenseRequest`, `IUpdateCalendarEventRequest`, `IUpdateReminderRequest`) và translation keys cho cả 4 tables.
- **[MODIFY] [`apps/api/src/reports/reports.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)**: Cập nhật mapping `calendar` và `reminders` trả về đầy đủ các trường chi tiết.

### Web Frontend

- **[NEW] `apps/web/src/modules/calendar/api/calendar-api.ts` & `calendar-query.ts`**
- **[NEW] `apps/web/src/modules/reminders/api/reminders-api.ts` & `reminders-query.ts`**
- **[MODIFY] `apps/web/src/modules/expenses/api/expenses-api.ts` & `expenses-query.ts`**
- **[MODIFY] `apps/web/src/modules/debts/api/debts-api.ts` & `debts-query.ts`**
- **[MODIFY] `apps/web/src/modules/expenses/view/expenses-screen.tsx`**
- **[MODIFY] `apps/web/src/modules/debts/view/debts-screen.tsx`**
- **[MODIFY] `apps/web/src/modules/dashboard/view/calendar-screen.tsx`**
- **[MODIFY] `apps/web/src/modules/dashboard/view/reminders-screen.tsx`**

---

## 4. Kế hoạch kiểm thử & Đảm bảo chất lượng (Verification Plan)

### Automated Tests

1. `npm run typecheck` - Kiểm tra an toàn kiểu dữ liệu trên toàn bộ workspace.
2. `npm run lint` - Kiểm tra linter và chuẩn mã nguồn.
3. `npm run build` - Build ứng dụng web tĩnh và API server.
4. `npm run agent-system:validate` - Kiểm tra tính toàn vẹn của Agent System.

### Manual Tests

- Thử nghiệm thao tác inline edit (double-click, Enter, Escape, Save, Delete) trên từng màn hình:
  - Chi tiêu (`/expenses`)
  - Vay nợ (`/debts`)
  - Lịch (`/calendar`)
  - Lời nhắc (`/reminders`)
- Kiểm tra tính đồng bộ cache TanStack Query sau khi lưu hoặc xóa dữ liệu.

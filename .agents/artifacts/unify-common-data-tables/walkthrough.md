# Báo cáo: Thống nhất & Chuẩn hóa các Data Table Dùng Chung

## 1. Mục tiêu đã hoàn thành

Đã chuẩn hóa toàn bộ các bảng dữ liệu nghiệp vụ (`Transactions`, `Debts`, `Tasks`, `Reminders`, `Calendar`) về các **Common Table Components** duy nhất. Loại bỏ hoàn toàn sự phân mảnh định nghĩa cột, cắt xén dữ liệu hoặc thiếu tính năng giữa các trang khác nhau.

## 2. Danh mục Component & Màn hình đã cập nhật

### 2.1. Các Common Table Components mới được tạo

1. [`apps/web/src/modules/dashboard/view/transactions-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-table.tsx):
   - Cung cấp đầy đủ các cột: Loại (`type`), Danh mục (`category`), Ghi chú (`note`), Địa điểm (`placeName`), Số tiền (`amount` kèm thanh bar % max), Thời gian (`occurredAt`), Thao tác (`actions`).
   - Tích hợp Autocomplete danh mục và địa điểm khi sửa trực tiếp trên bảng.
2. [`apps/web/src/modules/debts/view/debts-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-table.tsx):
   - Cung cấp đầy đủ các cột: Trạng thái (`status`), Chiều (`direction`), Người liên quan (`counterparty`), Tiền gốc (`originalAmount`), Còn lại (`remainingAmount`), Tiền tệ (`currency`), Hạn trả (`dueAt`), Ngày tất toán (`settledAt`), Ghi chú (`note`), Thao tác (`actions` kèm nút Trả nợ nhanh).
3. [`apps/web/src/modules/dashboard/view/tasks-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-table.tsx):
   - Cung cấp đầy đủ các cột: Trạng thái checkbox (`status`), Tiêu đề (`title`), Ghi chú (`notes`), Hạn chót (`dueAt`), Cập nhật (`updatedAt`), Thao tác (`actions`).
4. [`apps/web/src/modules/dashboard/view/reminders-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-table.tsx):
   - Cung cấp đầy đủ các cột: Tiêu đề (`title`), Hình thức nhắc (`notifyType`), Lịch nhắc (`remindAt`), Lặp lại (`repeatType`), Thao tác (`actions` kèm nút Hoãn +15m).
5. [`apps/web/src/modules/dashboard/view/calendar-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-table.tsx):
   - Cung cấp đầy đủ các cột: Tiêu đề (`title`), Địa điểm (`location`), Mô tả (`description`), Bắt đầu (`startAt`), Kết thúc (`endAt`), Thao tác (`actions`).

### 2.2. Các màn hình đã tích hợp

1. [`apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx):
   - Sử dụng `TasksTable`, `RemindersTable`, `CalendarTable`, `TransactionsTable`, `DebtsTable`.
   - Hiển thị đầy đủ số hàng, số cột và có ô tìm kiếm nhanh trực tiếp trên thanh công cụ của từng DataPanel.
2. [`apps/web/src/modules/dashboard/view/transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx):
   - Tích hợp `TransactionsTable`.
3. [`apps/web/src/modules/debts/view/debts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx):
   - Tích hợp `DebtsTable`.
4. [`apps/web/src/modules/dashboard/view/tasks-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx):
   - Tích hợp `TasksTable`.
5. [`apps/web/src/modules/dashboard/view/reminders-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-screen.tsx):
   - Tích hợp `RemindersTable`.
6. [`apps/web/src/modules/dashboard/view/calendar-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx):
   - Tích hợp `CalendarTable`.
7. [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx):
   - Tích hợp `TransactionsTable` và `DebtsTable` vào Tab 4 (Sổ nợ) và Tab 5 (Dữ liệu chi tiết).

## 3. Kết quả Kiểm thử & Xác thực

- `npm run agent-system:validate`: ✅ Passed (88 artifacts, 152 dependencies).
- `npm run typecheck`: ✅ Passed (0 error).
- `npm run lint`: ✅ Passed (0 error, 0 warning).
- `npm run build`: ✅ Passed (Toàn bộ 19 routes tĩnh Next.js 16.3.2 build thành công).
- **Tài liệu & Knowledge**: Đã cập nhật `.agents/knowledge/global/web-ui-direction.md` và `.agents/docs/global/web-ui-direction.md`.

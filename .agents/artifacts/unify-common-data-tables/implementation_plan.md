# Kế hoạch Thống nhất & Chuẩn hóa Bảng Dữ liệu Dùng chung (Common Data Tables)

## Mục tiêu & Hiện trạng

Hiện tại trong ứng dụng web (`apps/web`), các bảng dữ liệu của cùng một thực thể (Giao dịch thu chi, Vay nợ, Việc cần làm, Nhắc nhở, Sự kiện lịch...) đang bị phân mảnh và định nghĩa lặp lại ở nhiều trang khác nhau:

1. **Trang Tổng quan (`DashboardHomeScreen`)**: Khai báo các cột rút gọn sơ sài (ví dụ: giao dịch chỉ có 3 cột, vay nợ chỉ có 3 cột, việc cần làm 2 cột, nhắc nhở 2 cột, lịch 2 cột), đồng thời cắt xén số hàng (`slice(0, 5)` hoặc lọc cứng trạng thái), khiến người dùng không xem được đầy đủ dữ liệu.
2. **Trang Phân tích (`AnalyticsScreen`)**: Tự định nghĩa lại bảng Transactions và Debts riêng biệt.
3. **Các trang chức năng chuyên biệt (`TransactionsScreen`, `DebtsScreen`, `TasksScreen`, `RemindersScreen`, `CalendarScreen`)**: Định nghĩa bảng với đầy đủ cột, tính năng inline edit, phân loại và thao tác.

Việc này dẫn đến sự thiếu đồng bộ: cùng một loại dữ liệu nhưng hiển thị khác nhau giữa các trang, thiếu cột, thiếu hàng và khó bảo trì.

Giải pháp: Xây dựng các **Common Table Components** chuẩn hóa cho từng domain, sử dụng nền tảng `DataTable` cốt lõi với đầy đủ hàng, cột, khả năng ẩn hiện cột, thay đổi độ rộng cột, format tiền tệ/thời gian và tái sử dụng nhất quán trên tất cả các trang.

---

## User Review Required

> [!IMPORTANT]
>
> - **Hiển thị đầy đủ số hàng và cột trên trang Dashboard**: Trang Tổng quan (`DashboardHomeScreen`) sẽ hiển thị bảng chuẩn với đầy đủ các cột (Loại/Chiều, Danh mục/Đối tác, Số tiền, Thời gian, Ghi chú, Trạng thái...) và hiển thị toàn bộ danh sách có thanh cuộn mượt mà (thay vì bị `slice(0, 5)` cắt ngắn như trước).
> - **Tùy chọn ẩn hiện & ghi nhớ cấu hình cột**: Người dùng có thể chủ động ẩn/hiện bớt các cột tùy ý thông qua nút cài đặt cột của `DataTable` (được lưu vào `localStorage`), đảm bảo vừa xem đủ chi tiết khi cần vừa linh hoạt thu gọn.

---

## Proposed Changes

### 1. Xây dựng các Common Table Components tái sử dụng

Tách và chuẩn hóa các bảng dữ liệu thành các component chuyên trách, hỗ trợ chế độ xem (view-only) lẫn chế độ tương tác/chỉnh sửa (editable):

#### [NEW] [`transactions-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-table.tsx)

- Đóng gói logic hiển thị bảng Giao dịch Thu - Chi (`TransactionsTable`).
- Đầy đủ các cột: Loại (`type`), Danh mục (`category`), Ghi chú (`note`), Địa điểm (`placeName`), Số tiền (`amount`), Thời gian (`occurredAt`), và Thao tác (`actions` - chỉnh sửa/xóa khi truyền handler).
- Tích hợp autocomplete, inline edit và format tiền tệ chuẩn.

#### [NEW] [`debts-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-table.tsx)

- Đóng gói logic hiển thị bảng Sổ Nợ / Cho Vay (`DebtsTable`).
- Đầy đủ các cột: Chiều (`direction`), Người liên quan (`counterparty`), Số tiền gốc (`originalAmount`), Còn lại (`remainingAmount`), Hạn trả (`dueAt`), Trạng thái (`status`), Ghi chú (`note`), và Thao tác (`actions` - trả nợ/sửa khi có handler).

#### [NEW] [`tasks-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-table.tsx)

- Đóng gói logic hiển thị bảng Việc cần làm (`TasksTable`).
- Đầy đủ các cột: Trạng thái checkbox (`status`), Tiêu đề (`title`), Ghi chú (`notes`), Hạn chót (`dueAt`), và Thao tác (`actions`).

#### [NEW] [`reminders-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-table.tsx)

- Đóng gói logic hiển thị bảng Lời nhắc (`RemindersTable`).
- Đầy đủ các cột: Tiêu đề (`title`), Thời gian nhắc (`remindAt`), Hình thức (`notifyType`), Lặp lại (`repeatType`), và Thao tác (`actions` - hoãn/sửa/xóa).

#### [NEW] [`calendar-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-table.tsx)

- Đóng gói logic hiển thị bảng Sự kiện Lịch (`CalendarTable`).
- Đầy đủ các cột: Tiêu đề (`title`), Bắt đầu (`startAt`), Kết thúc (`endAt`), Địa điểm (`location`), Mô tả (`description`), và Thao tác (`actions`).

---

### 2. Tích hợp và Đồng bộ trên toàn bộ các Pages

#### [MODIFY] [`dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Thay thế các bảng tự định nghĩa cũ bằng các component chung (`TasksTable`, `RemindersTable`, `CalendarTable`, `TransactionsTable`, `DebtsTable`).
- Hiển thị đầy đủ số hàng và cột, loại bỏ `slice(0, 5)` giới hạn cứng.

#### [MODIFY] [`transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Tái sử dụng `TransactionsTable` dùng chung.

#### [MODIFY] [`debts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)

- Tái sử dụng `DebtsTable` dùng chung.

#### [MODIFY] [`tasks-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx)

- Tái sử dụng `TasksTable` dùng chung.

#### [MODIFY] [`reminders-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-screen.tsx)

- Tái sử dụng `RemindersTable` dùng chung.

#### [MODIFY] [`calendar-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx)

- Tái sử dụng `CalendarTable` dùng chung trong chế độ hiển thị danh sách dạng bảng.

#### [MODIFY] [`analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Tái sử dụng `TransactionsTable` và `DebtsTable` dùng chung cho khu vực phân tích chi tiết.

---

### 3. Đồng bộ Tài liệu & Canonical Knowledge

#### [MODIFY] [`.agents/knowledge/modules/dashboard/dashboard-overview.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/dashboard-overview.md)

- Cập nhật kiến trúc bảng dữ liệu dùng chung (Common Data Tables Architecture) bằng tiếng Anh súc tích.

#### [MODIFY] [`.agents/docs/modules/dashboard/dashboard-overview.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/dashboard-overview.md)

- Cập nhật tài liệu kỹ thuật dành cho nhà phát triển bằng tiếng Việt.

---

## Verification Plan

### Automated Checks

- `npm run agent-system:validate`: Đảm bảo toàn vẹn cấu trúc và tài liệu hệ thống.
- `npm run lint`: Đảm bảo không có lỗi linter.
- `npm run typecheck`: Đảm bảo 100% Type-Safe và tuân thủ Zero-Any.
- `npm run build`: Kiểm tra biên dịch ứng dụng Next.js thành công.

### Manual Verification

- Kiểm tra trực quan trang Tổng quan (`/`), Phân tích (`/analytics`), Thu chi (`/transactions`), Sổ nợ (`/debts`), Việc cần làm (`/tasks`), Nhắc nhở (`/reminders`), Lịch (`/calendar`) để đảm bảo bảng hiển thị đầy đủ hàng cột, đồng nhất giao diện và hoạt động trơn tru.

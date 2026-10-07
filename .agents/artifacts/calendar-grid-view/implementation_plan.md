# Kế hoạch triển khai Giao diện Lịch Lưới Tháng (Calendar Grid View) & Chuẩn hóa API Google Calendar

Tài liệu này trình bày thiết kế kỹ thuật và kế hoạch triển khai nâng cấp trang Lịch (Calendar) từ dạng danh sách bảng đơn thuần thành giao diện **Lịch Lưới Tháng trực quan (Month Grid View)** kết hợp chế độ **Danh Sách (Table View)**, lấy dữ liệu trực tiếp từ **Google Calendar API** thông qua tài khoản Google đã liên kết.

---

## 1. Bối cảnh & Mục tiêu

- **Hiện trạng**:
  - Dữ liệu sự kiện lịch không lưu trong cơ sở dữ liệu nội bộ mà được gọi trực tiếp qua Google Calendar API.
  - Trang Calendar hiện tại chỉ có dạng bảng phẳng (Data Table) và endpoint `GET /calendar/events` ở backend chưa qua bộ chuyển đổi DTO chuẩn (`ICalendarEventItem`), dẫn tới nguy cơ lệch key (`summary` vs `title`, `start.dateTime` vs `startAt`).
- **Mục tiêu**:
  - Chuẩn hóa DTO Mapper tại backend cho endpoint `GET /calendar/events`.
  - Bổ sung chế độ xem **Lịch Lưới Tháng (Month Grid View)** với 7 cột ngày trong tuần (T2 - CN), hiển thị badge sự kiện theo từng ngày, đánh dấu ngày hôm nay, bộ điều hướng chuyển tháng (Tháng trước / Tháng sau / Hôm nay).
  - Cho phép người dùng chuyển đổi linh hoạt giữa **Chế độ Lưới (Grid)** và **Chế độ Bảng (Table)**.
  - Hỗ trợ click vào ngày/sự kiện để xem chi tiết, chỉnh sửa inline và xóa sự kiện.
  - Tuân thủ 100% quy tắc Zero Hardcoded User Text (i18n), Zero Any (Strict Types) và Design System chuẩn B2B SaaS (hỗ trợ Dark/Light mode, tối ưu Responsive mobile/desktop).

---

## 2. Đề xuất Thay đổi Kỹ thuật

### 2.1. Backend (`apps/api`)

- **[MODIFY]** [`apps/api/src/google/google-resources.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-resources.controller.ts)
  - Thêm phương thức private `mapEventToListItem(item: calendar_v3.Schema$Event): ICalendarEventItem`.
  - Cập nhật handler `listEvents` để map danh sách Google Event sang chuẩn `ICalendarEventItem[]` (`id`, `title`, `description`, `location`, `startAt`, `endAt`, `timeZone`).

### 2.2. Gói Hợp đồng Dữ liệu & Đa ngôn ngữ (`packages/contracts`)

- **[MODIFY]** [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)
  - Bổ sung translation keys cho cả `vi` và `en`:
    - `calendar.view.grid`: 'Lưới tháng' / 'Month Grid'
    - `calendar.view.table`: 'Danh sách' / 'List View'
    - `calendar.nav.today`: 'Hôm nay' / 'Today'
    - `calendar.nav.prev`: 'Tháng trước' / 'Previous Month'
    - `calendar.nav.next`: 'Tháng sau' / 'Next Month'
    - `calendar.day.mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`: Tên viết tắt các thứ trong tuần
    - `calendar.moreEvents`: '+{count} sự kiện' / '+{count} more'
    - `calendar.selectedDayEvents`: 'Sự kiện ngày {date}' / 'Events on {date}'
    - `calendar.noEventsOnDay`: 'Không có sự kiện nào trong ngày' / 'No events on this day'

### 2.3. Frontend Web (`apps/web`)

- **[NEW]** `apps/web/src/modules/calendar/view/calendar-grid.tsx`
  - Component hiển thị lưới tháng 7 cột (từ Thứ 2 đến Chủ Nhật).
  - Tự động tính toán các ngày trong tháng hiện tại + các ô đệm của tháng trước/sau.
  - Phân loại sự kiện theo ngày (`YYYY-MM-DD`).
  - Highlight ngày hôm nay và ngày được chọn.
  - Hiển thị các sự kiện dạng pill/chip với màu sắc nhận diện, giờ bắt đầu và tiêu đề.
  - Panel bên dưới hoặc popover hiển thị chi tiết các sự kiện của ngày được chọn kèm nút Sửa/Xóa.
- **[MODIFY]** [`apps/web/src/modules/dashboard/view/calendar-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx)
  - Thêm state `viewMode: 'grid' | 'table'` và `currentDate: Date`.
  - Tích hợp thanh toolbar điều hướng (Nút Tháng trước, Tháng sau, Hôm nay, Tiêu đề Tháng/Năm động theo ngôn ngữ đã chọn, Toggle View Mode).
  - Tích hợp `CalendarGrid` và `DataTable` chuyển đổi mượt mà.
- **[MODIFY]** [`apps/web/src/styles.css`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/styles.css)
  - Bổ sung CSS classes cho Calendar Grid (lưới 7 cột, ô ngày, badge sự kiện, highlight hôm nay, responsive mobile dạng compact).

---

## 3. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### Kiểm thử Tự động & Quality Gates

1. Chạy Typecheck toàn bộ Monorepo: `npm run typecheck`
2. Chạy Linter & Code style: `npm run lint`
3. Kiểm tra tính toàn vẹn hệ thống & i18n: `npm run agent-system:validate`
4. Build web & api: `npm run build`

### Kiểm thử Thủ công (Manual Flow)

1. Mở trang `/calendar` trên Dashboard.
2. Kiểm tra hiển thị mặc định dạng Lưới tháng (Grid View) với tiêu đề tháng hiện tại và các sự kiện được phân bổ đúng ngày.
3. Bấm chuyển tháng trước / tháng sau / nút "Hôm nay".
4. Bấm chuyển sang chế độ "Danh sách" (Table View) để kiểm tra tính năng bảng và tìm kiếm nhanh.
5. Kiểm tra sửa inline và xóa sự kiện trên cả 2 giao diện.
6. Kiểm tra giao diện trên mobile & chế độ Dark Mode.

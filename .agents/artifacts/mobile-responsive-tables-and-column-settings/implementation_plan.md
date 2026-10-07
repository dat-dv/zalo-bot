# Kế hoạch Triển khai: Tối ưu Bảng Dữ liệu Mobile & Cài đặt Ẩn/Hiện Cột (Column Settings)

## Tổng quan & Mục tiêu

Cải tiến toàn diện thành phần bảng dữ liệu (`DataTable` và `DataPanel`) trên toàn bộ ứng dụng web (@zalobot/web) nhằm:

1. **Tối ưu hiển thị trên di động (Mobile Responsive)**: Đảm bảo các cột quan trọng (như Số tiền, Danh mục/Tiêu đề, Trạng thái/Badge, Thời gian) luôn hiển thị đầy đủ và rõ ràng, không bị co ép chữ hay cắt cụt mất thông tin trên màn hình nhỏ.
2. **Hỗ trợ cuộn ngang mượt mà (Horizontal Scrolling)**: Cho phép bảng cuộn ngang tự nhiên với độ rộng tối thiểu hợp lý cho từng cột, kết hợp chỉ báo trực quan khi bảng có thể cuộn.
3. **Nút Cài đặt Ẩn/Hiện Cột (Column Visibility Settings)**: Tích hợp menu popover cài đặt cột ngay trên bảng/toolbar, cho phép người dùng tùy chọn bật/tắt từng cột, khôi phục mặc định và lưu tự động vào `localStorage`.

---

## User Review Required

> [!IMPORTANT]
>
> - **Cơ chế lưu trữ trạng thái cột**: Trạng thái ẩn/hiện cột của mỗi bảng sẽ được lưu trữ cục bộ trên trình duyệt qua `localStorage` (theo tiền tố `zalobot:table-columns:<table-id>`). Khi người dùng mở lại bảng trên cùng thiết bị, cấu hình cột đã chọn sẽ được giữ nguyên.
> - **Bảo vệ cột cốt lõi**: Các cột nhận diện chính (như Tên danh mục ở Thu chi, Tên người ở Vay nợ, Tiêu đề ở Công việc) được đánh dấu `hideable: false` để tránh trường hợp người dùng vô tình ẩn hết tất cả các cột nhận diện chính.

---

## Proposed Changes

Grouped by component layer:

### 1. Packages / Contracts (`packages/contracts`)

#### [MODIFY] `packages/contracts/src/index.ts`

- Bổ sung từ khóa dịch đa ngôn ngữ cho tính năng cài đặt cột và trợ năng bảng trong cả `messages.vi` và `messages.en`:
  - `table.columnSettings`: 'Cài đặt cột' / 'Column settings'
  - `table.columnVisibility`: 'Ẩn/hiện cột' / 'Toggle columns'
  - `table.showAllColumns`: 'Hiện tất cả' / 'Show all'
  - `table.resetColumns`: 'Đặt lại mặc định' / 'Reset to default'
  - `table.columnsCount`: '{visible}/{total} cột' / '{visible}/{total} columns'
  - `table.scrollHint`: 'Cuộn ngang để xem thêm' / 'Scroll horizontally to view more'
  - `table.columnRequired`: 'Bắt buộc' / 'Required'
  - `table.columnsHiddenCount`: 'Đang ẩn {count} cột' / '{count} hidden'

---

### 2. Web Shared UI & Styles (`apps/web`)

#### [MODIFY] `apps/web/src/shared/ui/data-table.tsx`

- Cập nhật interface `DataTableColumn<T>`:
  - Bổ sung các thuộc tính: `minWidth?: number | string`, `width?: number | string`, `hideable?: boolean` (mặc định `true`), `defaultHidden?: boolean` (mặc định `false`).
- Cập nhật interface `DataTableProps<T>`:
  - Bổ sung `id?: string` (khóa định danh bảng dùng cho `localStorage`), `allowColumnToggle?: boolean` (mặc định `true` khi có `id` hoặc khi tổng số cột > 2).
- Xây dựng component `TableColumnSettings`:
  - Nút bấm biểu tượng bánh răng cài đặt `⚙️` / Sliders icon tích hợp gọn gàng, hiển thị badge số lượng cột bị ẩn.
  - Menu popover thân thiện, có khả năng click-outside để đóng, hỗ trợ phím Esc và đầy đủ ARIA attributes.
  - Danh sách checkbox cho từng cột với trạng thái disable cho cột `hideable: false` hoặc khi chỉ còn 1 cột hiển thị.
  - Nút bấm nhanh "Đặt lại mặc định" và "Hiện tất cả".
- Nâng cấp `DataTable`:
  - Khởi tạo và đồng bộ state `visibleColumnIds: Set<string>` với `localStorage` qua custom hook hoặc effect an toàn (SSR-safe).
  - Lọc và render danh sách `visibleColumns`.
  - Thiết lập thuộc tính `minWidth` và `width` cho các phần tử `<th>`, `<td>` và `<col>` tương ứng.
  - Thêm wrapper hiển thị nút settings và chỉ báo cuộn ngang tinh tế trên mobile.

#### [MODIFY] `apps/web/src/styles.css`

- Nâng cấp CSS cho `.data-table__scroll`:
  - Hỗ trợ cuộn ngang linh hoạt (`overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; position: relative;`).
  - Tối ưu hóa giao diện thanh cuộn (scrollbar) mượt mà cho cả Light và Dark theme.
- Cập nhật `.data-table`:
  - Điều chỉnh `min-width: 100%` kết hợp với `min-width` từng cột và `white-space: nowrap` cho các ô số liệu/ngày giờ/badge, ngăn chặn triệt để tình trạng vỡ layout hoặc ép nghẹt nội dung trên mobile.
  - Cập nhật font, padding và text-truncation an toàn cho `cell-primary`, `cell-muted`, `amount-cell`.
- Bổ sung CSS cho component `TableColumnSettings`:
  - Popover dropdown container, header, danh sách checkbox item, footer actions.
  - Hỗ trợ đầy đủ High-Contrast Dark Mode (`html[data-theme='dark']`).

---

### 3. Web Feature Screens (`apps/web/src/modules/`)

Cập nhật các màn hình dữ liệu để truyền `id` và thiết lập `minWidth` / `hideable` phù hợp:

#### [MODIFY] `apps/web/src/modules/dashboard/view/transactions-screen.tsx`

- Đặt `id="transactions"`.
- Cấu hình min-widths cho các cột: Loại (`80px`), Danh mục (`150px`, `hideable: false`), Ghi chú (`160px`), Số tiền (`130px`, `hideable: false`), Thời gian (`130px`).

#### [MODIFY] `apps/web/src/modules/debts/view/debts-screen.tsx`

- Đặt `id="debts"`.
- Cấu hình min-widths: Hướng (`80px`), Người liên quan (`160px`, `hideable: false`), Ban đầu (`120px`), Còn lại (`130px`, `hideable: false`), Ngày hẹn (`110px`), Ghi chú (`150px`).

#### [MODIFY] `apps/web/src/modules/expenses/view/expenses-screen.tsx`

- Đặt `id="expenses"`.
- Cấu hình min-widths: Danh mục (`160px`, `hideable: false`), Ghi chú (`180px`), Số tiền (`130px`, `hideable: false`), Thời gian (`130px`).

#### [MODIFY] `apps/web/src/modules/contacts/view/contacts-screen.tsx`

- Đặt `id="contacts"`.
- Cấu hình min-widths: Tên (`160px`, `hideable: false`), Tên gọi (`130px`), Ghi chú (`160px`), Ngày tạo (`130px`).

#### [MODIFY] `apps/web/src/modules/dashboard/view/analytics-screen.tsx`

- Đặt `id="analytics-transactions"` và `id="analytics-debts"`.

#### [MODIFY] `apps/web/src/modules/dashboard/view/calendar-screen.tsx`, `reminders-screen.tsx`, `tasks-screen.tsx`, `dashboard-home-screen.tsx`

- Thiết lập `id` và tối ưu min-widths cho các bảng con trên Dashboard.

---

## Verification Plan

### Automated Checks

1. **Kiểm tra Type Safety**:
   ```bash
   npm run typecheck
   ```
1. **Kiểm tra Linter & Code Style**:
   ```bash
   npm run lint
   ```
1. **Kiểm tra Quy chuẩn Agent System & i18n**:
   ```bash
   npm run agent-system:validate
   ```
1. **Kiểm tra Build thành công**:
   ```bash
   npm run build:web
   ```

### Manual Verification

- Kiểm tra hiển thị responsive trên các kích thước màn hình: Mobile (375px, 414px), Tablet (768px), Desktop (1200px+).
- Kiểm tra tính năng cuộn ngang mượt mà trên mobile mà không làm vỡ các cột số liệu quan trọng.
- Thử nghiệm bật/tắt các cột trong menu Cài đặt cột và kiểm tra tính năng lưu trạng thái vào `localStorage` sau khi tải lại trang.
- Kiểm tra chuyển đổi giao diện Sáng / Tối (Light / Dark mode) và Song ngữ (Tiếng Việt / English).

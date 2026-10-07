# Kế Hoạch Triển Khai: Thêm Liên Kết (Link) Tại Tiêu Đề Các Bảng Trên Trang Chủ Đến Trang Riêng Tương Ứng

## 1. Mục tiêu & Bối cảnh

Trên trang chủ (`/` - `DashboardHomeScreen`), người dùng muốn tiêu đề của các bảng dữ liệu (DataPanel) như **"Việc cần làm"** (Tasks), **"Nhắc nhở"** (Reminders), **"Lịch sự kiện"** (Calendar), **"Giao dịch gần đây"** (Transactions), và **"Công nợ đang theo dõi"** (Debts) trở thành các liên kết có thể nhấp chuột vào (`Link`) để chuyển hướng nhanh đến trang quản lý chuyên biệt của từng phân hệ (`/tasks`, `/reminders`, `/calendar`, `/transactions`, `/debts`).

Đối với các bảng không có trang riêng (như "Nhật ký hoạt động" - Activity), tiêu đề sẽ vẫn giữ nguyên dạng văn bản thông thường.

---

## 2. Quy Chuẩn & Nguyên Tắc Tuân Thủ

1. **Strict Route Safety (`strict-routes-and-paths.md`)**:
   - Sử dụng các hằng số định tuyến từ `@zalobot/contracts` (`APP_ROUTES.tasks`, `APP_ROUTES.reminders`, `APP_ROUTES.calendar`, `APP_ROUTES.transactions`, `APP_ROUTES.debts`). Tuyệt đối không hardcode chuỗi đường dẫn.
2. **Zero Hardcoded Text (`i18n-no-hardcoded-user-text.md`)**:
   - Tiêu đề vẫn sử dụng translation key qua `t(...)`.
   - Ký hiệu mũi tên chỉ hướng (nếu có) được đánh dấu `aria-hidden="true"` để đảm bảo accessibility (a11y).
3. **Common Data Tables & Skeleton Fidelity (`common-data-tables.md`)**:
   - Giữ nguyên cấu trúc của `DataPanel` và `DataTable`.
   - Cập nhật cả `DashboardHomeContent` và `DashboardHomeSkeleton` để đảm bảo giao diện tải (Skeleton) khớp 1:1 với giao diện dữ liệu thật.
4. **Strict Type Safety (`strict-types.md`)**:
   - Mở rộng prop `titleHref?: string` trong `DataPanel` với type an toàn, không dùng `any`.

---

## 3. Chi Tiết Các File Thay Đổi (Proposed Changes)

### 3.1. Shared UI Component: `DataPanel`

#### [MODIFY] [`apps/web/src/shared/ui/data-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Import `Link` từ `next/link`.
- Bổ sung prop tùy chọn `titleHref?: string` vào `DataPanel`.
- Cập nhật phần render `<h2>`:
  - Nếu có `titleHref`: bọc tiêu đề trong `<Link href={titleHref} className="group inline-flex items-center gap-1.5 transition-colors hover:text-sky-600 dark:hover:text-sky-400"><span>{title}</span><span className="text-slate-400 text-[11px] transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400" aria-hidden="true">&rarr;</span></Link>`.
  - Nếu không có `titleHref`: render `{title}` thông thường.

### 3.2. Dashboard Module: `DashboardHomeScreen`

#### [MODIFY] [`apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Cập nhật component `DashboardHomeContent`:
  - `DataPanel` Việc cần làm (Tasks): truyền `titleHref={APP_ROUTES.tasks}`
  - `DataPanel` Nhắc nhở (Reminders): truyền `titleHref={APP_ROUTES.reminders}`
  - `DataPanel` Lịch sự kiện (Calendar): truyền `titleHref={APP_ROUTES.calendar}`
  - `DataPanel` Giao dịch (Transactions): truyền `titleHref={APP_ROUTES.transactions}`
  - `DataPanel` Công nợ (Debts): truyền `titleHref={APP_ROUTES.debts}`
  - `DataPanel` Nhật ký hoạt động (Activity): không truyền `titleHref` (giữ nguyên plain text)
- Cập nhật component `DashboardHomeSkeleton`:
  - Đồng bộ truyền `titleHref` tương tự cho các `DataPanel` trong skeleton loading để bảo đảm tính nhất quán 1:1.

### 3.3. Documentation & Canonical Knowledge (Phase 2)

#### [MODIFY] [`.agents/knowledge/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)

- Cập nhật mô tả `DataPanel` header link navigation trong module Dashboard.

#### [MODIFY] [`.agents/docs/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Cập nhật tài liệu hướng dẫn Dashboard tiếng Việt.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### Automated Verification

- Chạy `npm run typecheck` để đảm bảo an toàn kiểu dữ liệu trong toàn bộ monorepo.
- Chạy `npm run lint` để đảm bảo tuân thủ ESLint.
- Chạy `npm run agent-system:validate` để kiểm tra tính toàn vẹn hệ thống tài liệu và quy chuẩn.

### Manual Verification

- Kiểm tra hiển thị tiêu đề trên trang chủ:
  - Bảng "Việc cần làm": hiển thị liên kết trỏ tới `/tasks`, hover có hiệu ứng đổi màu và icon mũi tên.
  - Bảng "Nhắc nhở": hiển thị liên kết trỏ tới `/reminders`.
  - Bảng "Lịch sự kiện": hiển thị liên kết trỏ tới `/calendar`.
  - Bảng "Giao dịch gần đây": hiển thị liên kết trỏ tới `/transactions`.
  - Bảng "Công nợ đang theo dõi": hiển thị liên kết trỏ tới `/debts`.
  - Bảng "Nhật ký hoạt động": hiển thị tiêu đề thông thường (không click được do không có trang riêng).
- Kiểm tra Skeleton Loading của Dashboard để đảm bảo không bị giật layout.

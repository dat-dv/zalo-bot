# Kế hoạch Tái cấu trúc Route & Layout (Private Group) và Bỏ Prefix `/reports`

Tái cấu trúc toàn bộ hệ thống routing của Web Dashboard: loại bỏ prefix `/reports`, gom nhóm các trang private vào route group `app/(private)/` dùng chung layout Sidebar chuẩn Next.js App Router, cập nhật `APP_ROUTES` và xây dựng giao diện chuyên biệt cho từng tính năng theo phân nhóm nghiệp vụ.

---

## 1. Mục tiêu & Định hướng Kiến trúc

1. **Bỏ hoàn toàn prefix `/reports`**: Chuyển các đường dẫn sang định danh trực tiếp theo domain/feature (`/`, `/transactions`, `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`).
2. **Next.js Route Group `app/(private)/`**:
   - `app/(private)/layout.tsx`: Layout dùng chung chứa Sidebar Navigation phân nhóm, Header quản lý trạng thái (Làm mới, Đăng xuất, Theme toggle, Đổi ngôn ngữ), và Main Workspace Shell.
   - Nhờ Route Group, việc điều hướng giữa các trang diễn ra mượt mà, không render lại toàn bộ layout khung và tự động active menu dựa trên `usePathname()`.
3. **Cấu trúc Sidebar Navigation**:
   - **TỔNG QUAN**: Tổng quan (`/`)
   - **TÀI CHÍNH**: Thu chi (`/transactions`), Vay & cho vay (`/debts`), Phân tích (`/analytics`)
   - **KẾ HOẠCH**: Lịch (`/calendar`), Việc cần làm (`/tasks`), Nhắc nhở (`/reminders`)
   - **DỮ LIỆU**: Người liên quan (`/contacts`)
4. **Chuẩn hóa Hợp đồng & Đa ngôn ngữ (i18n)**:
   - Cập nhật `APP_ROUTES` và toàn bộ Translation Keys (tiếng Việt `vi` và tiếng Anh `en`) trong `packages/contracts/src/index.ts`.
   - Đảm bảo Zero Hardcoded Text và Zero Hardcoded Routes theo quy tắc hệ thống.

---

## 2. Chi tiết các thay đổi đề xuất

### 2.1. Hợp đồng dùng chung & Từ điển i18n (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Cập nhật `APP_ROUTES`:
  ```ts
  export const APP_ROUTES = {
    home: '/',

    transactions: '/transactions',
    expenses: '/expenses',
    income: '/income',

    debts: '/debts',

    analytics: '/analytics',
    analyticsSpending: '/analytics/spending',
    analyticsCashflow: '/analytics/cashflow',
    analyticsDebts: '/analytics/debts',

    calendar: '/calendar',
    tasks: '/tasks',
    reminders: '/reminders',

    contacts: '/contacts',
  } as const;
  ```
- Thêm translation keys song ngữ (`vi`, `en`) cho:
  - Các nhóm danh mục Sidebar: `nav.section.overview`, `nav.section.finance`, `nav.section.planning`, `nav.section.data`.
  - Các nhãn điều hướng: `nav.transactions`, `nav.analytics`, `nav.calendar`, `nav.tasks`, `nav.reminders`, `nav.debts`, `nav.contacts`.
  - Tiêu đề và mô tả trang: `transactions.title`, `transactions.subtitle`, `analytics.title`, `analytics.subtitle`, `calendar.title`, `calendar.subtitle`, `tasks.title`, `tasks.subtitle`, `reminders.title`, `reminders.subtitle`.

---

### 2.2. Tái cấu trúc App Router (`apps/web/app/`)

#### [DELETE] Thư mục cũ `apps/web/app/reports/`

- Xóa `apps/web/app/reports/page.tsx`
- Xóa `apps/web/app/reports/statistics/page.tsx`
- Xóa `apps/web/app/reports/contacts/page.tsx`
- Xóa `apps/web/app/reports/debts/page.tsx`
- Xóa `apps/web/app/reports/expenses/page.tsx`

#### [NEW] `apps/web/app/(private)/layout.tsx`

- Layout chung cho toàn bộ không gian cá nhân Dashboard.
- Nhúng `AppSidebarNavigation` và khung shell `app-shell`, tích hợp header toàn cục (hoặc sub-header theo trang), `usePathname()` để highlight active menu.

#### [NEW] `apps/web/app/(private)/page.tsx` (Route `/`)

- Màn hình **Tổng quan (Home)**:
  - Chỉ số nhanh: Thu tháng này, Chi tháng này, Thu - Chi (Số dư), Đang cho vay, Đang đi vay, Net debt.
  - Các widget tóm lược: Việc hôm nay, Lời nhắc sắp tới, Lịch 7 ngày tới, Khoản vay cần chú ý, Giao dịch gần đây, Hoạt động hệ thống.

#### [NEW] `apps/web/app/(private)/transactions/page.tsx` (Route `/transactions`)

- Màn hình **Thu chi**:
  - Bộ lọc linh hoạt: `[Tất cả] [Thu] [Chi]` (hỗ trợ query param `?type=income` hoặc `?type=expense`).
  - Tìm kiếm nhanh theo nội dung/danh mục.
  - Bảng giao dịch: Ngày | Nội dung / Ghi chú | Danh mục | Loại (Thu/Chi badge) | Số tiền.

#### [NEW] `apps/web/app/(private)/debts/page.tsx` (Route `/debts`)

- Màn hình **Vay & cho vay**:
  - Chỉ số: Tổng cho vay, Tổng đi vay, Công nợ ròng.
  - Bộ lọc: `[Tất cả] [Cần thu] [Cần trả]`.
  - Bảng danh sách: Đối tác | Số tiền ban đầu | Còn lại | Hạn thanh toán | Ghi chú.

#### [NEW] `apps/web/app/(private)/analytics/page.tsx` (Route `/analytics`)

- Màn hình **Phân tích**:
  - Tổng thu, Tổng chi, Số dư dòng tiền, Công nợ ròng.
  - Thống kê chi tiết giao dịch thu/chi theo danh mục, phân bổ cơ cấu dòng tiền.

#### [NEW] `apps/web/app/(private)/calendar/page.tsx` (Route `/calendar`)

- Màn hình **Lịch**:
  - Hiển thị danh sách sự kiện Google Calendar trong 7 ngày tới.
  - Cảnh báo kết nối tài khoản Google nếu chưa cấp quyền từ zalo.

#### [NEW] `apps/web/app/(private)/tasks/page.tsx` (Route `/tasks`)

- Màn hình **Việc cần làm**:
  - Danh sách Google Tasks với hạn hoàn thành và bộ lọc tìm kiếm.

#### [NEW] `apps/web/app/(private)/reminders/page.tsx` (Route `/reminders`)

- Màn hình **Nhắc nhở**:
  - Lời nhắc hẹn giờ (nhắc tin nhắn 💬 hoặc cuộc gọi tự động 📞).

#### [NEW] `apps/web/app/(private)/contacts/page.tsx` (Route `/contacts`)

- Màn hình **Người liên quan**:
  - Danh bạ đối tác / liên hệ công nợ (Tên, Biệt danh, Mô tả, Ngày tạo).

#### [MODIFY] [page.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/page.tsx)

- Đảm bảo root route `/` được render trực tiếp qua `(private)/page.tsx` (không cần redirect `/reports`).

---

### 2.3. Cập nhật Shared Navigation Component (`apps/web/src/shared/ui/`)

#### [MODIFY] [reports-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/reports-navigation.tsx) -> `app-navigation.tsx`

- Tái cấu trúc thành `AppNavigation` hỗ trợ 4 nhóm:
  - `nav.section.overview`: Trang chủ (`APP_ROUTES.home`)
  - `nav.section.finance`: Thu chi (`APP_ROUTES.transactions`), Vay & cho vay (`APP_ROUTES.debts`), Phân tích (`APP_ROUTES.analytics`)
  - `nav.section.planning`: Lịch (`APP_ROUTES.calendar`), Việc cần làm (`APP_ROUTES.tasks`), Nhắc nhở (`APP_ROUTES.reminders`)
  - `nav.section.data`: Người liên quan (`APP_ROUTES.contacts`)
- Tự động bắt active state theo `usePathname()` hoặc prop `active`.
- Tích hợp Theme toggle và chọn ngôn ngữ (vi/en).

---

### 2.4. Cập nhật Backend Xác thực & Redirect (`apps/api/`)

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Thay đổi redirect URL tại endpoint `GET /access` từ `${webOrigin}/reports#dashboard_token=...` thành `${webOrigin}/#dashboard_token=...`.

---

### 2.5. Cập nhật Tài liệu & Canonical Knowledge

#### [MODIFY] [route-constants.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/route-constants.md) & [route-constants.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/route-constants.md)

- Cập nhật định nghĩa `APP_ROUTES` mới và cấu trúc điều hướng.
- Cập nhật `dashboard-session.md` và `README.md` nếu có đề cập `/reports`.

---

## 3. Kế hoạch Kiểm thử & Xác minh

### Tự động hóa

1. `npm run typecheck`: Kiểm tra tính toàn vẹn type trên toàn bộ workspace (`@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`).
2. `npm run lint`: Chạy ESLint kiểm tra lỗi cú pháp và quy tắc mã nguồn.
3. `npm run build`: Build toàn bộ project để kiểm tra Next.js Static Export và NestJS compile.
4. `npm run agent-system:validate`: Kiểm tra tính toàn vẹn của artifacts và agent contracts.

### Xác minh Giao diện & Chức năng

1. Truy cập root `/`: Hiển thị Tổng quan với các khối chỉ số và widget tóm tắt.
2. Truy cập `/transactions`: Xem danh sách giao dịch, lọc Thu/Chi hoạt động mượt mà.
3. Truy cập `/debts`: Xem danh sách công nợ với filter Cần thu/Cần trả.
4. Truy cập `/analytics`: Xem phân tích tổng hợp tài chính.
5. Truy cập `/calendar`, `/tasks`, `/reminders`, `/contacts`: Hiển thị đúng dữ liệu tương ứng.
6. Kiểm tra chuyển đổi ngôn ngữ (Tiếng Việt <-> English) và giao diện Sáng / Tối hoạt động ổn định trên toàn bộ các route.

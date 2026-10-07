# Báo cáo Hoàn thành: Tái cấu trúc Route & Layout (Private Group)

Đã hoàn thành tái cấu trúc toàn bộ hệ thống điều hướng và layout của Web Dashboard: loại bỏ prefix `/reports`, đưa các trang vào route group `app/(private)/` dùng chung layout Sidebar chuẩn Next.js App Router, cập nhật `APP_ROUTES` và xây dựng giao diện chuyên biệt cho từng tính năng.

---

## 1. Các thay đổi chính đã thực hiện

### 1.1. Cập nhật `packages/contracts`

- Định nghĩa `APP_ROUTES` mới:
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
- Bổ sung translation keys song ngữ (`vi` và `en`) cho 4 phân nhóm navigation (`nav.section.*`), các nhãn menu (`nav.*`) và tiêu đề/mô tả của từng trang tính năng.

---

### 1.2. App Router & Layout dùng chung (`app/(private)/`)

- **Xóa bỏ hoàn toàn** thư mục cũ `app/reports/` và file redirect `app/page.tsx`.
- **Tạo layout dùng chung** [`app/(private)/layout.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/layout.tsx>) nhúng `AppNavigation` và khung `app-shell`.
- **Tạo Sidebar Navigation 4 phân nhóm** [`apps/web/src/shared/ui/app-navigation.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx):
  ```text
  TỔNG QUAN
    Tổng quan (/)

  TÀI CHÍNH
    Thu chi (/transactions)
    Vay & cho vay (/debts)
    Phân tích (/analytics)

  KẾ HOẠCH
    Lịch (/calendar)
    Việc cần làm (/tasks)
    Nhắc nhở (/reminders)

  DỮ LIỆU
    Người liên quan (/contacts)
  ```
- **Tạo component tiêu đề chung** [`WorkspaceHeader`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx) phục vụ thao tác Làm mới (query cache invalidation) và Đăng xuất (xóa token và chuyển hướng về `APP_ROUTES.home`).

---

### 1.3. Các trang tính năng độc lập

- **`/` (Tổng quan)**: [`app/(private)/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/page.tsx>) hiển thị các chỉ số tài chính tháng này, các việc cần chú ý, lối tắt nhanh và 6 widget tóm lược (Tasks, Reminders, Calendar, Giao dịch gần đây, Vay nợ đang mở, Hoạt động gần đây).
- **`/transactions` (Thu chi)**: [`app/(private)/transactions/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/transactions/page.tsx>) với bộ lọc `[Tất cả] [Thu] [Chi]`, đồng bộ query params `?type=income`/`?type=expense`, tìm kiếm và bảng lịch sử giao dịch.
- **`/debts` (Vay & cho vay)**: [`app/(private)/debts/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/debts/page.tsx>) với các chỉ số Cần thu, Cần trả, Công nợ ròng và bảng quản lý khoản nợ.
- **`/analytics` (Phân tích)**: [`app/(private)/analytics/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/analytics/page.tsx>) tổng hợp phân tích dòng tiền và cơ cấu chi tiêu.
- **`/calendar` (Lịch)**: [`app/(private)/calendar/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/calendar/page.tsx>) hiển thị sự kiện Google Calendar 7 ngày tới.
- **`/tasks` (Việc cần làm)**: [`app/(private)/tasks/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/tasks/page.tsx>) hiển thị danh sách nhiệm vụ Google Tasks.
- **`/reminders` (Nhắc nhở)**: [`app/(private)/reminders/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/reminders/page.tsx>) hiển thị danh sách lời nhắc hẹn giờ (tin nhắn / cuộc gọi).
- **`/contacts` (Người liên quan)**: [`app/(private)/contacts/page.tsx`](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/contacts/page.tsx>) hiển thị danh bạ công nợ.
- **`/expenses` & `/income`**: Tự động chuyển hướng sang `/transactions?type=expense` và `/transactions?type=income`.

---

### 1.4. Backend API & Tài liệu

- **`ReportsController` (`apps/api/src/reports/reports.controller.ts`)**: Cập nhật endpoint `GET /access` chuyển hướng sau xác thực tới `${webOrigin}/#dashboard_token=...` thay vì `/reports`.
- **Tài liệu & Knowledge**: Đồng bộ các file tài liệu canonical (`.agents/knowledge/`) và tài liệu phát triển (`.agents/docs/`).

---

## 2. Kết quả Kiểm thử & Xác minh

```text
✓ Typecheck: Passed (0 errors across @zalobot/contracts, @zalobot/api, @zalobot/web)
✓ Lint: Passed (0 errors)
✓ Build: Passed (Tạo thành công static bundle cho tất cả 10 routes)
✓ Agent System Validate: Passed (81 artifacts, 144 dependencies, 54 pairs, 0 cyclic groups)
```

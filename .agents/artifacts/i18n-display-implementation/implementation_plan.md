# Kế Hoạch Triển Khai Hiển Thị Đa Ngôn Ngữ (i18n)

Triển khai hiển thị đa ngôn ngữ (i18n) toàn bộ giao diện Web Dashboard và zalo bot theo chuẩn của dự án (`@zalobot/contracts`), chuyển đổi động giữa Tiếng Việt (`vi`) và Tiếng Anh (`en`), bao gồm cả định dạng tiền tệ (VND/USD hoặc vi-VN/en-US) và thời gian.

## User Review Required

> [!IMPORTANT]
>
> - Các chuỗi hiển thị trên Dashboard (`DashboardScreen`, `HomeView`, `StatisticsView`, `DataPanel`, `DataTable`, `ErrorState`) sẽ được refactor 100% sang `t('key')` thông qua `useLocale()`.
> - Định dạng tiền tệ và ngày tháng sẽ dùng `Intl.NumberFormat` / `Intl.DateTimeFormat` theo `localeTag(locale)` (`vi-VN` / `en-US`).
> - Sửa lỗi frontmatter tài liệu agent system tại `.agents/knowledge/global/i18n.md` & `.agents/docs/global/i18n.md` và dọn dẹp nội dung rác ngẫu nhiên trong `.gitignore` để vượt qua `npm run agent-system:validate`.

## Open Questions

Không có. Yêu cầu đã rõ ràng theo chuẩn hệ thống i18n hiện có.

## Proposed Changes

### Shared Contracts Package (`packages/contracts`)

#### [MODIFY] index.ts

- Bổ sung toàn bộ translation keys cho giao diện Dashboard trong đối tượng `messages`:
  - `dashboard.welcome`: Chào bạn / Welcome
  - `dashboard.statisticsTitle`: Thống kê thu–chi / Income & Expense Statistics
  - `dashboard.homeSubtitle`: Tổng quan cá nhân, mở từ zalo / Personal overview, opened from zalo
  - `dashboard.statisticsSubtitle`: Dữ liệu tháng hiện tại / Current month data
  - `dashboard.metric.monthlyBalance`: Số dư tháng này / Balance this month
  - `dashboard.metric.receivable`: Cần thu / Receivable
  - `dashboard.metric.payable`: Cần trả / Payable
  - `dashboard.metric.attentionItems`: Việc cần chú ý / Items needing attention
  - `dashboard.metric.totalIncome`: Tổng thu / Total income
  - `dashboard.metric.totalExpense`: Total expense / Total expense
  - `dashboard.metric.balance`: Số dư / Balance
  - `dashboard.metric.netDebt`: Công nợ ròng / Net debt
  - `dashboard.quickAction.statistics`: Xem thống kê thu–chi / View statistics
  - `dashboard.quickAction.contacts`: Mở danh bạ liên lạc / Open contacts
  - `dashboard.quickAction.debts`: Xem công nợ / View debts
  - `dashboard.quickAction.expenses`: Xem khoản chi / View expenses
  - Các nhãn bảng, trạng thái rỗng (empty messages), lỗi phiên làm việc (ErrorState), và định dạng tiêu đề panel.

---

### Web Application (`apps/web`)

#### [MODIFY] dashboard-screen.tsx

- Import `useLocale` từ `@/shared/providers/locale-provider`.
- Cập nhật hàm `money(value, locale)` và `date(value, locale)` sử dụng `localeTag(locale)` động thay vì hardcode `'vi-VN'`.
- Chuyển đổi các định nghĩa cột (`transactionColumns`, `debtColumns`, `calendarColumns`, `taskColumns`, `reminderColumns`, `activityColumns`) thành hàm hoặc hook nhận `t` và `locale` để render header và cell linh hoạt theo i18n.
- Thay thế 100% chuỗi tiếng Việt hardcode bằng `t(...)`.

---

### Workspace Governance & Documentation (`.agents`, `.gitignore`)

#### [MODIFY] .gitignore

- Xóa các dòng code dán nhầm ở cuối file (dòng 53-73) để `ripgrep` và linter không báo lỗi parse syntax.

#### [MODIFY] i18n.md

- Bổ sung YAML frontmatter `agent-artifact` và liên kết tới `.agents/docs/global/i18n.md`.

#### [MODIFY] i18n.md

- Bổ sung YAML frontmatter `agent-artifact` và liên kết tới `.agents/knowledge/global/i18n.md`.

---

## Verification Plan

### Automated Tests

- Running system validation:
  ```bash
  npm run agent-system:validate
  ```
- Running workspace typecheck:
  ```bash
  npm run typecheck
  ```

### Manual Verification

- Đổi ngôn ngữ trên thanh điều hướng Dashboard (chọn Tiếng Việt / English) và xác nhận:
  1. Tất cả nhãn, tiêu đề, nút bấm, bảng dữ liệu đều đổi sang ngôn ngữ đã chọn.
  2. Giá trị tiền tệ và ngày tháng định dạng đúng theo locale (`vi-VN` / `en-US`).
  3. Giá trị cookie `zalobot-locale` và thuộc tính `lang` của thẻ `<html>` được cập nhật tương ứng.

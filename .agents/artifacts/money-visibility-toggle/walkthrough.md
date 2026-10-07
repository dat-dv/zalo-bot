# Kết quả triển khai: Ẩn/hiện số tiền nhạy cảm trong phiên làm việc (Money Visibility Toggle)

Đã hoàn thành triển khai tính năng ẩn/hiện số tiền nhạy cảm trong phiên làm việc (`in-memory session state`) trên toàn bộ ứng dụng web zalobot.

---

## Các thay đổi đã thực hiện

### 1. Hợp đồng & Đa ngôn ngữ (`@zalobot/contracts`)

- **[packages/contracts/src/index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Bổ sung translation keys song ngữ (`vi` và `en`): `common.hideMoney`, `common.showMoney`, `common.toggleMoneyVisibility`, `common.maskedAmount`.
  - Rebuilt `@zalobot/contracts` để export type definition mới nhất.

### 2. Provider quản lý trạng thái phiên (`apps/web/src/shared/providers`)

- **[apps/web/src/shared/providers/money-visibility-provider.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/providers/money-visibility-provider.tsx)**:
  - Tạo `MoneyVisibilityProvider`, `useMoneyVisibility`, và `useMoneyFormatter`.
  - `isMoneyVisible: boolean` lưu trong bộ nhớ React (`useState`), mặc định `true`, không lưu vào `localStorage`/cookie.
  - Khi ẩn (`isMoneyVisible: false`), hàm định dạng `money(val)` trả về chuỗi mặt nạ `'••••••'`.
- **[apps/web/src/shared/providers/app-providers.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/providers/app-providers.tsx)**:
  - Bọc `MoneyVisibilityProvider` vào cây Provider chung của toàn bộ ứng dụng.

### 3. Tiêu đề không gian làm việc (`apps/web/src/shared/ui`)

- **[apps/web/src/shared/ui/workspace-header.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx)**:
  - Tích hợp nút `Ẩn số tiền` / `Hiện số tiền` (`👁️` / `🔒`) vào cụm điều khiển tiêu đề, có đầy đủ `aria-label`, `aria-pressed`, `title` và keyboard accessibility.
- **[apps/web/src/shared/ui/trend-summary-strip.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/trend-summary-strip.tsx)**:
  - Tích hợp `useMoneyFormatter()` cho các thẻ KPI Tổng thu, Tổng chi, Thu − Chi.
- **[apps/web/src/shared/ui/micro-bar-chart.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/micro-bar-chart.tsx)**:
  - Tích hợp `useMoneyFormatter()` cho tooltip hover của biểu đồ cột micro.

### 4. Giao diện các Module (`apps/web/src/modules`)

- **[apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)**:
  - Sử dụng `useMoneyFormatter()` cho dải thẻ tài chính và bảng tóm tắt giao dịch / công nợ.
- **[apps/web/src/modules/dashboard/view/transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)**:
  - Sử dụng `useMoneyFormatter()` cho cột số tiền thu chi. Ô input khi inline-edit vẫn giữ số thực để nhập/sửa bình thường.
- **[apps/web/src/modules/dashboard/view/analytics-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)**:
  - Sử dụng `useMoneyFormatter()` cho các bảng thống kê và tổng hợp nợ ròng.
- **[apps/web/src/modules/debts/view/debts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)**:
  - Sử dụng `useMoneyFormatter()` cho cột Số tiền ban đầu, Số tiền còn lại và footer tổng kết.
- **[apps/web/src/modules/expenses/view/expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)**:
  - Sử dụng `useMoneyFormatter()` cho cột số tiền chi tiêu.

### 5. Đồng bộ tài liệu hệ thống (`.agents/knowledge` & `.agents/docs`)

- Cập nhật Canonical Knowledge và Developer Guides ghi nhận cơ chế In-Memory Session Money Visibility Toggle:
  - [dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)
  - [global/web-ui-direction.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/web-ui-direction.md)
  - [docs/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)
  - [docs/global/web-ui-direction.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/web-ui-direction.md)

---

## Kết quả kiểm thử & Quality Gates

| Kiểm tra                | Lệnh thực hiện                  | Kết quả                                            |
| :---------------------- | :------------------------------ | :------------------------------------------------- |
| **System Validation**   | `npm run agent-system:validate` | ✅ Pass (88 artifacts, 152 dependencies, 0 errors) |
| **Type Check**          | `npm run typecheck`             | ✅ Pass (100% clean typecheck across monorepo)     |
| **Linter & i18n Rules** | `npm run lint`                  | ✅ Pass (0 errors, 0 warnings)                     |
| **Production Build**    | `npm run build`                 | ✅ Pass (Tất cả 18 static routes build thành công) |

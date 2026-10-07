# Walkthrough: Nâng cấp Biểu đồ Xu hướng dòng tiền thành Đường Biến động số dư ví tích lũy

Em đã hoàn thành việc nâng cấp đường biểu diễn trên biểu đồ "Xu hướng dòng tiền" (`CashflowTrendChart`) và bảng số liệu phân rã chi tiết để phản ánh chính xác **Biến động số dư ví tích lũy (Cumulative Wallet Balance)** theo thời gian.

---

## 1. Các thay đổi chính đã triển khai

### Backend & Shared Contracts

- **Shared Contract (`packages/contracts`)**:
  - Bổ sung trường `netCashflow: number` vào `IAnalyticsTrendBucket` (để lưu song song Dòng tiền thuần của kỳ và Số dư tích lũy `balance`).
  - Bổ sung các translation key song ngữ (`vi` & `en`): `analytics.chart.walletBalance`, `analytics.chart.netCashflow`, `analytics.cashflow.column.netCashflow`, `analytics.cashflow.column.balance`.
- **Backend Service (`apps/api/src/finance/finance.service.ts`)**:
  - Truy vấn `openingBalance` (tổng thu trừ tổng chi của mọi giao dịch xảy ra trước mốc thời gian bắt đầu của kỳ lọc `startAt`).
  - Tính toán lũy kế `runningBalance`: với mỗi mốc thời gian con, tính $\text{netCashflow} = \text{income} - \text{expense}$ và cộng dồn $\text{balance} = \text{runningBalance} + \text{netCashflow}$.

### Frontend Web UI & Charts

- **Biểu đồ `CashflowTrendChart` (`apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx`)**:
  - **Legend Header**: Chuyển nhãn thành **"Biến động số dư ví"** (`t('analytics.chart.walletBalance')`).
  - **CustomTooltip**: Hiển thị chi tiết 4 thông số:
    - 🔵 Thu vào (`+ X đ`)
    - 🟠 Chi ra (`- Y đ`)
    - ⚪ Dòng tiền kỳ (`+/- Z đ`)
    - 🟣 Biến động số dư ví tại mốc (`W đ`)
- **Trang Phân tích Báo cáo (`apps/web/src/modules/dashboard/view/analytics-screen.tsx`)**:
  - Cập nhật `fallbackTrendBuckets` tính toán lũy kế `runningBalance` bắt đầu từ `openingBalance`.
  - Chuẩn hóa bảng dữ liệu phân rã (`cashflowColumns`): bổ sung cột **Dòng tiền thuần** bên cạnh cột **Số dư tích lũy**.

---

## 2. Kết quả kiểm thử & Xác thực

- **Unit Tests**: Chạy 63/63 unit tests trong `@zalobot/api` (bao gồm test mới cho `getAnalyticsReport` với `openingBalance` và `cumulative balance`) $\rightarrow$ **PASS**.
- **Typecheck**: `npm run typecheck` $\rightarrow$ **PASS** across `@zalobot/contracts`, `@zalobot/api`, và `@zalobot/web`.
- **Linter**: `npm run lint` $\rightarrow$ **PASS** 0 errors, 0 warnings.
- **Production Web Build**: `next build` $\rightarrow$ **Compiled successfully** (19/19 static routes).
- **Agent System Validation**: `npm run agent-system:validate` $\rightarrow$ **PASS** 90 artifacts.

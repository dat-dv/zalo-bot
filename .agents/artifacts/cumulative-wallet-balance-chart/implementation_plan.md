# Kế hoạch nâng cấp Biểu đồ Xu hướng dòng tiền: Đường Biến động số dư ví tích lũy

Hiện tại, đường biểu diễn trong biểu đồ "Xu hướng dòng tiền" (`CashflowTrendChart`) đang thể hiện Dòng tiền thuần của từng kỳ con (\(\text{Thu} - \text{Chi}\) độc lập), khiến người dùng không theo dõi được xu hướng tăng/giảm thực tế của số tiền hiện có trong ví. Kế hoạch này sẽ nâng cấp đường biểu diễn thành **Số dư ví tích lũy (Cumulative Running Balance)** theo dòng thời gian, đồng thời giữ đầy đủ thông tin Dòng tiền thuần của từng kỳ.

---

## 1. Mục tiêu và Thay đổi Nghiệp vụ

1. **Đường biểu diễn (Line Chart)**:
   - Tính toán lũy kế số dư ví:
     $$\text{Số dư mốc } i = \text{Số dư đầu kỳ} + \sum_{k=1}^{i} (\text{Thu}_k - \text{Chi}_k)$$
   - Thể hiện chính xác số tiền thực tế trong ví đang tăng lên hay giảm xuống qua từng mốc thời gian.
2. **Hợp nhất Dữ liệu Dòng tiền**:
   - Mở rộng `IAnalyticsTrendBucket` với trường `netCashflow` (\(\text{Thu} - \text{Chi}\) trong kỳ) bên cạnh `balance` (Số dư tích lũy).
3. **Cải tiến Giao diện (UX & Tooltip)**:
   - **Legend**: Đổi tên nhãn từ "Số dư ròng" sang "Biến động số dư ví".
   - **Tooltip khi hover**: Hiển thị rõ ràng cả 4 thông số:
     - 🔵 Thu vào: `+ X đ`
     - 🟠 Chi ra: `- Y đ`
     - 🟣 Dòng tiền kỳ: `+/- Z đ`
     - 🟢 Số dư ví tại mốc: `W đ`
   - **Bảng chi tiết (Breakdown Table)**: Bổ sung/chuẩn hóa cột Dòng tiền thuần và Số dư tích lũy.

---

## 2. User Review Required

> [!NOTE]
> **Số dư đầu kỳ (Opening Balance)**:
> Khi xem theo kỳ (ví dụ: "Tháng này" hoặc "Quý này"), số dư ví tại mốc đầu tiên sẽ xuất phát từ tổng số dư thực tế trước thời điểm bắt đầu kỳ đó, giúp đường biến động phản ánh chính xác số tiền thực tế trong tài khoản.

---

## 3. Proposed Changes

### Shared Contracts & i18n

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung trường `netCashflow: number` vào interface `IAnalyticsTrendBucket`.
- Bổ sung translation keys cho `vi` và `en`:
  - `analytics.chart.walletBalance`: "Biến động số dư ví" / "Wallet Balance Trend"
  - `analytics.chart.netCashflow`: "Dòng tiền kỳ" / "Period Cash Flow"
  - `analytics.cashflow.column.netCashflow`: "Dòng tiền thuần" / "Net Cash Flow"
  - `analytics.cashflow.column.balance`: "Số dư tích lũy" / "Cumulative Balance"

---

### Backend API (`apps/api`)

#### [MODIFY] [`apps/api/src/finance/finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Trong `getAnalyticsReport`:
  - Tính `openingBalance` (tổng thu trừ tổng chi của tất cả giao dịch trước `startAt`).
  - Truyền `openingBalance` vào `generateTrendBuckets`.
- Trong `generateTrendBuckets`:
  - Tính toán `netCashflow = income - expense` cho từng bucket.
  - Lũy kế `runningBalance = runningBalance + netCashflow`.
  - Gán `bucket.netCashflow = netCashflow` và `bucket.balance = runningBalance`.

#### [MODIFY] [`apps/api/src/finance/finance.service.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.spec.ts)

- Cập nhật unit test kiểm thử tính toán `openingBalance` và `cumulative balance` của trend buckets.

---

### Frontend Web (`apps/web`)

#### [MODIFY] [`apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx)

- Cập nhật Legend header: Sử dụng `analytics.chart.walletBalance`.
- Cập nhật `CustomTooltip`: Hiển thị chi tiết cả Thu, Chi, Dòng tiền kỳ và Số dư ví tại mốc.
- Cập nhật đường `Line`: stroke màu tím violet, hiển thị giá trị `balance` (số dư tích lũy).

#### [MODIFY] [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Cập nhật `fallbackTrendBuckets` hỗ trợ tính toán lũy kế `runningBalance`.
- Cập nhật cột bảng `cashflowColumns`: Hiển thị cả Dòng tiền thuần của kỳ và Số dư tích lũy.

---

## 4. Verification Plan

### Automated Tests

- Chạy unit test backend:
  ```bash
  npm run test
  ```
- Kiểm tra Type Safety và Lint toàn hệ thống:
  ```bash
  npm run typecheck
  npm run lint
  npm run agent-system:validate
  ```

### Manual Verification

1. Truy cập trang Phân tích báo cáo (`/dashboard/analytics` hoặc `/analytics`).
2. Chọn các kỳ lọc khác nhau (Tuần này, Tháng này, Quý này, Năm nay).
3. Kiểm tra đường biểu diễn màu tím trên biểu đồ:
   - Khi có thu > chi: đường đi lên.
   - Khi có chi > thu: đường đi xuống.
   - Giá trị tại mỗi điểm phản ánh đúng số dư ví tích lũy dồn qua các mốc.
4. Kiểm tra tooltip hover và chế độ xem bảng chi tiết số liệu.

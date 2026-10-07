# Kế hoạch Triển khai: Trang Báo Cáo & Phân Tích Tổng Quan Trực Quan Hóa (Visual Analytics Dashboard)

Tài liệu này mô tả chi tiết phương án kỹ thuật nâng cấp trang Phân tích tài chính (`/analytics`) thành một Visual Analytics Dashboard hoàn chỉnh với bộ lọc thời gian đa tầng (Ngày, Tuần, Tháng, Quý, Năm, Tất cả), hệ thống biểu đồ trực quan chuyên sâu (Native SVG Enterprise-grade), API Backend tổng hợp thống kê theo khoảng thời gian thực tế, và đồng bộ toàn bộ tài liệu dự án liên quan.

---

## 1. Mục tiêu & Phạm vi

- **Mục tiêu**: Cung cấp giao diện báo cáo tổng quan trực quan hóa toàn bộ dòng tiền, cơ cấu chi tiêu, số dư tiết kiệm ròng và tình hình công nợ theo bất kỳ khoảng thời gian nào được chọn.
- **Phạm vi thay đổi**:
  - `packages/contracts`: Định nghĩa Shared DTOs (`IFinanceAnalyticsResponse`, `IAnalyticsTrendBucket`, `IAnalyticsCategoryBreakdown`), API route constants và từ điển i18n song ngữ (`vi` & `en`).
  - `apps/api`: Xây dựng endpoint `GET /api/finance/analytics` trong `FinanceController` & `FinanceService` để tổng hợp số liệu trực tiếp từ cơ sở dữ liệu theo `startAt`, `endAt`, `grain`.
  - `apps/web`:
    - Thêm API client & TanStack Query hook `useAnalyticsReportQuery`.
    - Xây dựng bộ UI Chart Components Native SVG (Cashflow Trend Bar/Line, Category Donut/Bar Distribution, Debt Structure Breakdown).
    - Tái cấu trúc `AnalyticsScreen` kết nối `PeriodFilterToolbar`, hiển thị KPI Cards, trực quan hóa biểu đồ và bảng drill-down dữ liệu.
  - **Tài liệu**: Đồng bộ Canonical Knowledge (`.agents/knowledge/`) và Developer Docs (`.agents/docs/` & `docs/`).

---

## 2. User Review Required

> [!IMPORTANT]
>
> - **Công nghệ biểu đồ (Chart Stack)**: Sử dụng giải pháp **Native SVG / Tailwind CSS** thay vì cài đặt thư viện bên ngoài (như Recharts). Giải pháp này giúp giữ nguyên 0KB overhead bundle, tương thích 100% chế độ Sáng / Tối (Dark/Light mode) và phong cách thiết kế Data-Dense / Enterprise của zalobot.
> - **Bảo toàn tính năng hiện có**: Toàn bộ tính năng inline-editing giao dịch, quản lý công nợ và trả nợ nhanh trên trang `/analytics` vẫn được giữ nguyên vẹn trong phần bảng chi tiết (Data drill-down).

---

## 3. Chi tiết Thay đổi Kỹ thuật

### A. Shared Contracts (`packages/contracts`)

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung route: `API_ROUTES.financeAnalytics = '/api/finance/analytics'`.
- Bổ sung các DTO Interfaces:
  ```typescript
  export type AnalyticsGrain = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

  export interface IFinanceAnalyticsSummary {
    income: number;
    expense: number;
    balance: number;
    netSavingsRate: number; // percentage (0 - 100)
    receivableTotal: number;
    payableTotal: number;
  }

  export interface IAnalyticsTrendBucket {
    key: string;
    label: string;
    income: number;
    expense: number;
    balance: number;
    startAt: string;
    endAt: string;
  }

  export interface IAnalyticsCategoryBreakdown {
    category: string;
    type: 'expense' | 'income';
    amount: number;
    count: number;
    percentage: number;
    color?: string;
  }

  export interface IAnalyticsDebtBreakdown {
    receivable: number;
    payable: number;
    netDebt: number;
    topReceivables: Array<{ contactId?: string; counterparty: string; amount: number }>;
    topPayables: Array<{ contactId?: string; counterparty: string; amount: number }>;
  }

  export interface IFinanceAnalyticsResponse {
    summary: IFinanceAnalyticsSummary;
    trend: IAnalyticsTrendBucket[];
    categories: IAnalyticsCategoryBreakdown[];
    debts: IAnalyticsDebtBreakdown;
  }
  ```
- Bổ sung translation keys cho `vi` và `en`:
  - `analytics.kpi.netSavings`, `analytics.kpi.savingsRate`, `analytics.chart.cashflowTrend`, `analytics.chart.spendingDistribution`, `analytics.chart.debtBreakdown`, `analytics.emptyChartData`, `analytics.topCategories`, `analytics.drilldownTitle`.

---

### B. Backend (`apps/api`)

#### [MODIFY] [`apps/api/src/finance/finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Thêm method `getAnalyticsReport(userId: number, startAt?: string, endAt?: string, grain: AnalyticsGrain = 'month')`:
  - Truy vấn toàn bộ giao dịch (`FinanceTransactionEntity`) trong khoảng `[startAt, endAt]`.
  - Phân chia bucket theo `grain` (`day`, `week`, `month`, `year`) để tạo chuỗi `trend`.
  - Gom nhóm danh mục chi tiêu/thu nhập để tính `categories` breakdown và tỷ lệ `%`.
  - Truy vấn công nợ (`DebtEntity`) để tính tổng nợ và top đối tác vay/cho vay trong kỳ.
  - Tính toán các chỉ số tài chính: `netSavingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0`.

#### [MODIFY] [`apps/api/src/finance/finance.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)

- Thêm endpoint:
  ```typescript
  @Get('finance/analytics')
  @ApiOperation({ summary: 'Lấy dữ liệu phân tích báo cáo tài chính trực quan' })
  async getAnalytics(
    @Req() req: Request,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('grain') grain?: AnalyticsGrain,
  ) {
    const data = await this.finance.getAnalyticsReport(this.userId(req), startAt, endAt, grain);
    return { data };
  }
  ```

---

### C. Frontend (`apps/web`)

#### [NEW] [`apps/web/src/modules/dashboard/api/analytics-api.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/api/analytics-api.ts) & [`analytics-query.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/api/analytics-query.ts)

- Định nghĩa API fetcher `getFinanceAnalytics({ startAt, endAt, grain, signal })`.
- TanStack Query hook `useFinanceAnalyticsQuery({ startAt, endAt, grain })` với Query Key Factory `analyticsQueryKeys.report(params)`.

#### [NEW] [`apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx)

- Biểu đồ Native SVG hiển thị cột kép Thu/Chi kết hợp đường biểu diễn Số dư ròng (Net Balance Line).
- Hỗ trợ tooltip chi tiết khi hover, vạch lưới tối ưu hiển thị, tự động co giãn theo chiều rộng.

#### [NEW] [`apps/web/src/shared/ui/charts/category-donut-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/charts/category-donut-chart.tsx)

- Biểu đồ Donut SVG trực quan hóa tỷ trọng chi tiêu từng danh mục.
- Danh sách Legend Top 5 danh mục có thanh tiến độ (progress bar) và tỷ lệ phần trăm (%).

#### [NEW] [`apps/web/src/shared/ui/charts/debt-structure-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/charts/debt-structure-chart.tsx)

- Biểu đồ cột ngang (Horizontal Bar Chart) so sánh phân bổ Cho vay vs Đi vay theo Top đối tác.

#### [MODIFY] [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Tích hợp `usePeriodFilter` kết hợp với `useFinanceAnalyticsQuery`.
- Hiển thị hệ thống thẻ KPI Tài chính (Tổng Thu, Tổng Chi, Tiết Kiệm Ròng, Tỷ Lệ Tiết Kiệm, Nợ Ròng).
- Layout 2 cột trực quan:
  - Cột 1 (2/3 width): Biểu đồ Xu hướng dòng tiền (`CashflowTrendChart`).
  - Cột 2 (1/3 width): Biểu đồ Phân bổ chi tiêu (`CategoryDonutChart`) & Cơ cấu công nợ (`DebtStructureChart`).
- Bảng Drill-down chi tiết (Bảng giao dịch & Bảng công nợ với đầy đủ khả năng Inline Edit & Search).

---

### D. Documentation & Knowledge Base Sync

#### [MODIFY] [`.agents/knowledge/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md) & [`.agents/knowledge/modules/finance/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)

- Cập nhật tài liệu Canonical Knowledge (tiếng Anh) bổ sung kiến trúc Analytics Reporting API, Data Contracts, và các thành phần biểu đồ Native SVG.

#### [MODIFY] [`.agents/docs/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md) & [`docs/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/docs/modules/dashboard/README.md)

- Cập nhật hướng dẫn phát triển và vận hành (tiếng Việt) chi tiết về trang Báo cáo / Phân tích, các bộ lọc thời gian, logic tính toán KPI và biểu đồ.

#### [MODIFY] [`.agents/docs/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/README.md)

- Cập nhật mục lục tài liệu hệ thống.

---

## 4. Kế hoạch Kiểm thử & Xác thực (Verification Plan)

### Automated Tests & Quality Gates

- Chạy kiểm tra định dạng và linter: `npm run lint`
- Chạy kiểm tra kiểu tĩnh toàn bộ monorepo (Zero-Any & Strict Types): `npm run typecheck`
- Kiểm tra tính toàn vẹn hệ thống Agent System: `npm run agent-system:validate`
- Kiểm tra build tĩnh Next.js & NestJS: `npm run build`

### Manual Verification

1. Truy cập trang `/analytics`, thay đổi các hạt thời gian: Ngày, Tuần, Tháng, Quý, Năm, Tất cả.
2. Kiểm tra biểu đồ Cashflow Trend và Category Donut hiển thị dữ liệu chính xác tương ứng với từng kỳ lọc.
3. Kiểm tra tính năng ẩn/hiện số tiền (`MoneyVisibilityProvider`) che mờ cả số liệu trên thẻ KPI và tooltip biểu đồ.
4. Kiểm tra giao diện đáp ứng (Responsive) trên màn hình di động (<= 768px) và chế độ Dark/Light mode.

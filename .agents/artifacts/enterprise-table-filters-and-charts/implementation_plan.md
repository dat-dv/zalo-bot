# Kế hoạch Triển Khai: Bộ Lọc Thời Gian Đa Cấp (Tuần/Tháng/Quý/Năm) & Biểu Đồ Data-Dense Chuẩn B2B SaaS

Tài liệu này chi tiết hóa phương án kiến trúc và các bước triển khai tính năng bộ lọc thời gian (Tuần / Tháng / Quý / Năm), kết hợp biểu đồ phân tích xu hướng trực quan (Trend Micro-Chart) và bảng dữ liệu (DataTable) theo đúng quy chuẩn **Data-Dense B2B SaaS / Flat Enterprise** (tiết kiệm diện tích, hiển thị nội dung tối đa, hỗ trợ dark/light theme, không hardcode text).

---

## 1. User Review Required (Hạng mục cần xác nhận)

> [!IMPORTANT]
>
> - **Lựa chọn Thư viện Biểu đồ**: Đề xuất xây dựng **Pure SVG Micro-Chart Component** nội bộ (nhẹ, zero bundle overhead, tương thích 100% React 19, điều khiển màu sắc qua CSS variables `--color-positive`, `--color-warning`) hoặc cài đặt `recharts`. Khuyên dùng Pure SVG/Canvas nội bộ để đạt độ dense tối đa và tốc độ render tức thì.
> - **URL Query Param Strategy**: Bộ lọc thời gian sẽ đồng bộ trực tiếp lên URL (`?period=week|month|quarter|year&ref=YYYY-MM-DD`) để người dùng có thể chia sẻ liên kết hoặc reload mà không mất trạng thái.
> - **Collapsible Micro-Chart**: Biểu đồ có nút bật/tắt (ẩn/hiện) với chiều cao mặc định gọn gàng (~90px - 110px) tích hợp cùng dải KPI metric.

---

## 2. Kiến Trúc & Thiết Kế Giao Diện (Design Architecture)

### 2.1. Bố Cục Giao Diện Toolbar & Split View (Enterprise Layout)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE HEADER: Thu chi & Giao dịch                                                   [ Làm mới ⟳ ]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR (Cao 32px):                                                                                      │
│ [ Tìm kiếm...           ] │ [Tuần | Tháng* | Quý | Năm] │ [<] Tháng 08/2026 [>] │ [📈 Thu gọn biểu đồ ▾]│
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ TREND & KPI STRIP (Collapsible, Cao ~100px) ────────────────────────────────────────────────────────┐ │
│ │  TỔNG THU            TỔNG CHI             SỐ DƯ DÒNG TIỀN       XU HƯỚNG THEO KỲ                     │ │
│ │  250.000.000 ₫       180.000.000 ₫        +70.000.000 ₫         █ ▄ ▆ █ ▇ █ (Thu vs Chi)             │ │
│ │  ↑ 12% so kỳ trước   ↓ 4% so kỳ trước     ● Dòng tiền dương     [ Micro Bar / Sparkline ]            │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ DATA TABLE (Tự co giãn điền đầy Viewport) ──────────────────────────────────────────────────────────┐ │
│ │ PHÂN LOẠI │ DANH MỤC       │ GHI CHÚ                       │       SỐ TIỀN (kèm % bar) │ THỜI GIAN  │ │
│ │ Thu nhập  │ Lương          │ Lương tháng 8                 │ 50.000.000 ₫ ▇▇▇▇        │ 24/08/2026 │ │
│ │ Chi tiêu  │ Thuê nhà       │ Tiền phòng T8                 │ 12.000.000 ₫ ▇           │ 20/08/2026 │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Các Thành Phần Kỹ Thuật Đề Xuất (Proposed Changes)

### Component 1: Shared Contracts & i18n (`packages/contracts`)

Bổ sung các translation key phục vụ bộ lọc thời gian và biểu đồ cho cả 2 ngôn ngữ `vi` và `en`:

- `period.week`, `period.month`, `period.quarter`, `period.year`
- `period.previous`, `period.next`, `period.custom`
- `chart.toggleShow`, `chart.toggleHide`, `chart.incomeVsExpense`, `chart.cashflowTrend`

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

---

### Component 2: Reusable Period Filter Controller & Hook (`apps/web/src/shared/`)

- `usePeriodFilter`: Custom hook tính toán ngày bắt đầu/kết thúc (`startDate`, `endDate`), bước nhảy kỳ trước/sau (`handlePrev`, `handleNext`), và sync với `useSearchParams` / `useRouter`.
- `PeriodFilterToolbar`: UI Component chuẩn Enterprise (cao 30px-32px), gồm Segmented Control `[Tuần | Tháng | Quý | Năm]` + Step Navigator `< [T8/2026] >`.

#### [NEW] [`apps/web/src/shared/hooks/use-period-filter.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/hooks/use-period-filter.ts)

#### [NEW] [`apps/web/src/shared/ui/period-filter-toolbar.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/period-filter-toolbar.tsx)

---

### Component 3: Enterprise Micro-Chart Components (`apps/web/src/shared/ui/`)

- `MicroBarChart`: Component SVG mini hiển thị cột so sánh Thu vs Chi theo từng mốc thời gian trong kỳ (7 ngày đối với Tuần, 30 ngày đối với Tháng, 3 tháng đối với Quý, 12 tháng đối với Năm).
- `TrendSummaryStrip`: Dải tổng kết tích hợp Metric KPI + Mini Chart + Collapsible Toggle.
- `AmountCellWithBar`: Tùy chọn hiển thị micro relative bar dưới số tiền trong `DataTable`.

#### [NEW] [`apps/web/src/shared/ui/micro-bar-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/micro-bar-chart.tsx)

#### [NEW] [`apps/web/src/shared/ui/trend-summary-strip.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/trend-summary-strip.tsx)

---

### Component 4: Tích Hợp Vào Các Màn Hình Dữ Liệu (`apps/web/src/modules/`)

Tích hợp bộ lọc thời gian và Trend Summary Strip vào các màn hình:

1. **Transactions Screen** (`transactions-screen.tsx`): Lọc danh sách thu chi theo kỳ, hiển thị biểu đồ xu hướng dòng tiền.
2. **Analytics Screen** (`analytics-screen.tsx`): Phân tích chi tiết thu-chi và công nợ theo kỳ chọn.
3. **Expenses Screen** (`expenses-screen.tsx`): Lọc chi tiêu theo kỳ và danh mục.

#### [MODIFY] [`apps/web/src/modules/dashboard/view/transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

#### [MODIFY] [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

#### [MODIFY] [`apps/web/src/modules/expenses/view/expenses-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

---

### Component 5: CSS & Styling Enterprise Data-Dense (`apps/web/src/styles.css`)

Bổ sung các rule CSS cho:

- `.period-filter`: Segmented control liền mạch, nút active đậm nét, hover nhẹ.
- `.trend-strip`: Container metric + chart cao ~90px, border-b 1px, hỗ trợ thu gọn mượt mà.
- `.micro-chart`: Căn chỉnh SVG viewbox, bar fill, tooltip hover tối giản.

#### [MODIFY] [`apps/web/src/styles.css`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/styles.css)

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

### Automated Tests & Quality Gates

- Chạy kiểm tra chất lượng mã nguồn:
  ```bash
  npm run typecheck
  npm run lint
  npm run build
  ```
- Kiểm tra i18n & Zero Hardcoded Strings:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Kiểm tra chuyển đổi linh hoạt giữa các mốc: **Tuần ➔ Tháng ➔ Quý ➔ Năm**.
- Bấm `<` và `>` để điều hướng qua lại giữa các kỳ (ví dụ: Tháng 8 ➔ Tháng 7 ➔ Tháng 6) và xác nhận dữ liệu bảng + biểu đồ cập nhật chính xác.
- Bật/tắt nút `[Ẩn/Hiện biểu đồ]` và kiểm tra bảng dữ liệu co giãn mượt mà, không bị vỡ layout.
- Kiểm tra hiển thị tốt trên cả giao diện sáng (Light mode) và giao diện tối (Dark mode), cũng như responsive trên màn hình nhỏ.

---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch: Ẩn/hiện số tiền nhạy cảm trong phiên làm việc (Money Visibility Toggle)

Thêm nút chuyển đổi dùng chung trên `WorkspaceHeader` để ẩn hoặc hiện các giá trị tiền tệ nhạy cảm trên toàn bộ giao diện Web App. Trạng thái chỉ duy trì trong bộ nhớ React của phiên hiện tại (`useState` thuần, không lưu `localStorage`/cookie/API) và mặc định hiển thị khi mở hoặc tải lại trang.

## User Review Required

> [!IMPORTANT]
>
> - **Phạm vi bảo vệ**: Tính năng ẩn số tiền (`mask: '••••••'`) nhằm ngăn chặn việc nhìn lướt qua màn hình (over-the-shoulder privacy) tại nơi công cộng hoặc khi chia sẻ màn hình. Dữ liệu gốc vẫn nằm trong state bộ nhớ React để phục vụ tính toán.
> - **Ngoại lệ ô nhập liệu**: Khi người dùng đang thực hiện chỉnh sửa trực tiếp trên dòng (`inline row editing`) hoặc nhập biểu mẫu mới, ô input số tiền vẫn hiển thị giá trị số thật để đảm bảo thao tác nhập/sửa diễn ra bình thường, không bị gián đoạn.
> - **Tính tạm thời (In-Memory Session Only)**: Trạng thái ẩn/hiện hoàn toàn là in-memory. Khi người dùng tải lại trang (`F5`), mở tab mới hoặc đăng nhập lại, hệ thống sẽ luôn trở về trạng thái mặc định là **Hiện số tiền**.

## Proposed Changes

---

### 1. Package Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys song ngữ cho từ điển `vi` và `en`:
  - `common.hideMoney`: `'Ẩn số tiền'` / `'Hide amounts'`
  - `common.showMoney`: `'Hiện số tiền'` / `'Show amounts'`
  - `common.toggleMoneyVisibility`: `'Ẩn/hiện số tiền'` / `'Toggle amount visibility'`

---

### 2. Web Core & Shared Providers (`apps/web/src/shared/providers`)

#### [NEW] [money-visibility-provider.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/providers/money-visibility-provider.tsx)

- Định nghĩa `MoneyVisibilityContext`, `MoneyVisibilityProvider`, và hook `useMoneyVisibility()` / `useMoneyFormatter()`:
  - State: `isMoneyVisible: boolean` (mặc định `true`).
  - Hàm `toggleMoneyVisibility: () => void`.
  - Hàm tiện ích `money(value: number): string` chuẩn hóa:
    - Nếu `isMoneyVisible === true`: Format tiền tệ chuẩn `Intl.NumberFormat(localeTag(locale), { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)`.
    - Nếu `isMoneyVisible === false`: Trả về chuỗi che dạng `'••••••'`.

#### [MODIFY] [app-providers.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/providers/app-providers.tsx)

- Bọc `MoneyVisibilityProvider` bên trong cây component `AppProviders` (ngang hàng `LocaleProvider` và `ThemeProvider`).

---

### 3. Shared UI Components (`apps/web/src/shared/ui`)

#### [MODIFY] [workspace-header.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx)

- Tích hợp nút `Ẩn số tiền` / `Hiện số tiền` (kèm icon biểu tượng mắt 👁️ / 👁️‍🗨️ hoặc nhãn văn bản i18n) vào cụm nút thao tác của `WorkspaceHeader`.
- Đảm bảo đầy đủ thuộc tính trợ năng (`aria-label`, `aria-pressed`, keyboard navigation).

#### [MODIFY] [trend-summary-strip.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/trend-summary-strip.tsx)

- Sử dụng hàm định dạng `money` từ `useMoneyFormatter()` thay cho hàm `Intl.NumberFormat` cục bộ, giúp các thẻ Tổng thu, Tổng chi, Thu − Chi tự động che/hiện theo trạng thái phiên.

#### [MODIFY] [micro-bar-chart.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/micro-bar-chart.tsx)

- Sử dụng hàm định dạng `money` từ `useMoneyFormatter()` trong tooltip hiển thị khi hover qua các cột biểu đồ.

---

### 4. Web Modules UI (`apps/web/src/modules`)

#### [MODIFY] [dashboard-home-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Thay hàm `money` cục bộ bằng hook `useMoneyFormatter()`. Che/hiện đồng bộ cho:
  - Các ô tóm tắt tài chính (Tổng thu, Tổng chi, Chênh lệch, Người khác nợ bạn, Bạn đang nợ).
  - Cột số tiền trong bảng Giao dịch gần đây và bảng Công nợ đang mở.

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Sử dụng `useMoneyFormatter()`.
- Hiển thị che số tiền ở cột Số tiền và thanh tiến độ khi `isMoneyVisible` tắt; khi người dùng nhấp đúp / sửa dòng (inline edit), ô input vẫn giữ số tiền thực tế để sửa.

#### [MODIFY] [analytics-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Sử dụng `useMoneyFormatter()` cho cả bảng phân tích thu chi, bảng phân tích công nợ và dải tổng kết chênh lệch nợ ròng.

#### [MODIFY] [debts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)

- Sử dụng `useMoneyFormatter()` cho cột Số tiền ban đầu, Số tiền còn lại và dải tổng kết công nợ dưới chân bảng. Khi inline edit, input số tiền hiển thị số thực.

#### [MODIFY] [expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

- Sử dụng `useMoneyFormatter()` cho cột Số tiền chi tiêu. Khi inline edit, input số tiền hiển thị số thực.

---

### 5. Documentation & Canonical Knowledge Sync

#### [MODIFY] [.agents/knowledge/modules/dashboard/overview.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/overview.md)

- Cập nhật tài liệu canonical knowledge (tiếng Anh) ghi nhận cơ chế In-Memory Session Money Visibility Masking và nút điều khiển trên WorkspaceHeader.

#### [MODIFY] [.agents/docs/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Bổ sung tài liệu phát triển (tiếng Việt) về tính năng ẩn/hiện số tiền nhạy cảm trong phiên làm việc.

---

## Verification Plan

### Automated Tests & Quality Gates

- Chạy kiểm tra hệ thống tài liệu:
  ```bash
  npm run agent-system:validate
  ```
- Kiểm tra kiểu dữ liệu toàn bộ monorepo:
  ```bash
  npm run typecheck
  ```
- Quét linter và quy tắc i18n / zero-any:
  ```bash
  npm run lint
  ```
- Kiểm tra build tĩnh cho ứng dụng web:
  ```bash
  npm run build
  ```

### Manual Verification

1. **Kiểm tra nút trên WorkspaceHeader**: Xuất hiện trên tất cả màn hình có header (Tổng quan, Thu chi, Phân tích, Chi tiêu, Vay & Cho vay, v.v.).
2. **Kiểm tra trạng thái Ẩn (`isMoneyVisible: false`)**:
   - Tất cả các số tiền trên KPI cards, bảng dữ liệu, footer tổng kết và tooltip biểu đồ đều chuyển thành `••••••`.
   - Các trường khác (ngày tháng, tên, danh mục, trạng thái) không bị ảnh hưởng.
3. **Kiểm tra ngoại lệ Inline Edit**:
   - Khi nhấp đúp vào dòng để sửa số tiền trên bảng Thu chi / Chi tiêu / Công nợ, ô input vẫn hiển thị giá trị số thật để nhập/sửa bình thường.
4. **Kiểm tra khôi phục (`isMoneyVisible: true`)**:
   - Bấm nút một lần nữa, tất cả số tiền hiển thị lại đúng định dạng tiền tệ VND / i18n locale.
5. **Kiểm tra tính chất phiên (Session-only)**:
   - Chuyển sang trạng thái Ẩn, sau đó tải lại trang (`F5`) -> Xác nhận hệ thống trở về trạng thái mặc định là Hiện số tiền (không bị lưu vào `localStorage`).

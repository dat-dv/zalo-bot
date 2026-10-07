# Kế hoạch chuẩn hóa Tên Cột & Bổ sung Cột Số Dư Sau Giao Dịch

Tài liệu này xác định kế hoạch chuẩn hóa tên gọi các cột dữ liệu theo thuật ngữ trực quan, thân thiện với người dùng và bổ sung cột **Số dư sau giao dịch (Running Balance)** vào bảng Thu – Chi để mang lại trải nghiệm sao kê tài chính chuẩn mực.

---

## 1. Mục tiêu và Thay đổi Nghiệp vụ

1. **Chuẩn hóa Tên Cột Bảng Phân Rã Dòng Tiền (`/analytics`)**:
   - `Thu vào` $\rightarrow$ **`Tổng thu (+)`** (`analytics.cashflow.column.income`)
   - `Chi ra` $\rightarrow$ **`Tổng chi (-)`** (`analytics.cashflow.column.expense`)
   - `Dòng tiền thuần` $\rightarrow$ **`Chênh lệch Thu–Chi`** (`analytics.cashflow.column.netCashflow`)
   - `Số dư tích lũy` $\rightarrow$ **`Số dư ví cuối kỳ`** (`analytics.cashflow.column.balance`)
2. **Bổ sung Cột "Số dư sau GD" vào Bảng Thu – Chi (`/transactions` & `TransactionsTable`)**:
   - Tính toán số dư ví lũy kế sau mỗi giao dịch dựa trên trình tự thời gian (Chronological Running Balance).
   - Hiển thị trên cột `Số dư sau GD` (`transactions.columns.runningBalance`), giúp người dùng đối soát tức thì số tiền còn lại trong ví tại từng thời điểm.
   - Hỗ trợ đầy đủ tính năng ẩn/hiện số tiền nhạy cảm (`useMoneyFormatter()`) và tuân thủ chuẩn `Common Data Table`.

---

## 2. User Review Required

> [!NOTE]
> **Cách tính Số dư sau GD (Running Balance)**:
> Dữ liệu giao dịch được sắp xếp theo trình tự thời gian từ cũ nhất đến mới nhất để tính lũy kế số dư sau mỗi biến động thu/chi. Khi hiển thị bảng ở chế độ mặc định (mới nhất lên đầu), dòng giao dịch đầu tiên sẽ hiển thị chính xác **Số dư ví hiện tại**.

---

## 3. Proposed Changes

### Shared Contracts & i18n

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation key cho `transactions.columns.runningBalance`:
  - `vi`: `"Số dư sau GD"`
  - `en`: `"Balance after transaction"`
- Tinh chỉnh các translation keys cho bảng phân rã dòng tiền:
  - `analytics.cashflow.column.income`: `"Tổng thu (+)"` / `"Total Income (+)"`
  - `analytics.cashflow.column.expense`: `"Tổng chi (-)"` / `"Total Expense (-)"`
  - `analytics.cashflow.column.netCashflow`: `"Chênh lệch Thu–Chi"` / `"Net Surplus / Deficit"`
  - `analytics.cashflow.column.balance`: `"Số dư ví cuối kỳ"` / `"Ending Balance"`

---

### Frontend Web UI (`apps/web`)

#### [MODIFY] [`apps/web/src/modules/dashboard/view/transactions-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-table.tsx)

- Mở rộng kiểu dữ liệu `TransactionTableItem`: thêm trường `runningBalance?: number`.
- Khai báo thêm cột `runningBalance` vào bảng `TransactionsTable`:
  - `header: t('transactions.columns.runningBalance')`
  - `align: 'right'`
  - Hiển thị số tiền với font số `tabular-nums font-semibold` và định dạng `money(item.runningBalance)`.

#### [MODIFY] [`apps/web/src/modules/dashboard/view/transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Bổ sung logic tính toán `runningBalance` cho từng giao dịch:
  - Sắp xếp giao dịch theo thứ tự thời gian tăng dần $\rightarrow$ tính cộng dồn lũy kế số dư.
  - Gán giá trị `runningBalance` vào từng item trước khi lọc và hiển thị lên bảng.

#### [MODIFY] [`apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Cập nhật danh sách giao dịch hiển thị tại Dashboard Overview kèm `runningBalance`.

#### [MODIFY] [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Đảm bảo bảng phân rã dòng tiền sử dụng đầy đủ các nhãn cột mới đã chuẩn hóa.

---

## 4. Verification Plan

### Automated Tests

- Chạy kiểm tra Type Safety toàn dự án:
  ```bash
  npm run typecheck
  ```
- Chạy kiểm tra Lint và Agent Rules:
  ```bash
  npm run lint
  npm run agent-system:validate
  ```
- Chạy Backend Unit Tests:
  ```bash
  npm run test --workspace @zalobot/api
  ```

### Manual Verification

1. Truy cập trang Giao dịch (`/transactions`):
   - Kiểm tra cột **Số dư sau GD** hiển thị đầy đủ trên từng dòng giao dịch.
   - Xác nhận dòng giao dịch trên cùng có số dư bằng đúng số dư ví hiện tại.
   - Thao tác nhấp vào nút "Ẩn/Hiện số tiền" trên header để kiểm tra mặt nạ `••••••` hoạt động đồng bộ trên cột số dư mới.
2. Truy cập trang Phân tích (`/analytics`):
   - Chuyển sang chế độ xem Bảng số liệu của Biểu đồ Xu hướng dòng tiền.
   - Xác nhận 4 cột: **Tổng thu (+)**, **Tổng chi (-)**, **Chênh lệch Thu–Chi**, **Số dư ví cuối kỳ** hiển thị rõ ràng, chuyên nghiệp.

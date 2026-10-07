# Walkthrough: Bổ sung bộ lọc trạng thái cho màn hình Vay & cho vay (Debts)

Đã hoàn thành nâng cấp bộ lọc trạng thái (**Status Filter**) và hiển thị trạng thái trực quan cho màn hình Vay & Cho vay (`DebtsScreen`) trên Web Dashboard.

---

## 1. Các thay đổi đã thực hiện

### 1.1. Packages / Shared Contracts (`@zalobot/contracts`)

- Mở rộng interface `IDebtListItem`: Bổ sung thuộc tính `status?: 'active' | 'settled'`.
- Bổ sung translation keys đa ngôn ngữ (`vi` và `en`):
  - `debts.columns.status`: `'Trạng thái'` / `'Status'`
  - `debts.status.active`: `'Đang mở'` / `'Active'`
  - `debts.status.settled`: `'Đã tất toán'` / `'Settled'`
  - `debts.filter.statusAll`: `'Tất cả trạng thái'` / `'All status'`
  - `debts.filter.statusActive`: `'Đang mở'` / `'Active'`
  - `debts.filter.statusSettled`: `'Đã tất toán'` / `'Settled'`
  - `debts.filter.directionAll`: `'Tất cả luồng'` / `'All directions'`

### 1.2. Backend API (`apps/api`)

- **`ReportsController` (`GET /api/debts`)**:
  - Chuyển sang sử dụng `this.finance.listDebts(userId, status)` để lấy đầy đủ cả công nợ đang mở (`active`) và công nợ đã hoàn thành (`settled`).
  - Ánh xạ đầy đủ các trường `status`, `currency`, `settledAt`, `updatedAt` vào đối tượng `IDebtListItem`.

### 1.3. Frontend Debts Screen (`apps/web/src/modules/debts/view/debts-screen.tsx`)

- Thêm state `statusFilter`: `'all' | 'active' | 'settled'`.
- Thêm cột `status` trong `debtColumns` hiển thị badge trực quan:
  - `badge badge--pending` cho _Đang mở_ (`active`).
  - `badge badge--completed` cho _Đã tất toán_ (`settled`).
- Tính toán số lượng thời gian thực (real-time count badges) trên các nút lọc:
  - `Tất cả trạng thái (count)`
  - `Đang mở (count)`
  - `Đã tất toán (count)`
- Lọc 3 chiều kết hợp mượt mà: Luồng tiền (`directionFilter`) $\rightarrow$ Trạng thái (`statusFilter`) $\rightarrow$ Từ khóa tìm kiếm (`search`).
- Đảm bảo thẻ KPI tổng tiền trên đầu trang chỉ tính các khoản nợ **đang mở** (`remainingAmount > 0`) để số liệu tài chính phản ánh chuẩn xác.

---

## 2. Kết quả xác thực (Verification Results)

### Kiểm tra tự động

- **Typecheck**: `npm run typecheck` ➜ Passed (0 lỗi).
- **Unit Tests**: `npm run test --workspace @zalobot/api` ➜ 5/5 tests passed.
- **Web Build**: `npm run build:web` ➜ Compiled & Generated static pages successfully.
- **Agent System Validation**: `npm run agent-system:validate` ➜ 85 artifacts, 149 dependencies, 0 cyclic groups passed.

---

## 3. Hướng dẫn kiểm tra thủ công (Manual Verification)

1. Mở trang `/debts`:
   - Kiểm tra hai nhóm nút lọc xuất hiện trên toolbar:
     - Nhóm lọc trạng thái: `[Tất cả trạng thái (N)] [Đang mở (N)] [Đã tất toán (N)]`
     - Nhóm lọc luồng: `[Tất cả luồng] [Phải thu] [Phải trả]`
   - Bấm vào tab **Đang mở** ➜ Chỉ hiển thị các khoản nợ còn tiền (`remainingAmount > 0`) với badge cam/xanh lam.
   - Bấm vào tab **Đã tất toán** ➜ Hiển thị các khoản nợ đã trả hết (`remainingAmount === 0`) với badge xanh lá.
   - Bấm vào tab **Tất cả trạng thái** ➜ Hiển thị toàn bộ công nợ.
2. Thao tác trả nợ / tất toán:
   - Bấm `+ Trả nợ` trên một hàng đang mở ➜ Sau khi thanh toán xong, khoản nợ tự động đổi sang badge _Đã tất toán_ và chuyển danh mục tương ứng ngay lập tức.

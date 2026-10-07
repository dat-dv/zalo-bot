# Kế hoạch bổ sung bộ lọc trạng thái cho màn hình Vay & Cho vay (Debts)

## Tổng quan & Bối cảnh

Người dùng yêu cầu bổ sung bộ lọc theo trạng thái (**Status Filter**) cho màn hình "Vay & cho vay" (`DebtsScreen`). Hiện tại màn hình chỉ có bộ lọc theo chiều luồng tiền (`DirectionFilter`: Phải thu / Cho vay, Phải trả / Vay nợ, Tất cả) mà chưa hỗ trợ lọc theo trạng thái công nợ:

- **Đang mở** (`active`): Các khoản nợ còn tiền (`remainingAmount > 0`, chưa tất toán).
- **Đã tất toán** (`settled`): Các khoản nợ đã được thanh toán hết (`remainingAmount === 0` hoặc đã có `settledAt`).
- **Tất cả trạng thái** (`all`): Hiển thị toàn bộ công nợ.

## Phân tích nguyên nhân & Hiện trạng hệ thống

1. **Backend (`apps/api`)**:
   - `GET /api/debts` trong `ReportsController` hiện gọi `this.finance.getActiveDebts(userId)`, chỉ trả về các khoản nợ có `status = 'active'`. Các khoản đã tất toán (`status = 'settled'`) bị loại bỏ hoàn toàn khỏi response.
   - Hàm `this.finance.listDebts(userId, status?)` đã có sẵn trong `FinanceService` để lấy toàn bộ hoặc theo trạng thái.

2. **Shared Contract (`packages/contracts`)**:
   - `IDebtListItem` cần bổ sung rõ ràng trường `status?: 'active' | 'settled'` để đồng bộ contract.
   - Bổ sung translation keys cho trạng thái và nút lọc công nợ đa ngôn ngữ (`vi` và `en`).

3. **Frontend Web (`apps/web`)**:
   - `DebtsScreen` chưa có state `statusFilter` và nhóm nút lọc trạng thái.
   - Bảng dữ liệu chưa hiển thị cột hoặc badge trạng thái (_Đang mở_ vs _Đã tất toán_).

---

## User Review Required

> [!NOTE]
> Tổng tiền "Phải thu", "Phải trả" và "Công nợ ròng" trên thanh Metric Strip trên cùng sẽ tiếp tục tính toán trên các khoản nợ **đang mở** (`active`, `remainingAmount > 0`) để đảm bảo số liệu phản ánh đúng nghĩa vụ tài chính thực tế hiện hữu.

---

## Thay đổi đề xuất (Proposed Changes)

### 1. Packages / Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung trường `status?: 'active' | 'settled'` vào interface `IDebtListItem`.
- Thêm translation keys vào `messages.vi` và `messages.en`:
  - `debts.columns.status`: `'Trạng thái'` / `'Status'`
  - `debts.status.active`: `'Đang mở'` / `'Active'`
  - `debts.status.settled`: `'Đã tất toán'` / `'Settled'`
  - `debts.filter.statusAll`: `'Tất cả trạng thái'` / `'All status'`
  - `debts.filter.statusActive`: `'Đang mở'` / `'Active'`
  - `debts.filter.statusSettled`: `'Đã tất toán'` / `'Settled'`

---

### 2. Backend Module (`apps/api`)

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Cập nhật endpoint `GET /api/debts`: Gọi `this.finance.listDebts(userId)` để trả về đầy đủ cả khoản nợ đang mở và đã tất toán.
- Ánh xạ đầy đủ `status`, `currency`, `settledAt`, `updatedAt` vào đối tượng `IDebtListItem` trả về client.

---

### 3. Frontend Debts Module (`apps/web/src/modules/debts`)

#### [MODIFY] [debts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)

- Bổ sung state `statusFilter`: `'all' | 'active' | 'settled'`.
- Thêm cột `status` trong `debtColumns`:
  - Hiển thị badge trực quan: `badge--pending` (_Đang mở_) và `badge--completed` (_Đã tất toán_).
- Tính toán số đếm badge cho các nút lọc trạng thái (`all`, `active`, `settled`).
- Cập nhật logic lọc 3 chiều:
  1. Lọc theo luồng tiền (`direction`: Tất cả, Phải thu, Phải trả).
  2. Lọc theo trạng thái (`statusFilter`: Tất cả, Đang mở, Đã tất toán).
  3. Lọc theo từ khóa tìm kiếm (`search`: Tên đối tác, Alias, Ghi chú).
- Cập nhật toolbar của `DataPanel` để bố trí nhóm nút lọc trạng thái và nhóm nút lọc luồng tiền khoa học, rõ ràng.

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Tests

1. **Kiểm tra kiểu dữ liệu toàn monorepo**:
   ```bash
   npm run typecheck
   ```
2. **Kiểm tra unit tests backend**:
   ```bash
   npm run test --workspace @zalobot/api
   ```
3. **Kiểm tra tính toàn vẹn hệ thống Agent**:
   ```bash
   npm run agent-system:validate
   ```
4. **Kiểm tra build web**:
   ```bash
   npm run build:web
   ```

### Manual Verification

1. Mở trang `/debts`:
   - Kiểm tra nhóm nút lọc trạng thái: `[Tất cả] [Đang mở] [Đã tất toán]` kèm số lượng.
   - Bấm vào tab "Đang mở" -> Chỉ hiển thị các khoản nợ còn tiền (`remainingAmount > 0`).
   - Bấm vào tab "Đã tất toán" -> Hiển thị các khoản nợ đã trả hết (`remainingAmount === 0`, có ngày tất toán `settledAt`).
   - Bấm vào tab "Tất cả" -> Hiển thị toàn bộ công nợ.
2. Thao tác "Trả nợ" / "Tất toán":
   - Bấm nút "+ Trả nợ" hoặc sửa inline đưa `remainingAmount` về 0 -> Khoản nợ chuyển sang trạng thái "Đã tất toán" và cập nhật tức thì.

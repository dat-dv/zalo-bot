# Kế hoạch triển khai: Tối ưu UI Phân Bổ Công Nợ (Phương Án 2) & Validation Toàn Diện

## Mục tiêu thay đổi

1. **Tối ưu UI bảng Thu chi (TransactionsTable)**:
   - Loại bỏ nút to `🔗 Phân bổ công nợ` hiển thị tràn lan trên 100% các dòng giao dịch sinh hoạt thông thường (như ăn uống, mua sắm, y tế...).
   - Tinh gọn cột **Hoạt động (Actions)**: chỉ giữ lại 2 nút chuẩn `Sửa` và `Xóa`, giảm độ rộng cột từ `210px` xuống `130px - 140px`, giúp bảng thoáng đãng, dữ liệu không bị chật chội.
   - Với các giao dịch **đã có phân bổ công nợ** (`allocations.length > 0`): hiển thị badge/chip liên kết phân bổ nhỏ gọn tinh tế (ví dụ: `🔗 2 phân bổ`) có thể bấm vào để xem/sửa phân bổ nhanh.
   - Khi ở chế độ **Sửa (Inline Edit)**: cung cấp nút/lối tắt mở modal phân bổ công nợ cho giao dịch đang chỉnh sửa.

2. **Validation toàn diện (Full-stack Validation)**:
   - **Backend (`FinanceService`)**:
     - Chặn cập nhật giao dịch (`updateTransaction`): nếu giao dịch đã có phân bổ, không cho phép giảm `amount` xuống nhỏ hơn tổng số tiền đã phân bổ (`totalAllocated`), và không cho phép đổi `type` (thu ↔ chi) khi chưa gỡ phân bổ.
     - Ràng buộc phân bổ (`allocateTransactionToDebts`): kiểm tra số tiền phân bổ từng khoản `> 0` và `<= remainingAmount`, tổng phân bổ `<= transaction.amount`, không trùng lặp `debtId`, thực thi trong Database Transaction nguyên tử.
   - **Frontend (`DebtAllocationModal` & `TransactionsTable`)**:
     - Kiểm tra hợp lệ thời gian thực (real-time validation): số tiền không âm, không vượt số nợ còn lại, tổng không vượt số tiền giao dịch.
     - Vô hiệu hóa nút Submit và hiển thị thông báo lỗi trực quan khi dữ liệu không hợp lệ.
     - Tuân thủ 100% quy tắc Zero Hardcoded Text (`i18n-no-hardcoded-user-text.md`).

---

## User Review Required

> [!NOTE]
>
> - **Cột Hoạt động**: Độ rộng cột sẽ được thu gọn về `130px` (thay vì `210px`), giúp hiển thị nhiều nội dung hơn cho cột _Ghi chú_ và _Nơi chốn_.
> - **Cách mở phân bổ công nợ**: Người dùng có thể click vào badge `🔗 <N> phân bổ` trên các dòng đã có phân bổ, hoặc click nút `🔗 Phân bổ` khi đang ở chế độ Sửa dòng đó.

---

## Proposed Changes

Grouped by component / layer:

### 1. Contracts & Translations (`packages/contracts`)

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys song ngữ (`vi` & `en`) cho:
  - `transactions.allocation.badgeAllocated`: `'{count} phân bổ'` / `'{count} allocations'`
  - `transactions.allocation.cannotChangeTypeWithAllocations`: Thông báo lỗi khi đổi chiều giao dịch đã có phân bổ.
  - `transactions.allocation.cannotReduceBelowAllocated`: Thông báo lỗi khi giảm số tiền giao dịch nhỏ hơn tổng tiền đã phân bổ.
  - `transactions.allocation.modalSubtitleIncome`: Phụ đề modal cho khoản thu.
  - `transactions.allocation.modalSubtitleExpense`: Phụ đề modal cho khoản chi.

---

### 2. Backend Validation (`apps/api`)

#### [MODIFY] [`apps/api/src/finance/finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Trong hàm `updateTransaction(userId, id, input)`:
  - Tính tổng số tiền đã phân bổ hiện tại của giao dịch: `currentAllocatedSum = tx.allocations.reduce(...)`.
  - Nếu `input.type` khác `tx.type` và `currentAllocatedSum > 0`: ném lỗi chặn đổi chiều giao dịch khi đang có phân bổ.
  - Nếu `input.amount !== undefined` và `newAmount < currentAllocatedSum`: ném lỗi `Số tiền giao dịch mới không được nhỏ hơn tổng số tiền đã phân bổ công nợ (${currentAllocatedSum})`.

---

### 3. Frontend Presentation & Components (`apps/web`)

#### [MODIFY] [`apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx)

- Cập nhật cột `actions`:
  - `minWidth`: chuẩn hóa về `'130px'`.
  - Chế độ thường: chỉ render 2 nút chuẩn `Sửa` (`onStartEdit`) và `Xóa` (`onDelete`).
  - Nếu `item.allocations && item.allocations.length > 0`: render badge nhỏ `🔗 {count}` cạnh note/amount hoặc trong cell để user dễ dàng bấm mở `onOpenAllocate(item)`.
  - Chế độ inline edit: thêm nút phụ `🔗 Phân bổ` nếu có `onOpenAllocate` để người dùng có thể mở modal phân bổ khi đang chỉnh sửa giao dịch.

#### [MODIFY] [`apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx)

- Thay thế các chuỗi hardcode phụ đề bằng translation keys `t('transactions.allocation.modalSubtitleIncome')` và `t('transactions.allocation.modalSubtitleExpense')`.
- Đảm bảo validation real-time chặt chẽ: vô hiệu hóa nút submit khi `totalAllocated > transaction.amount` hoặc có dòng nhập vượt `remainingAmount`.

---

### 4. Unit Tests & Verification

#### [MODIFY] [`apps/api/test/finance.service.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/test/finance.service.spec.ts)

- Bổ sung unit test cho case chặn `updateTransaction` khi giảm số tiền nhỏ hơn `totalAllocated` hoặc đổi `type`.
- Chạy toàn bộ test suite và lint check.

---

## Verification Plan

### Automated Tests

```bash
# 1. Typecheck toàn bộ workspace
npm run typecheck

# 2. Chạy test suite backend finance
npm --workspace=@zalobot/api run test -- finance.service.spec.ts

# 3. Chạy validation quy chuẩn hệ thống & lint
npm run agent-system:validate
npm run lint
```

### Manual Verification

1. Mở trang Thu chi trên web browser: xác nhận cột Hoạt động trên các dòng thường chỉ có nút **Sửa** và **Xóa**, bảng gọn gàng không bị vỡ cột.
2. Kiểm tra dòng có phân bổ công nợ: xuất hiện badge `🔗 <N> phân bổ`, bấm vào mở đúng modal phân bổ.
3. Trong modal phân bổ: thử nhập số tiền vượt số nợ hoặc vượt số tiền giao dịch -> kiểm tra hiển thị lỗi đỏ và disable nút Lưu.
4. Thử chỉnh sửa số tiền giao dịch về mức thấp hơn số tiền đã phân bổ -> kiểm tra backend từ chối và báo lỗi rõ ràng.

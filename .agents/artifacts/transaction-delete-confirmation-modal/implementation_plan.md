# Kế hoạch Triển khai Modal Xác nhận Xóa Giao dịch & Cảnh báo Tác động Số dư Tài khoản Chính

## 1. Giải đáp thắc mắc về Nguyên lý Số dư khi Xóa Giao dịch

> [!NOTE]
> **Nguyên lý Số dư Dòng tiền (Ledger Cashflow Balance):**
> Trong hệ thống kế toán dòng tiền, số dư ví/tài khoản chính được tính toán dựa trên tổng thu trừ đi tổng chi:
> $$\text{Số dư ví} = \sum \text{Khoản Thu} - \sum \text{Khoản Chi}$$
>
> Do đó, khi xóa một giao dịch:
>
> 1. **Xóa Khoản Chi ($X$ ₫)**: Khoản tiền đã chi không còn tồn tại $\rightarrow$ Số dư ví thực tế **được cộng hoàn lại: $+X$ ₫** (số dư tăng lên).
> 2. **Xóa Khoản Thu ($X$ ₫)**: Khoản tiền thu vào bị hủy $\rightarrow$ Số dư ví thực tế **bị trừ giảm đi: $-X$ ₫** (số dư giảm xuống).
> 3. **Xóa Giao dịch có Phân bổ Công nợ**: Khoản nợ tương ứng sẽ được **khôi phục lại số nợ chưa trả** (`remainingAmount` tăng lên tương ứng).

Hiện tại giao diện đang dùng `window.confirm()` trình duyệt thô sơ, chưa giải thích tác động tài chính này cho người dùng và chưa hiển thị chi tiết giao dịch sắp xóa.

---

## 2. Thiết kế Giải pháp: `DeleteTransactionModal`

Xây dựng component Modal xác nhận xóa giao dịch chuyên nghiệp, trực quan theo chuẩn Enterprise B2B SaaS:

### A. Giao diện Modal Xác nhận (`DeleteTransactionModal`)

1. **Thông tin chi tiết giao dịch**:
   - Badge loại giao dịch (Thu / Chi) với màu sắc rõ ràng (`emerald` / `amber`).
   - Danh mục, Địa điểm/Nơi chốn (nếu có), Số tiền, Ngày giờ phát sinh, Ghi chú.
2. **Khối Cảnh báo Tác động Số dư Ví / Tài khoản chính**:
   - **Nếu xóa Khoản Chi**: Hiển thị hộp thông báo màu xanh ngọc:
     - 💰 **Số dư ví sẽ được cộng hoàn lại**: `+X ₫`
     - _Giải thích_: Khoản chi này sẽ bị xóa khỏi sổ sách, số dư khả dụng thực tế của bạn sẽ tăng thêm tương ứng.
   - **Nếu xóa Khoản Thu**: Hiển thị hộp thông báo màu hổ phách/đỏ:
     - ⚠️ **Số dư ví sẽ bị khấu trừ giảm**: `-X ₫`
     - _Giải thích_: Khoản thu này sẽ bị hủy bỏ khỏi sổ sách, số dư khả dụng thực tế của bạn sẽ giảm đi tương ứng.
3. **Cảnh báo Khôi phục Công nợ (nếu có liên kết)**:
   - Nếu giao dịch có liên kết phân bổ công nợ (`allocations.length > 0`), hiển thị cảnh báo: _"Giao dịch đang phân bổ vào {count} khoản nợ. Thao tác xóa sẽ khôi phục lại số nợ chưa trả."_
4. **Nút Thao tác**:
   - Nút `Hủy bỏ` (đóng modal an toàn).
   - Nút `Xác nhận xóa` (màu đỏ nguy hiểm `bg-rose-600 hover:bg-rose-700 text-white font-semibold`) với trạng thái `loading` khi đang thực thi API.

---

## 3. Cập nhật Backend (`apps/api`)

### Bảo toàn tính toàn vẹn dữ liệu khi Xóa Giao dịch

- Cập nhật hàm `deleteTransaction(userId, id)` trong `apps/api/src/finance/finance.service.ts`:
  - Trước khi xóa bản ghi transaction khỏi DB, kiểm tra các khoản phân bổ `DebtPaymentAllocationEntity` và `DebtPaymentEntity` liên kết.
  - Tự động cộng hoàn lại `debt.remainingAmount += alloc.amount` cho các khoản nợ liên quan trong 1 transaction an toàn.
  - Xóa sạch các bản ghi phân bổ và đợt trả nợ liên kết trước khi xóa giao dịch.

---

## 4. Proposed Changes

### Packages / Contracts (`packages/contracts`)

#### [MODIFY] [`index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys song ngữ (`vi` & `en`):
  - `transactions.deleteModal.title`: `'Xác nhận xóa giao dịch'` / `'Confirm Delete Transaction'`
  - `transactions.deleteModal.subtitle`: `'Vui lòng kiểm tra kỹ tác động số dư bên dưới'` / `'Please review the balance impact below'`
  - `transactions.deleteModal.impactExpenseRefund`: `'Số dư ví sẽ được cộng hoàn lại: +{amount}'` / `'Wallet balance will be refunded: +{amount}'`
  - `transactions.deleteModal.impactExpenseExplain`: `'Khoản chi này sẽ bị xóa khỏi sổ sách, số dư khả dụng thực tế sẽ được cộng bù lại tương ứng.'` / `'This expense will be removed from the ledger and your available balance will increase accordingly.'`
  - `transactions.deleteModal.impactIncomeDeduct`: `'Số dư ví sẽ bị khấu trừ giảm: -{amount}'` / `'Wallet balance will be deducted: -{amount}'`
  - `transactions.deleteModal.impactIncomeExplain`: `'Khoản thu này sẽ bị hủy khỏi sổ sách, số dư khả dụng thực tế sẽ bị giảm đi tương ứng.'` / `'This income will be removed from the ledger and your available balance will decrease accordingly.'`
  - `transactions.deleteModal.allocationsWarning`: `'Giao dịch này đang được phân bổ vào {count} khoản nợ. Thao tác xóa sẽ khôi phục lại số nợ chưa trả.'` / `'This transaction is allocated to {count} debts. Deleting will restore the unpaid debt balances.'`
  - `transactions.deleteModal.confirmAction`: `'Xóa giao dịch'` / `'Delete Transaction'`

### Web Application (`apps/web`)

#### [NEW] [`delete-transaction-modal.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/delete-transaction-modal.tsx)

- Tạo component Modal xác nhận xóa giao dịch chuyên nghiệp.

#### [MODIFY] [`transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx)

- Tích hợp `deletingTransaction: TransactionTableItem | null` state.
- Khi người dùng bấm nút xóa (✕) trên bảng: Mở `DeleteTransactionModal` thay cho `window.confirm()`.

### Backend API (`apps/api`)

#### [MODIFY] [`finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Bổ sung logic khôi phục công nợ khi xóa transaction có allocations.

---

## 5. Kế hoạch Kiểm Thử (Verification Plan)

### Automated Tests & Quality Gates

- `npm run typecheck`
- `npm run lint`
- `npm run test --workspace=@zalobot/api` (unit test xóa transaction độc lập vs transaction có phân bổ công nợ)
- `npm run agent-system:validate`

### Manual Verification

- Mở trang `/transactions`, bấm nút Xóa (✕) trên:
  1. Khoản Chi $\rightarrow$ Modal hiển thị cảnh báo cộng hoàn lại `+X ₫` màu xanh ngọc.
  2. Khoản Thu $\rightarrow$ Modal hiển thị cảnh báo khấu trừ giảm `-X ₫` màu hổ phách/đỏ.
  3. Khoản có phân bổ công nợ $\rightarrow$ Modal hiển thị cảnh báo khôi phục nợ.
  4. Bấm "Xác nhận xóa" $\rightarrow$ Giao dịch bị xóa, toast thành công, số dư cập nhật tức thì.

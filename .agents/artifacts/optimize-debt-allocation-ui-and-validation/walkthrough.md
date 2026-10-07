# Walkthrough: Tối Ưu UI Phân Bổ Công Nợ (Phương Án 2) & Validation Toàn Diện

Đã hoàn thành tối ưu cột Hoạt động trên bảng Thu chi (`TransactionsTable`), loại bỏ nút phân bổ công nợ hiển thị tràn lan trên 100% các dòng giao dịch sinh hoạt thông thường, đồng thời bổ sung hệ thống validation chặt chẽ 2 đầu (Frontend & Backend).

---

## 1. Các thay đổi chính đã thực hiện

### Giao diện bảng Thu chi ([`transactions-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx))

- **Thu gọn cột Hoạt động (Actions)**:
  - Chiều rộng cột chuẩn hóa cố định về `130px` (thay vì `210px`), giúp bảng thoáng đãng, các cột Ghi chú và Nơi chốn có nhiều không gian hiển thị hơn.
  - Trên các dòng giao dịch sinh hoạt bình thường: chỉ hiển thị 2 nút chuẩn **Sửa** và **Xóa**.
- **Badge phân bổ thông minh**:
  - Dòng giao dịch nào **đã có phân bổ công nợ** (`allocations.length > 0`): hiển thị badge chip tinh gọn `🔗 <N> phân bổ` ngay tại ô Ghi chú. Người dùng có thể click trực tiếp vào badge để mở nhanh modal phân bổ công nợ.
- **Chế độ Sửa trực tiếp (Inline Edit)**:
  - Khi đang sửa một dòng giao dịch: bổ sung nút lối tắt `🔗` cạnh nút Lưu và Hủy để người dùng có thể mở modal phân bổ khi cần.
  - Kiểm tra validation ngay trên dòng: nếu giao dịch đã có phân bổ, tự động disable nút Lưu và hiển thị tooltip cảnh báo nếu người dùng cố tình đổi chiều giao dịch (`type`) hoặc nhập số tiền nhỏ hơn tổng số tiền đã phân bổ (`amount < totalAllocated`).

### Modal phân bổ công nợ ([`debt-allocation-modal.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx))

- Chuẩn hóa 100% i18n không còn hardcode text (sử dụng translation keys `transactions.allocation.modalSubtitleIncome`, `transactions.allocation.modalSubtitleExpense`, `transactions.allocation.noteOptional`, `common.saving`).
- Real-time validation: vô hiệu hóa nút Lưu khi tổng tiền vượt quá số tiền giao dịch (`totalAllocated > transaction.amount`) hoặc có dòng nhập vượt số nợ còn lại (`amount > remainingAmount`).

### Backend Validation ([`finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts))

- Trong hàm `updateTransaction`:
  - Kiểm tra và chặn việc đổi chiều giao dịch (`type: income ↔ expense`) khi giao dịch đang có phân bổ công nợ đang hoạt động.
  - Kiểm tra và chặn việc cập nhật giảm `amount` của giao dịch xuống nhỏ hơn tổng số tiền đã phân bổ (`totalAllocated`), ném thông báo lỗi rõ ràng.

### Shared Contracts & Từ điển i18n ([`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts))

- Bổ sung translation keys song ngữ (`vi` và `en`) cho badge phân bổ, phụ đề modal và các thông báo lỗi validation.

---

## 2. Kết quả kiểm tra & Verification

| Hạng mục kiểm tra              | Lệnh thực hiện                          | Kết quả                                                                                              |
| :----------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **Typecheck toàn monorepo**    | `npm run typecheck`                     | ✅ **Passed** (0 lỗi trên tất cả các workspace `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`) |
| **Unit tests Backend Finance** | `npm --workspace=@zalobot/api run test` | ✅ **Passed 74/74 tests** (15/15 tests trong `finance.service.spec.ts`)                              |
| **Linter toàn bộ workspace**   | `npm run lint`                          | ✅ **Passed** (0 warnings, 0 errors)                                                                 |
| **Quy chuẩn Agent System**     | `npm run agent-system:validate`         | ✅ **Passed** (91 artifacts, 0 cyclic groups)                                                        |

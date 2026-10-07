# Walkthrough: Hiển Thị Lịch Sử Đợt Trả Nợ / Thanh Toán Con (Debt Payments) Trong Bảng Công Nợ

Đã hoàn thành triển khai tính năng hiển thị chi tiết các đợt trả nợ / thanh toán con (**Debt Payments Nested Rows**) lồng nhau trong Bảng Công Nợ.

---

## 1. Những Điểm Thay Đổi Chính

### A. Gói Hợp Đồng Dùng Chung (`@zalobot/contracts`)

- Bổ sung các translation keys song ngữ (`vi` & `en`):
  - `debts.badge.paymentChild`: `'Đợt trả nợ'` / `'Debt payment'`
  - `debts.badge.paymentInstallment`: `'{count} đợt trả'` / `'{count} payments'`
  - `debts.expandPayments`: `'Xem {count} đợt trả nợ'` / `'View {count} debt payments'`
  - `debts.collapsePayments`: `'Thu gọn đợt trả nợ'` / `'Collapse debt payments'`
  - `debts.paidProgress`: `'Đã trả {amount}'` / `'Paid {amount}'`
  - `debts.paidProgressWithCount`: `'Đã trả {amount} ({count} đợt)'` / `'Paid {amount} ({count} payments)'`
  - `debts.deletePayment.confirm`: Xác nhận xóa đợt trả nợ và khôi phục số dư nợ
  - `debts.deletePayment.success`: Thông báo xóa thành công

### B. Backend API (`apps/api`)

- **`ReportsController.mapDebt`**: Map đầy đủ mảng `payments` cho từng khoản nợ (khoản gốc, khoản đơn và các khoản con), gồm: `id`, `amount`, `paymentDate`, `note`, `financeTransactionId`, `createdAt`.
- **`FinanceService` & `FinanceController`**:
  - Tối ưu `listDebts` để tải `payments: { financeTransaction: true }`.
  - Bổ sung hàm `deleteDebtPayment(userId, debtId, paymentId)` chạy transaction an toàn, tự động hoàn lại `remainingAmount` cho khoản nợ cha và xóa giao dịch thu chi liên kết nếu có.
  - Bổ sung API endpoint `DELETE /api/debts/:id/payments/:paymentId`.

### C. Frontend Web (`apps/web`)

- **API & Hooks**:
  - `deleteDebtPayment` trong `debts-api.ts`.
  - `useDeleteDebtPaymentMutation` trong `debts-query.ts`.
- **`DebtsTable`**:
  - Quản lý state `expandedPaymentDebtIds` mở rộng/thu gọn các đợt trả nợ.
  - Cập nhật `flattenedRows` chèn các dòng con đợt trả nợ (`_isPaymentChild: true`) ngay dưới khoản nợ tương ứng (hỗ trợ cả khoản đơn, khoản gộp, khoản con và khoản đã tất toán).
  - Cột **Người liên quan**: Icon Chevron xanh lá `▶ / ▼` và badge `[💸 N đợt trả]`; dòng con có ký hiệu thụt lề `↳`.
  - Cột **Còn lại**: Dòng chính hiển thị số nợ còn lại kèm nhãn phụ `(Đã trả X ₫ · N đợt)`; dòng con hiển thị số tiền đợt trả `- X ₫` màu xanh ngọc.
  - Cột **Ngày tất toán / Ngày trả**: Hiển thị ngày thanh toán thực tế của từng đợt trả.
  - Cột **Ghi chú**: Ghi chú đợt trả + huy hiệu `🔗 Giao dịch liên kết` nếu thanh toán được ghi nhận từ sổ thu chi.
  - Cột **Thao tác**: Nút xóa đợt trả nợ `✕` với xác nhận và thông báo toast.
  - Nền dòng đợt trả nợ: Phủ màu xanh ngọc nhẹ (`bg-emerald-50/30 dark:bg-emerald-950/20`) phân biệt rõ ràng.
- **`DebtsScreen`**:
  - Kết nối mutation xóa đợt trả nợ `handleDeletePayment` với thông báo toast.

---

## 2. Kết Quả Kiểm Thử & Quality Gates

1. `npm run build --workspace=@zalobot/contracts`: **PASS** (100% build thành công).
2. `npm run typecheck`: **PASS** (0 errors trên `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
3. `npm run lint`: **PASS** (0 linter errors, tuân thủ Zero-Any và i18n rules).
4. `npm run test --workspace=@zalobot/api`: **PASS** (74/74 unit tests passed).
5. `npm run agent-system:validate`: **PASS** (91 artifacts, 157 dependencies, 56 pairs).

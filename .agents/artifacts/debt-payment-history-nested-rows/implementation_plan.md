# Kế Hoạch Triển Khai: Hiển Thị Lịch Sử Đợt Trả Nợ / Thanh Toán Con (Debt Payments) Trong Bảng Công Nợ

## 1. Mục Tiêu & Bối Cảnh

Hiện tại, khi một khoản nợ (khoản đơn lẻ, khoản con trong nợ gộp, hoặc khoản đã tất toán) phát sinh các đợt thanh toán trả nợ (`debt_payments`), số tiền còn lại (`remainingAmount`) bị giảm đi (ví dụ từ 12 triệu còn 10 triệu, hoặc về 0đ khi tất toán) nhưng bảng giao diện chưa hiển thị chi tiết các đợt thanh toán cấu thành, dẫn đến việc thiếu minh bạch nguồn gốc dòng tiền trả nợ.

Kế hoạch này triển khai giải pháp **Hybrid Master-Detail Nested Rows**:

1. Hiển thị thông tin tiến độ trả nợ tổng quan tại cột Số tiền: `(Đã trả X ₫ · N đợt)`.
2. Hỗ trợ nút mũi tên dropdown `▶ / ▼` trên mọi khoản nợ có phát sinh thanh toán (`payments.length > 0`), cho phép mở rộng các dòng con **Đợt trả nợ** trực tiếp ngay bên dưới.
3. Hỗ trợ hoàn tác / xóa đợt trả nợ nếu người dùng nhập nhầm.

---

## 2. User Review Required

> [!IMPORTANT]
> **Các tính năng nổi bật sẽ được bổ sung**:
>
> 1. **Dòng Đã Tất Toán (`settled`)**: Giữ nút dropdown `▶` để khi bấm vào sẽ thấy lịch sử thanh toán đã tất toán khoản nợ đó (Ngày trả, số tiền, ghi chú).
> 2. **Dòng Khoản Con trong Nợ Gộp (`child debts`)**: Bấm mở khoản cha ra các khoản con, và từng khoản con có thể bấm mở tiếp các đợt trả nợ của chính khoản con đó.
> 3. **Cột Số Tiền Còn Lại**: Bổ sung nhãn phụ thông minh: `(Đã trả 2.000.000 ₫ · 1 đợt)` để nhìn lướt qua là biết ngay số tiền đã trả.
> 4. **Xóa Đợt Trả Nợ**: Bổ sung nút xóa đợt trả nợ nhanh trên dòng con, tự động hoàn lại số nợ còn lại (`remainingAmount`).

---

## 3. Đề Xuất Thay Đổi Chi Tiết

### A. Backend API & Entity Mapping

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Cập nhật hàm `mapDebt(debt: DebtEntity)` để map đầy đủ mảng `payments`:
  ```ts
  payments: debt.payments?.map((p) => ({
    id: p.id,
    debtId: p.debtId,
    amount: p.amount,
    paymentDate: toIsoDate(p.paymentDate || p.createdAt),
    note: p.note || undefined,
    financeTransactionId: p.financeTransactionId || undefined,
    createdAt: toIsoDate(p.createdAt),
  })) || [];
  ```
- Đảm bảo `payments` được map cho cả khoản nợ cha và các khoản nợ con `children`.

#### [MODIFY] [finance.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)

- Bổ sung endpoint `DELETE /api/debts/:id/payments/:paymentId` cho phép xóa/hoàn tác một đợt thanh toán trả nợ.

#### [MODIFY] [finance.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Thêm hàm `deleteDebtPayment(userId, debtId, paymentId)` chạy trong transaction an toàn, tự động hoàn lại `remainingAmount` cho khoản nợ cha và xóa giao dịch thu chi liên kết nếu có.

---

### B. Gói Hợp Đồng Dùng Chung (`@zalobot/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys song ngữ (`vi` & `en`):
  - `debts.badge.paymentChild`: `'Đợt trả nợ'` / `'Debt payment'`
  - `debts.badge.paymentInstallment`: `'{count} đợt trả'` / `'{count} payments'`
  - `debts.expandPayments`: `'Xem {count} đợt trả nợ'` / `'View {count} debt payments'`
  - `debts.collapsePayments`: `'Thu gọn đợt trả nợ'` / `'Collapse debt payments'`
  - `debts.paidProgress`: `'Đã trả {amount}'` / `'Paid {amount}'`
  - `debts.paidProgressWithCount`: `'Đã trả {amount} ({count} đợt)'` / `'Paid {amount} ({count} payments)'`
  - `debts.deletePayment.confirm`: `'Bạn có chắc chắn muốn xóa đợt trả nợ này? Số tiền nợ còn lại sẽ được khôi phục.'` / `'Are you sure you want to delete this payment record? The remaining debt amount will be restored.'`
  - `debts.deletePayment.success`: `'Đã xóa đợt trả nợ thành công'` / `'Debt payment deleted successfully'`

---

### C. Frontend Web (`apps/web`)

#### [MODIFY] [debts-api.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/api/debts-api.ts) & [debts-query.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/api/debts-query.ts)

- Thêm hàm `deleteDebtPayment(debtId, paymentId)` và hook `useDeleteDebtPaymentMutation()`.

#### [MODIFY] [debts-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/presentation/components/debts-table.tsx)

- Quản lý state `expandedPaymentDebtIds: Set<string>`.
- Mở rộng hàm `flattenedRows`: Chèn các dòng con đợt trả nợ (`_isPaymentChild: true`) ngay dưới khoản nợ tương ứng khi người dùng mở rộng.
- Cập nhật các cột hiển thị:
  - **Cột Người liên quan / Tên khoản**:
    - Nút toggle Chevron `▶ / ▼` thông minh (mở khoản con nếu là nợ gộp, hoặc mở đợt trả nợ nếu có thanh toán).
    - Badge số đợt trả `[💸 N đợt trả]`.
  - **Cột Trạng thái**: Badge màu ngọc bích `Đợt trả nợ` (`Payment`) cho dòng con.
  - **Cột Còn lại**:
    - Dòng nợ chính: Hiển thị số còn lại kèm nhãn phụ `(Đã trả X ₫ · N đợt)`.
    - Dòng đợt trả nợ: Hiển thị số tiền `- X ₫` màu xanh ngọc/emerald.
  - **Cột Ngày giờ**: Hiển thị ngày thanh toán thực tế của đợt trả.
  - **Cột Ghi chú**: Ghi chú đợt trả + huy hiệu `🔗 Giao dịch liên kết` nếu có.
  - **Cột Thao tác**: Nút xóa đợt trả nợ nhanh (hoàn tác).

---

### D. Tài Liệu Hệ Thống & Knowledge Sync

#### [MODIFY] [debts knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md)

- Cập nhật quy chuẩn UX cây phân cấp thanh toán nợ lồng nhau (Payment sub-rows).

#### [MODIFY] [debts docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md)

- Cập nhật tài liệu hướng dẫn cho developer về cấu trúc dữ liệu `payments` và thao tác xóa/hoàn tác đợt trả nợ.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### Automated Tests & Quality Gates

- `npm run test --workspace=@zalobot/api`: Kiểm tra unit tests backend cho việc xóa và ghi nhận đợt trả nợ.
- `npm run build --workspace=@zalobot/contracts`: Build type definitions contracts.
- `npm run typecheck`: Kiểm tra 100% type safety trên toàn bộ monorepo.
- `npm run lint`: Kiểm tra không có vi phạm ESLint hay hardcoded text.
- `npm run agent-system:validate`: Kiểm tra tính toàn vẹn hệ thống tài liệu.

### Manual Verification

1. Mở trang Quản lý Công nợ (`/debts`):
   - Kiểm tra khoản nợ đã tất toán (Dòng 1): Có nút `▶` mở ra đợt trả nợ 1.000.000đ ngày 27/8.
   - Kiểm tra khoản nợ con 12tr còn 10tr (Dòng 4): Có nút `▶` mở ra đợt trả nợ 2.000.000đ.
   - Kiểm tra cột Còn lại hiển thị nhãn phụ `(Đã trả 2.000.000 ₫ · 1 đợt)`.
   - Thử bấm nút xóa đợt trả nợ xem số tiền còn lại có được hoàn phục về 12.000.000đ hay không.

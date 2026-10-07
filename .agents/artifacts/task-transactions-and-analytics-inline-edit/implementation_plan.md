# Kế hoạch triển khai: Bổ sung Inline Edit cho trang Thu chi (`/transactions`) và trang Phân tích (`/analytics`)

Tài liệu này mô tả chi tiết phương án bổ sung tính năng **Inline Editing** cho:

1. **Trang Thu chi (`/transactions`)**: Bảng toàn bộ dòng tiền thu/chi với inline edit loại giao dịch (Thu/Chi), danh mục, ghi chú, số tiền, ngày giờ phát sinh và cột thao tác (Sửa, Xóa, Lưu, Hủy).
2. **Trang Phân tích (`/analytics`)**:
   - **Bảng Giao dịch (`analytics-transactions`)**: Hỗ trợ inline edit loại giao dịch, danh mục, ghi chú, số tiền và nút Sửa/Xóa.
   - **Bảng Công nợ (`analytics-debts`)**: Hỗ trợ inline edit hướng vay, người liên quan (với Autocomplete danh bạ), hạn chót, số tiền còn lại và nút Sửa/Trả nợ nhanh.

---

## 1. Yêu cầu chi tiết tính năng

### 1.1. Trang Thu chi (`/transactions`)

- **Cột & Thao tác Inline Edit**:
  - `type`: Dropdown inline edit chuyển đổi giữa _Khoản thu_ (`income`) và _Khoản chi_ (`expense`).
  - `category`: Text input inline edit danh mục thu chi (Enter lưu, Escape hủy).
  - `note`: Text input inline edit ghi chú / nội dung giao dịch.
  - `amount`: Number input inline edit số tiền, tự động cập nhật thanh tỷ lệ mini bar.
  - `occurredAt`: Datetime-local picker inline edit ngày giờ phát sinh.
  - `actions`: Nút Sửa (✎) và Xóa (🗑) ở chế độ xem; Nút Lưu (✓) và Hủy (✕) khi đang sửa.
- **Phím tắt & Phản hồi**: `Enter` để lưu, `Escape` để hủy, Toast notification thông báo kết quả.

### 1.2. Trang Phân tích (`/analytics`)

- **Bảng Giao dịch (`analytics-transactions`)**:
  - Hỗ trợ nhấp đúp hoặc bấm nút Sửa để chỉnh sửa inline: Loại giao dịch (`type`), Danh mục (`category`), Ghi chú (`note`), Số tiền (`amount`).
  - Cột thao tác `actions` với các nút Sửa, Xóa, Lưu, Hủy.
- **Bảng Công nợ (`analytics-debts`)**:
  - Hỗ trợ nhấp đúp hoặc bấm nút Sửa để chỉnh sửa inline: Hướng (`direction`), Người liên quan (`counterparty` với autocomplete danh bạ), Hạn chót (`dueAt`), Số tiền còn lại (`remainingAmount`).
  - Cột thao tác `actions` với nút Sửa (✎), Trả nợ nhanh (+), Lưu (✓), Hủy (✕).

---

## 2. Chi tiết thay đổi theo từng lớp

### 2.1. Shared Contracts (`packages/contracts`)

- **[MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Bổ sung interface `IUpdateTransactionRequest`:
    ```typescript
    export interface IUpdateTransactionRequest {
      type?: TransactionType;
      category?: string;
      note?: string;
      amount?: number;
      currency?: string;
      paymentMethod?: string;
      receiptUrl?: string;
      contactId?: string;
      placeName?: string;
      occurredAt?: string;
    }
    ```
  - Bổ sung translation keys song ngữ (`vi` và `en`):
    - `transactions.actions.edit`, `transactions.actions.save`, `transactions.actions.cancel`, `transactions.actions.delete`
    - `transactions.delete.confirm`, `transactions.delete.success`, `transactions.inlineEdit.saved`
    - `transactions.placeholder.category`, `transactions.placeholder.note`, `transactions.placeholder.amount`

---

### 2.2. Web Frontend (`apps/web`)

- **[NEW] [`apps/web/src/modules/dashboard/api/transactions-api.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/api/transactions-api.ts)** & **[`transactions-query.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/api/transactions-query.ts)**:
  - `updateTransaction(id, data)` gọi `PATCH /transactions/:id`.
  - `deleteTransaction(id)` gọi `DELETE /transactions/:id`.
  - Hooks: `useUpdateTransactionMutation` và `useDeleteTransactionMutation` tự động invalidate cache `dashboard`, `transactions`, `expenses`.
- **[MODIFY] [`apps/web/src/modules/dashboard/view/transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)**:
  - Tích hợp trạng thái `editingId`, `editDraft`, `toastMessage`.
  - Thêm inline edit input cho `type`, `category`, `note`, `amount`, `occurredAt`.
  - Bổ sung cột `actions` với nút Sửa/Xóa/Lưu/Hủy.
- **[MODIFY] [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)**:
  - Tích hợp `useUpdateTransactionMutation`, `useDeleteTransactionMutation`, `useUpdateDebtMutation`, `useCreateDebtPaymentMutation`, `useContactsQuery`.
  - Thêm inline edit vào 2 bảng `analytics-transactions` và `analytics-debts`.
  - Thêm datalist autocomplete cho liên hệ, cột `actions` và toast notification.

---

## 3. Kế hoạch kiểm thử & Đảm bảo chất lượng (Verification Plan)

### Automated Verification

1. `npm run typecheck` - Đảm bảo Zero-Any và tính toàn vẹn kiểu dữ liệu.
2. `npm run lint` - Kiểm tra linter toàn bộ monorepo.
3. `npm run build` - Build Next.js Web và NestJS API.
4. `npm run agent-system:validate` - Kiểm tra tính toàn vẹn Agent System.

### Manual Verification

- Mở trang `/transactions`:
  1. Nhấp đúp vào dòng giao dịch bất kỳ: Chuyển sang chế độ inline edit.
  2. Sửa danh mục, số tiền, loại giao dịch (Thu <-> Chi) -> Nhấn `Enter` -> Kiểm tra lưu và cập nhật tổng thu chi trên KPI strip.
  3. Bấm nút Xóa (🗑) -> Xác nhận -> Kiểm tra giao dịch bị xóa khỏi danh sách.
- Mở trang `/analytics`:
  1. Nhấp đúp vào dòng trong bảng Giao dịch -> Sửa thông tin -> Lưu thành công.
  2. Nhấp đúp vào dòng trong bảng Công nợ -> Sửa người liên quan / hạn chót / số tiền -> Lưu thành công.

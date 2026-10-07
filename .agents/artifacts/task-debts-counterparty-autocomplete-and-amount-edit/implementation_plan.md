# Kế hoạch triển khai: Nâng cấp Inline Edit cho trang Vay & Cho vay (`/debts`)

Tài liệu này mô tả chi tiết phương án nâng cấp tính năng **Inline Editing** trên trang **Vay & Cho vay (`/debts`)**:

1. Cho phép chỉnh sửa cột **Người liên quan (`counterparty`)** với cơ chế **Autocomplete** danh bạ liên hệ (`contacts`).
2. Cho phép chỉnh sửa trực tiếp số tiền **Ban đầu (`originalAmount`)** và số tiền **Còn lại (`remainingAmount`)**.
3. Cập nhật backend `FinanceService` và `FinanceController` để hỗ trợ nhận và cập nhật các trường `counterparty`, `contactId`, `counterpartyAlias`, `originalAmount`, `remainingAmount`.

---

## 1. Mục tiêu & Yêu cầu chi tiết

### 1.1. Cột Người liên quan (`counterparty`)

- Khi nhấp đúp hoặc bấm Sửa, ô `counterparty` chuyển sang input hỗ trợ **Autocomplete** danh sách liên hệ từ `useContactsQuery()`.
- Danh sách gợi ý hiển thị Tên liên hệ (`displayName`) kèm Biệt danh (`alias`).
- Khi người dùng chọn một liên hệ từ danh sách hoặc nhập tên, hệ thống tự động liên kết `contactId` và cập nhật `counterpartyAlias`.
- Người dùng vẫn có thể tự do nhập tên bất kỳ nếu người đó chưa có trong danh bạ.

### 1.2. Cột Ban đầu (`originalAmount`) & Còn lại (`remainingAmount`)

- Cho phép nhấp đúp hoặc bấm Sửa để chỉnh sửa trực tiếp:
  - **Ban đầu (`originalAmount`)**: Input kiểu number, căn phải, định dạng số tiền rõ ràng.
  - **Còn lại (`remainingAmount`)**: Input kiểu number, căn phải, tự động cập nhật trạng thái khoản nợ (`active` hoặc `settled` khi số dư về 0).
- Hỗ trợ phím tắt `Enter` để lưu thay đổi và `Escape` để hủy bỏ.

---

## 2. Chi tiết các thay đổi theo từng lớp

### 2.1. Shared Contracts (`packages/contracts`)

- **[MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Cập nhật interface `IUpdateDebtRequest`:
    ```typescript
    export interface IUpdateDebtRequest {
      direction?: 'receivable' | 'payable';
      counterparty?: string;
      counterpartyAlias?: string;
      contactId?: string;
      originalAmount?: number;
      remainingAmount?: number;
      amount?: number;
      currency?: string;
      note?: string;
      dueAt?: string;
    }
    ```
  - Bổ sung translation keys cho placeholder (`vi` và `en`):
    - `debts.placeholder.counterparty`: 'Nhập hoặc chọn người liên quan...' / 'Enter or select person...'
    - `debts.placeholder.originalAmount`: 'Số tiền ban đầu...' / 'Original amount...'
    - `debts.placeholder.remainingAmount`: 'Số tiền còn lại...' / 'Remaining amount...'

---

### 2.2. Backend API (`apps/api`)

- **[MODIFY] [`apps/api/src/finance/finance.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)**:
  - Cập nhật `UpdateDebtDto` và phương thức `updateDebt(userId, id, input)`:
    - Cập nhật `counterparty`, `counterpartyAlias`, `contactId`. Nếu `counterparty` thay đổi nhưng chưa có `contactId`, tự động tìm kiếm contact tương ứng theo `displayName`/`alias`.
    - Cập nhật `originalAmount` và `remainingAmount`. Tự động cập nhật `status = 'settled'` và `settledAt = new Date()` khi `remainingAmount === 0`.
- **[MODIFY] [`apps/api/src/finance/finance.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)**:
  - Cập nhật handler `@Patch('debts/:id')` để parse các trường `counterparty`, `counterpartyAlias`, `contactId`, `originalAmount`, `remainingAmount`.

---

### 2.3. Web Frontend (`apps/web`)

- **[MODIFY] [`apps/web/src/modules/debts/view/debts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)**:
  - Nhập `useContactsQuery` từ `@/modules/contacts/api/contacts-query` để lấy danh sách liên hệ phục vụ autocomplete.
  - Cập nhật `editDraft` bao gồm:
    ```typescript
    {
      direction: 'receivable' | 'payable';
      counterparty: string;
      counterpartyAlias: string;
      contactId: string;
      originalAmount: string;
      remainingAmount: string;
      note: string;
      dueAt: string;
    }
    ```
  - Tích hợp HTML `<datalist id="debt-contacts-autocomplete">` liên kết với input `counterparty` để hiển thị danh sách gợi ý mượt mà.
  - Thêm inline edit input cho cột `counterparty`, `originalAmount`, và `remainingAmount`.
  - Giữ nguyên các thao tác double-click, phím Enter/Escape, Toast notification.

---

## 3. Kế hoạch kiểm thử & Đảm bảo chất lượng (Verification Plan)

### Automated Verification

1. `npm run typecheck` - Đảm bảo Zero-Any và tính toàn vẹn kiểu dữ liệu.
2. `npm run lint` - Kiểm tra linter toàn bộ monorepo.
3. `npm run build` - Build Next.js Web và NestJS API.
4. `npm run agent-system:validate` - Kiểm tra tính toàn vẹn Agent System.

### Manual Verification

- Mở trang `/debts`:
  1. Nhấp đúp chuột vào cột **Người liên quan**: Hiển thị input gõ gợi ý autocomplete danh bạ -> Chọn một người từ danh sách -> Lưu -> Kiểm tra hiển thị tên và alias.
  2. Nhấp đúp chuột vào cột **Ban đầu**: Sửa số tiền (VD: 5,000,000 -> 6,000,000) -> Nhấn `Enter` -> Kiểm tra lưu và cập nhật tổng tiền KPI.
  3. Nhấp đúp chuột vào cột **Còn lại**: Sửa số tiền còn lại (VD: về 0) -> Nhấn `Enter` -> Kiểm tra cập nhật trạng thái và số dư.
  4. Nhấn `Escape` khi đang sửa -> Kiểm tra hủy bỏ thay đổi và quay lại giá trị cũ.

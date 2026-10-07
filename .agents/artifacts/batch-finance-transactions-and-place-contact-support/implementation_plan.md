# Kế Hoạch Triển Khai Tính Năng Ghi Thu–Chi Hàng Loạt & Tự Động Bóc Tách Địa Điểm Quán Ăn

Tài liệu này mô tả chi tiết phương án triển khai công cụ ghi thu–chi hàng loạt (`create_finance_transactions`), mở rộng khả năng tự động nhận diện và liên kết địa điểm / quán ăn (`placeName` / `contactId`), nâng cấp System Prompt của Gemini và đồng bộ giao diện hiển thị trên zalo.

## User Review Required

> [!IMPORTANT]
> **Hỗ trợ 2 kịch bản cùng lúc**:
>
> 1. **Ghi nhiều khoản cùng lúc (Batch Transactions)**: Khi người dùng nhắn câu có từ 2 khoản chi/thu trở lên (VD: _"1 ly cà phê 35k và 1 ly nước cam 40k"_), bot sẽ tạo đồng thời 2 bản ghi riêng biệt, tính tổng tiền và hiển thị thẻ xác nhận/thông báo gộp.
> 2. **Tự động bóc tách & liên kết Quán ăn / Địa điểm**: Khi người dùng nêu tên quán (VD: _"Ăn tối quán chay Vườn Lài 47k"_), bot sẽ tự động tách `placeName: "Quán chay Vườn Lài"`, tìm hoặc tạo Contact trong `debt_contacts` và gán `contactId` vào giao dịch.

## Proposed Changes

---

### 1. Gemini Tools & Service (`apps/api/src/gemini`)

#### [NEW] [create-finance-transactions.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-finance-transactions.tool.ts)

- Tạo mới công cụ `CreateFinanceTransactionsTool` với tên `create_finance_transactions`.
- Khai báo tham số mảng `transactions`:
  - `type`: `'income' | 'expense'`
  - `amount`: number
  - `category`: string (tự động gợi ý danh mục, vd Ăn uống, Đi lại...)
  - `note`: string (nội dung từng món/khoản chi)
  - `placeName`: string nullable (tên quán ăn / địa điểm nếu có)
  - `occurredAt`: string ISO 8601
- Tự động liên kết hoặc tạo mới `DebtContactEntity` khi có `placeName`.
- Thực thi lưu đồng thời các bản ghi giao dịch qua `FinanceService`.

#### [MODIFY] [create-finance-transaction.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-finance-transaction.tool.ts)

- Bổ sung trường `placeName` vào `FunctionDeclaration` và interface tham số.
- Tự động tìm kiếm hoặc tạo contact trong `debt_contacts` khi người dùng nêu địa điểm/quán ăn, sau đó gán `contactId` vào `FinanceTransactionEntity`.

#### [MODIFY] [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)

- Cập nhật hướng dẫn trong System Prompt:
  - Khi người dùng nêu từ hai khoản thu/chi trở lên trong một tin nhắn ➔ **BẮT BUỘC** gọi `create_finance_transactions` với mảng các phần tử riêng biệt.
  - Hướng dẫn AI bóc tách riêng `placeName` (quán ăn, địa điểm, cửa hàng) ra khỏi `note`.

#### [MODIFY] [gemini.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)

- Đăng ký `CreateFinanceTransactionsTool` vào `toolsMap`.
- Thêm `create_finance_transactions` vào `confirmationRequiredTools`.
- Bổ sung logic gán `occurredAt` mặc định cho các phần tử trong mảng nếu thiếu.

#### [MODIFY] [gemini.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.module.ts)

- Khai báo và provider `CreateFinanceTransactionsTool`.

---

### 2. zalo UI & Confirmation Formatting (`apps/api/src/zalo`)

#### [MODIFY] [zalo-ui.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)

- Định dạng thẻ xác nhận hàng loạt `formatConfirmationBox` cho `create_finance_transactions`:
  - Hiển thị danh sách từng món có đánh số thứ tự kèm số tiền và danh mục.
  - Hiển thị tổng số tiền của toàn bộ danh sách.
  - Hiển thị địa điểm quán ăn nếu có.
- Định dạng kết quả sau khi ghi sổ `formatActionExecutionResult`:
  - Hiển thị thông báo gộp: _"✅ Đã ghi sổ N khoản chi (Tổng X đ) · Món 1 (A đ) · Món 2 (B đ)"_.

---

## Verification Plan

### Automated Tests & Quality Gates

- Chạy kiểm tra kiểu dữ liệu toàn bộ monorepo:
  ```bash
  npm run typecheck
  ```
- Chạy kiểm tra linter:
  ```bash
  npm run lint:check
  ```
- Viết unit test mới cho `create-finance-transactions.tool.spec.ts` và kiểm tra `zalo-ui.service.spec.ts`:
  ```bash
  npm run test --workspace=@zalobot/api
  ```
- Kiểm tra tính toàn vẹn của hệ thống agent:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Mô phỏng input tin nhắn: _"Hôm qua đi uống cà phê 1 ly cà phê 35k và 1 ly nước cam 40k"_ ➔ Kiểm tra tạo đúng 2 transactions với tổng 75.000đ.
- Mô phỏng input tin nhắn: _"Ăn tối quán chay vườn lài hết 47k"_ ➔ Kiểm tra tạo contact "Quán chay vườn lài" và lưu transaction liên kết contact này.

# Walkthrough: Bổ sung tính năng tạo người liên quan độc lập (create_debt_contact)

Chúng tôi đã hoàn thành việc nâng cấp trợ lý AI Gemini trên zalo, cho phép tạo và lưu thông tin người liên quan độc lập vào danh bạ công nợ mà không bắt buộc phải phát sinh khoản nợ kèm theo.

---

## 1. Các thay đổi đã thực hiện

### 1.1. Công cụ mới `CreateDebtContactTool`

- File: [`create-debt-contact.tool.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-debt-contact.tool.ts)
- Hỗ trợ các trường thông tin: `name` (bắt buộc), `alias`, `descriptor` (địa chỉ/mô tả nhận diện), `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`.
- Tự động gọi `FinanceService.createContact(...)` để lưu vào bảng `debt_contacts` của người dùng.
- File kiểm thử: [`create-debt-contact.tool.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-debt-contact.tool.spec.ts) (3 test cases passed).

### 1.2. Đăng ký Tool & Cơ chế Xác nhận (Confirmation)

- File: [`gemini.module.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.module.ts): Đăng ký `CreateDebtContactTool` vào providers và exports.
- File: [`gemini.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts): Inject tool vào constructor, đưa vào `toolsMap` và bổ sung `'create_debt_contact'` vào danh sách `confirmationRequiredTools`.

### 1.3. Giao diện Thẻ Xác nhận zalo UI

- File: [`zalo-ui.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts):
  - `formatImpactExplanation`: Giải thích rõ tác động lưu người liên quan vào danh bạ khi Xác nhận / giữ nguyên khi Hủy bỏ.
  - `formatConfirmationBox`: Render thẻ `⚠️ XÁC NHẬN TẠO NGƯỜI LIÊN QUAN` kèm Tên, Biệt danh, Mô tả/Địa chỉ, Số điện thoại.
  - `formatResultBox`: Render `✅ Đã tạo người liên quan · 👤 <Tên> (<Biệt danh>)`.
  - `formatOriginalSummary`: Hiển thị tóm tắt thông tin đã gửi ban đầu.
- File kiểm thử: [`zalo-ui.service.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts) (test case passed).

### 1.4. Chỉ dẫn Prompt Trợ lý AI (System Prompt)

- File: [`gemini-prompt.helper.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts):
  - Quy định rõ ràng: Khi người dùng chỉ muốn tạo người liên quan độc lập (không kèm số tiền), AI thực hiện 2 bước:
    1. Gọi `resolve_debt_contact` để tra cứu danh bạ.
    2. Nếu chưa có (`count === 0`), gọi `create_debt_contact`.
  - **Chống Deflect / Không ép nợ**: Tuyệt đối không hỏi người dùng muốn vay/mượn bao nhiêu tiền khi họ chỉ muốn tạo người liên quan.
  - **Tôn trọng tên gốc**: Khi người dùng yêu cầu giữ nguyên tên không tách biệt danh (ví dụ _"tên là Đức CMC chứ k tách ra"_), AI sẽ đặt `name: "Đức CMC"` và không tách `alias`.

### 1.5. Đồng bộ Tài liệu Tri thức

- [Canonical Knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)
- [Developer Docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)

---

## 2. Kết quả Kiểm thử & Quality Gates

| Kiểm thử                  | Kết quả   | Chi tiết                                                |
| :------------------------ | :-------- | :------------------------------------------------------ |
| **Tool Spec Tests**       | ✅ Passed | 3/3 tests trong `create-debt-contact.tool.spec.ts`      |
| **zalo UI Spec Tests**    | ✅ Passed | 28/28 tests trong `zalo-ui.service.spec.ts`             |
| **Backend Test Suite**    | ✅ Passed | 83/83 tests passed trong `@zalobot/api`                 |
| **TypeScript Typecheck**  | ✅ Passed | 0 lỗi trên toàn bộ Monorepo (`api`, `web`, `contracts`) |
| **ESLint Check**          | ✅ Passed | 0 vi phạm linter                                        |
| **Agent System Validate** | ✅ Passed | 91 artifacts, 157 dependencies, 0 cyclic groups         |

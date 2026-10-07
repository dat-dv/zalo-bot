# Walkthrough: Khắc phục lỗi đa Tool Call song song (Coalesce Parallel Tool Calls)

Chúng tôi đã khắc phục triệt để hiện tượng chỉ hiển thị JSON của khoản đầu tiên (ví dụ: ăn sáng 30k) và nuốt mất các khoản tiếp theo (ăn trưa 50k, ăn tối 70k) khi người dùng gửi một tin nhắn chứa nhiều khoản phát sinh liên tiếp.

---

## 1. Nguyên nhân gốc rễ và Cách khắc phục

### 1.1. Nguyên nhân

- Khi người dùng gửi câu: _"Hôm nay đi ăn sáng hết 30k , sau đó đi ăn trưa hết 50k và đi ăn tối hết 70k"_, cơ chế Parallel Tool Calling của mô hình Gemini phát ra 3 tool call `create_finance_transaction` riêng lẻ song song trong cùng 1 lượt trả về:
  - `Call 1`: `create_finance_transaction(Ăn sáng, 30000)`
  - `Call 2`: `create_finance_transaction(Ăn trưa, 50000)`
  - `Call 3`: `create_finance_transaction(Ăn tối, 70000)`
- Trước đây, vòng lặp tại `gemini.service.ts` chỉ lấy `call = functionCalls[0]`. Do `create_finance_transaction` là thao tác cần người dùng xác nhận (`confirmationRequiredTools`), code lập tức tạo `pendingAction` cho `functionCalls[0]` rồi **`return` ngay lập tức**.
- Hệ quả: Các tool call phía sau (`functionCalls[1]`, `functionCalls[2]`) bị bỏ rơi hoàn toàn.

### 1.2. Cách khắc phục (Cơ chế 2 lớp - Defense in Depth)

1. **Backend Auto-Coalescing ([gemini.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts))**:
   - Bổ sung hàm `coalesceFunctionCalls`: Khi Gemini phát ra từ 2 tool call `create_finance_transaction` trở lên, Backend tự động gom toàn bộ các giao dịch thành 1 mảng `transactions` và chuyển thành **1 tool call duy nhất `create_finance_transactions`**.
   - Tương tự, khi có từ 2 tool call `create_task` trở lên, Backend tự động gom thành **1 tool call duy nhất `create_tasks`**.
   - Mọi thuộc tính của từng khoản (`note`, `amount`, `category`, `occurredAt`, `placeName`, v.v.) được bảo toàn 100%.
   - zalo UI sẽ hiển thị đầy đủ danh sách cả 3 khoản (Ăn sáng, Ăn trưa, Ăn tối), tổng tiền 150.000đ, và khối JSON payload chứa toàn bộ mảng `transactions`. Khi bấm "Xác nhận", hệ thống ghi sổ đồng loạt cả 3 khoản vào CSDL.
2. **System Prompt Enforcement ([gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts))**:
   - Bổ sung quy định nghiêm cấm Gemini phát nhiều tool call riêng lẻ song song; bắt buộc chỉ gọi 1 lần duy nhất `create_finance_transactions` (cho thu chi hàng loạt) hoặc `create_tasks` (cho nhiều công việc).
3. **Unit Tests ([gemini.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.spec.ts))**:
   - Bổ sung bộ kiểm thử tự động kiểm chứng việc gộp 3 `create_finance_transaction` thành `create_finance_transactions`, gộp nhiều `create_task` thành `create_tasks`, và giữ nguyên tool call đơn lẻ.
4. **Đồng bộ Tài liệu Tri thức**:
   - [Canonical Knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)
   - [Developer Docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)

---

## 2. Kết quả Kiểm thử & Quality Gates

| Kiểm thử                                                         | Kết quả   | Chi tiết                                                              |
| :--------------------------------------------------------------- | :-------- | :-------------------------------------------------------------------- |
| **Backend Unit Tests** (`npm run test --workspace @zalobot/api`) | ✅ Passed | 86/86 tests passed (bao gồm các test mới cho `coalesceFunctionCalls`) |
| **TypeScript Typecheck** (`npm run typecheck`)                   | ✅ Passed | 0 lỗi trên toàn bộ Monorepo (`api`, `web`, `contracts`)               |
| **ESLint Check** (`npm run lint`)                                | ✅ Passed | 0 vi phạm linter                                                      |
| **Agent System Validate** (`npm run agent-system:validate`)      | ✅ Passed | 91 artifacts, 157 dependencies, 0 cyclic groups                       |

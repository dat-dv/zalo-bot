# Kế hoạch xử lý song song nhiều Tool Call (Coalesce Parallel Tool Calls)

## Hiện trạng & Nguyên nhân gốc rễ

Khi người dùng nhắn tin chứa nhiều khoản phát sinh liên tiếp trong một câu (ví dụ: _"Hôm nay đi ăn sáng hết 30k , sau đó đi ăn trưa hết 50k và đi ăn tối hết 70k"_):

1. **Gemini Parallel Function Calling**: Mô hình AI Gemini phát ra 3 tool call `create_finance_transaction` riêng lẻ song song trong cùng một turn trả về:
   - `Call 1`: `create_finance_transaction(note: "Ăn sáng", amount: 30000, ...)`
   - `Call 2`: `create_finance_transaction(note: "Ăn trưa", amount: 50000, ...)`
   - `Call 3`: `create_finance_transaction(note: "Ăn tối", amount: 70000, ...)`
2. **Lỗi vòng lặp tại Backend (`gemini.service.ts` dòng 446-475)**:
   - Code hiện tại duyệt `while (functionCalls && functionCalls.length > 0)` và chỉ lấy `call = functionCalls[0]`.
   - Do `create_finance_transaction` nằm trong `confirmationRequiredTools`, hệ thống lập tức lưu `pendingAction` cho `functionCalls[0]` và **`return` ngay lập tức**!
   - Kết quả: Các tool call phía sau (`functionCalls[1]` ăn trưa 50k, `functionCalls[2]` ăn tối 70k) bị **bỏ rơi hoàn toàn** (dropped). Người dùng chỉ thấy thẻ xác nhận và JSON của đúng 1 khoản ăn sáng 30k. Tương tự, nếu người dùng nêu nhiều công việc mà Gemini gọi nhiều `create_task` song song thì các việc sau cũng bị bỏ sót.

---

## User Review Required

> [!IMPORTANT]
> Giải pháp áp dụng cơ chế bảo vệ 2 lớp (Defense in Depth):
>
> 1. **Backend Auto-Coalescing (`gemini.service.ts`)**: Tự động phát hiện khi Gemini phát ra nhiều tool call đơn lẻ cùng loại (`create_finance_transaction` hoặc `create_task`) và tự động gộp (coalesce) chúng thành 1 tool call hàng loạt duy nhất (`create_finance_transactions` hoặc `create_tasks`) trước khi đưa vào hàng đợi xác nhận.
> 2. **System Prompt Enforcement (`gemini-prompt.helper.ts`)**: Nhấn mạnh nghiêm cấm Gemini gọi nhiều tool call đơn lẻ song song; khi có từ 2 khoản thu–chi hoặc 2 công việc trở lên, bắt buộc gọi duy nhất 1 lần tool hàng loạt.

---

## Proposed Changes

### 1. Backend Gemini Service (`apps/api/src/gemini/`)

#### [MODIFY] [gemini.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)

- Bổ sung hàm helper `coalesceFunctionCalls(functionCalls: FunctionCall[] | undefined): FunctionCall[] | undefined`:
  - Nếu có từ 2 lệnh `create_finance_transaction` (hoặc kết hợp `create_finance_transactions`), gom tất cả các khoản vào một mảng `transactions` duy nhất và chuyển thành 1 tool call `create_finance_transactions`.
  - Nếu có từ 2 lệnh `create_task` (hoặc kết hợp `create_tasks`), gom tất cả các task vào một mảng `tasks` duy nhất và chuyển thành 1 tool call `create_tasks`.
  - Giữ nguyên các tool call độc lập khác.
- Áp dụng `this.coalesceFunctionCalls(...)` ngay khi nhận `functionCalls` từ `response.response.functionCalls()`.

#### [MODIFY] [gemini.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.spec.ts)

- Viết bộ unit tests kiểm chứng cơ chế `coalesceFunctionCalls`:
  - Gộp 3 lệnh `create_finance_transaction` (sáng 30k, trưa 50k, tối 70k) thành 1 `create_finance_transactions` với đầy đủ 3 giao dịch.
  - Gộp hỗn hợp `create_finance_transaction` và `create_finance_transactions`.
  - Gộp nhiều lệnh `create_task` thành 1 `create_tasks`.
  - Giữ nguyên khi chỉ có 1 tool call đơn lẻ.

---

### 2. System Prompt Helper (`apps/api/src/gemini/helpers/`)

#### [MODIFY] [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)

- Bổ sung quy định nghiêm cấm:
  - _"CẤM GỌI NHIỀU LẦN create_finance_transaction SONG SONG: Khi người dùng nêu từ 2 khoản thu/chi trở lên trong một tin nhắn (ví dụ: 'sáng ăn sáng 30k, trưa ăn 50k, tối ăn 70k'), BẮT BUỘC chỉ gọi DUY NHẤT 1 LẦN công cụ `create_finance_transactions` với mảng `transactions` đầy đủ. Tuyệt đối không phát nhiều tool call riêng lẻ."_
  - _"CẤM GỌI NHIỀU LẦN create_task SONG SONG: Khi có từ 2 việc trở lên, BẮT BUỘC chỉ gọi DUY NHẤT 1 LẦN công cụ `create_tasks`."_

---

### 3. Đồng bộ Tài liệu Kỹ thuật (`.agents/`)

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)

- Ghi nhận cơ chế Backend auto-coalescing gộp parallel tool calls thành batch tool calls.

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)

- Cập nhật tài liệu kỹ thuật tiếng Việt về việc xử lý song song đa tool call và gom nhóm giao dịch hàng loạt.

---

## Verification Plan

### Automated Tests

- Chạy unit tests mới cho `coalesceFunctionCalls`: `npx tsx --test apps/api/src/gemini/gemini.service.spec.ts`
- Chạy toàn bộ test suite API: `npm run test --workspace @zalobot/api`
- Chạy typecheck: `npm run typecheck`
- Chạy lint: `npm run lint`
- Chạy validate agent system: `npm run agent-system:validate`

### Manual Verification Flow

- Giả lập prompt: `"Hôm nay đi ăn sáng hết 30k , sau đó đi ăn trưa hết 50k và đi ăn tối hết 70k"`:
  - Verify payload xác nhận nhận được là `create_finance_transactions` với mảng 3 phần tử.
  - Verify thẻ xác nhận zalo hiển thị đầy đủ 3 dòng cho sáng, trưa, tối cùng tổng tiền 150.000đ.
  - Verify khối JSON preview hiển thị toàn bộ mảng `transactions`.

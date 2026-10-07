# Kế hoạch triển khai Short-term Conversation History & Cập nhật giao dịch đa lượt

## 1. Mục tiêu & Trả lời câu hỏi: "Sẽ lưu vào đâu?"

### 1.1. Vị trí lưu trữ: In-Memory Sliding Buffer with TTL (Bộ nhớ đệm Ram có thời hạn)

Để xử lý ngữ cảnh ngắn hạn ("Short-term"), phương án tối ưu và an toàn nhất là lưu trong **In-Memory Cache (Service Memory Buffer)** theo từng `userId`:

- **Cấu trúc lưu trữ**: `Map<number, UserConversationSession>` được quản lý độc lập bởi `ConversationHistoryService`.
- **Cửa sổ trượt (Sliding Window)**: Giới hạn lưu tối đa **6 – 8 lượt tin nhắn gần nhất** (`role: 'user'` và `role: 'model'`) để giữ prompt Gemini gọn gàng, tránh tốn token API và tránh quá tải context.
- **Thời hạn tự hủy (TTL)**: **10 phút** kể từ tin nhắn cuối cùng. Nếu sau 10 phút người dùng không nhắn tiếp, session sẽ tự động xóa sạch để phiên trò chuyện tiếp theo không bị "lẫn lộn" ngữ cảnh cũ từ quá khứ.
- **Tại sao không lưu vào Database/Redis?**
  - **Tốc độ (0ms)**: Không tốn chi phí I/O đọc/ghi SQLite cho từng tin nhắn chat.
  - **Bản chất ngắn hạn**: Đúng nghĩa "Short-term context" (chỉ cần trong vài giây đến vài phút khi người dùng đang nhắn dở câu). Sau 10 phút, bất kỳ hành động mới nào cũng nên bắt đầu phiên mới độc lập.
  - **Nhẹ nhàng, không phát sinh dependencies**: Không cần thêm Redis hay migration schema DB.

---

## 2. Các thay đổi đề xuất

### A. Quản lý Lịch sử hội thoại (`apps/api/src/gemini`)

#### [NEW] [conversation-history.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/services/conversation-history.service.ts)

- Định nghĩa `ConversationHistoryService` trong NestJS:
  - `getHistory(userId: number): Content[]`: Trả về mảng `Content[]` định dạng chuẩn của Google Generative AI SDK (`{ role: 'user' | 'model', parts: [{ text }] }`).
  - `appendUserMessage(userId: number, text: string)`: Ghi nhận tin nhắn người dùng.
  - `appendModelMessage(userId: number, text: string)`: Ghi nhận câu trả lời của Bot.
  - `clear(userId: number)`: Xóa lịch sử khi cần hoặc sau TTL 10 phút.
  - Bộ hẹn giờ dọn dẹp (Cleanup routine) loại bỏ các session không hoạt động quá 10 phút.

#### [NEW] [update-finance-transaction.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/update-finance-transaction.tool.ts)

- Khai báo tool `update_finance_transaction` cho Gemini:
  - Tham số: `transactionId?: string` (nếu không truyền sẽ tự động tìm giao dịch gần nhất vừa tạo trong ngày của `userId`), `occurredAt?: string` (ISO format), `amount?: number`, `category?: string`, `note?: string`.
  - Thực thi cập nhật qua `financeService.updateTransaction(...)` và trả về kết quả định dạng thẻ xác nhận.

#### [MODIFY] [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)

- Bổ sung quy tắc nhận diện ngữ cảnh liên tiếp (Contextual Follow-ups):
  - Hướng dẫn AI: Khi người dùng gửi câu ngắn điều chỉnh mốc thời gian, số tiền, danh mục sau khi vừa tạo giao dịch (ví dụ: _"Mua lúc 9h sáng"_, _"Đổi thành 30k"_, _"Sửa thành ăn vặt"_...), AI PHẢI dùng tool `update_finance_transaction` để cập nhật giao dịch gần nhất thay vì hỏi lại như một lệnh mới.

#### [MODIFY] [gemini.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)

- Đăng ký `UpdateFinanceTransactionTool` vào danh sách công cụ và `confirmationRequiredTools`.
- Inject `ConversationHistoryService` để ghi nhận các lượt tương tác.

#### [MODIFY] [gemini.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.module.ts)

- Cung cấp `ConversationHistoryService` và `UpdateFinanceTransactionTool`.

### B. zalo Module (`apps/api/src/zalo`)

#### [MODIFY] [zalo.update.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.ts)

- Thay thế việc truyền mảng rỗng `[]` thành `this.historyService.getHistory(userId)` khi gọi `this.geminiService.chat(text, history, userId, botUsername)`.
- Ghi nhận `text` vào history trước khi chat và ghi nhận phản hồi của bot sau khi chat hoàn tất.

---

## 3. Kế hoạch xác minh (Verification Plan)

### Automated Tests

- Tạo unit test `conversation-history.service.spec.ts` kiểm tra:
  - Giới hạn sliding window tối đa 8 tin nhắn.
  - Tự động hết hạn (TTL) sau thời gian quy định.
- Chạy toàn bộ test suite:
  ```bash
  npm run test
  npm run typecheck
  npm run lint
  npm run agent-system:validate
  ```

### Manual Verification Flow

- Giả lập flow zalo qua test script / spec:
  1. Gửi: _"Sáng nay mua 2 bánh mì sandwich ăn sáng 20k"_ -> Ghi nhận giao dịch chi 20k.
  2. Gửi tiếp: _"Mua lúc 9h sáng"_ -> Bot tự động nhận diện giao dịch bánh mì vừa tạo và cập nhật lại mốc thời gian `occurredAt` về 09:00 sáng ngày hôm đó.

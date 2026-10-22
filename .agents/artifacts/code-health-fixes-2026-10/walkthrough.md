# Walkthrough: Sửa lỗi logic trí nhớ/LLM và dọn lint

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Chốt: A4 bỏ hẳn tool khi kênh tắt trí nhớ; script `lint` không còn `--fix`, dùng `lint:fix` khi muốn tự sửa.

## Phần A: lỗi logic (commit `03d1872`)

- **A1**: `ZcaService.undo` gọi `markRecalled` sau khi thu hồi thành công. Lý do: khi tắt self-listen, zca-js không gửi lại sự kiện thu hồi của chính tài khoản.
- **A2**: luồng ảnh truyền `messageId`.
- **A3**: tìm kiếm bỏ qua tin đang hỏi (`msg_id <> $n`) và không tính tin của bot là kết quả khớp (`NOT is_bot`).
- **A4**: thêm `textToolDefinitionsFor({ chatMemory })`. Kênh không bật trí nhớ thì LLM không được đưa `SEARCH_CHAT_HISTORY` và không có dòng hướng dẫn tương ứng trong system prompt.
- **A5**: ô số trong modal giữ chuỗi người dùng đang gõ (`memoryDraft`), chỉ chuẩn hoá khi blur và khi lưu.
- **A6**: lượt gọi LLM có tool trả `failed` thì báo lỗi một lần, bỏ lượt chit-chat.
- **A7**: thu hồi theo `cliMsgId` chỉ khớp khi cùng người gửi (`sender_uid`).
- **A8**: `RouterProvider` thiếu model thì trả `failed`.
- **A9**: ghi rõ trong docs rằng `LLM_TIMEOUT_MS` áp dụng cho cả Qwen chạy local.
- **Docs**: `chat-memory` và `llm-providers`, cả bản EN lẫn VI.

## Phần B: dọn lint

- **Helper mới** `apps/api/src/zca/chat-messenger.util.ts`: `ChatMessenger`, `sendChatText`, `sendChatTextWithResult`, `undoChatMessage`, kèm spec.
  - Thay cho đoạn dò `(x as any)` ở `TransactionConfirmationService`, 2 guard, `ImageBatchHandler` và 2 strategy ảnh chờ.
  - Bỏ nhánh `isLoggedIn`, vốn gọi `sendMessage(text, chatId)` với thứ tự tham số ngược.
- **`zca-bot-feature.service.ts`**:
  - Xoá import thừa.
  - `JSON.parse` gán vào biến kiểu `unknown`.
  - Thêm `readTextField` thay cho `String(unknown)`.
- **`text-input.service.ts`**: so sánh `toolCall.name` với `String(editTool)`.
- **Spec**: mock `async` không có `await` đổi thành `Promise.resolve`; bỏ kiểu `any` của `formatUploadSummary`; xoá import thừa; bỏ type assertion thừa.
- **Web**: xoá import thừa `SyncThreadMediaResponse`.
- **Script**: `lint` của api và contracts bỏ `--fix`.
  - Trước đây lỗi prettier ở `normalizeChatMemoryConfig` (contracts) bị `--fix` tự sửa ngầm mỗi lần chạy, nên lần này em sửa thẳng trong code.

## Kiểm tra đã chạy

- `npm run lint` (contracts, api, web; không `--fix`): exit 0, **0 lỗi, 0 cảnh báo**. Trước đó api có 61 lỗi + 10 cảnh báo, web có 1 lỗi.
- `npm run typecheck`: exit 0.
- Test API 448/448, web 36/36.
- Build api và web đều exit 0.
- `docs-drift-check`: Phần A PASS. Ở Phần B, check báo `zca-query.ts` thuộc module zca, nhưng đó chỉ là xoá import thừa, không đổi hành vi nên không cập nhật docs.

## Ghi chú

- Trong lúc làm, một session khác đã commit `6b2aa69` (env). Em chỉ commit theo danh sách file của mình.

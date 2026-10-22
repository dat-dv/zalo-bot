# Implementation Plan: Sửa lỗi logic trí nhớ/LLM và dọn lint

Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM** (nhiều file; không đổi schema, không đổi API công khai)

## 0. Hiện trạng (commit `2995361`, working tree sạch)

- Typecheck contracts/api/web: 0 lỗi.
- Test: api 438/438, web 36/36.
- Build: api và web đều chạy được.
- Lint (không `--fix`):
  - API: **61 lỗi + 10 cảnh báo**, đều có từ trước.
  - Web: **1 lỗi**.
- Rà soát logic 3 commit gần đây (`d66cc40`, `41bbef4`, `133273f`) tìm ra 6 lỗi xác nhận (Phần A).
  - Các phần kiểm chứng là ổn: SQL trên PG16, cách dùng TypeORM, payload undo, cách ly kênh, chuỗi fallback không gọi tool hai lần, khởi tạo form.

## Phần A: Lỗi logic (ưu tiên)

| # | Lỗi | Hậu quả | Sửa |
| --- | --- | --- | --- |
| A1 | Bot hoặc chủ tài khoản thu hồi tin, mà `ZCA_SELF_LISTEN=false`, thì `onUndo` không bao giờ chạy (zca-js bỏ sự kiện undo của chính mình) | Thẻ xác nhận đã thu hồi (có `yes <code>`) và tin chủ tài khoản đã gỡ vẫn nằm trong trí nhớ, hiện trong ngữ cảnh và kết quả tra | `ZcaService.undo` (`zca.service.ts` ~1794): sau khi `api.undo` thành công, gọi `chatMemoryService.markRecalled(threadId, msgId, cliMsgId)` |
| A2 | Luồng ảnh (quote ảnh, ảnh có caption) truyền `chatMemory` nhưng **thiếu `messageId`** | Câu "@bot lưu bill này" lọt vào khối "ngữ cảnh gần đây, KHÔNG gọi tool", nên LLM có thể không gọi `RECORD_TRANSACTION` | Thêm `messageId` vào 2 `AgentInput` của luồng ảnh (`zca-bot-feature.service.ts` ~1099, ~1159) |
| A3 | `SEARCH_CHAT_HISTORY` tìm ra **chính câu hỏi** và các câu trả lời cũ của bot | Mất suất kết quả; nhánh "không tìm thấy" gần như không bao giờ xảy ra; câu trả lời cũ (có thể sai) bị dùng lại làm bằng chứng | `search` nhận `excludeMsgId` (= `input.messageId`). Điều kiện tìm thêm `m.msg_id <> $n` và `NOT m.is_bot`. Tin của bot vẫn được lấy làm tin xung quanh |
| A4 | Tool `SEARCH_CHAT_HISTORY` luôn có trong catalog, kể cả kênh tắt trí nhớ và chat webhook | Câu hỏi kiểu "hôm trước nói gì" ở kênh tắt trí nhớ nhận câu báo "chưa bật" thay vì chit-chat như trước; kênh `allowAiChat=false` lẽ ra im lặng giờ lại trả lời | `TextInputService`: kênh không có `input.chatMemory` thì bỏ tool này khỏi danh sách gửi LLM và bỏ dòng hướng dẫn tương ứng trong system prompt |
| A5 | Ô số trong card trí nhớ bị kẹp giá trị **từng phím gõ** | Xoá ô số kết quả thành `1`, gõ "8" thành "18"; muốn nhập "25" phải bôi đen rồi gõ đè | Giữ chuỗi thô trong state riêng của 2 ô, chỉ chuẩn hoá khi blur và khi lưu (lúc lưu vốn đã chuẩn hoá) |
| A6 | Khi cả chuỗi LLM đều lỗi, `TextInputService` vẫn chạy lượt chit-chat thứ hai, lại đi hết chuỗi một lần nữa | Trường hợp xấu nhất phải chờ khoảng 2 × số provider × 30s trước khi báo lỗi | Lượt đầu trả `failed: true` thì bỏ lượt chit-chat, báo lỗi ngay (giữ câu báo lỗi hiện có) |

Kèm theo (rủi ro thấp, cùng chỗ sửa):
- **A7.** `markRecalled` hiện khớp `msg_id = X OR cli_msg_id = Y`, mà `cliMsgId` do client tự sinh, có thể trùng giữa các người gửi trong nhóm. Đổi thành: so `cli_msg_id` chỉ khi kèm `sender_uid` của người thu hồi (`undo.data.uidFrom`).
- **A8.** `RouterProvider` khi `ROUTER_MODEL` trống đang gửi ngầm `gpt-4o-mini` lên router. Đổi thành trả `failed` kèm log cảnh báo thiếu model.
- **A9.** Ghi vào docs rằng `LLM_TIMEOUT_MS` (mặc định 30s) áp dụng cho cả Qwen local. Model local chậm cần tăng giá trị này.

Không sửa ở lần này:
- **Khối ngữ cảnh có thể khiến LLM làm lại yêu cầu cũ:** chỉ có câu chặn trong prompt. Đã ghi trong docs; muốn chặn bằng code cần thiết kế riêng.
- **`public.unaccent` hard-code schema:** DB hiện dùng `postgres:16-alpine` (schema `public`). Chỉ ghi vào phần xử lý sự cố.
- **`TYPEORM_SYNCHRONIZE=true` sẽ xoá cột `search_vector`:** đã ghi trong knowledge; env đang để `false`.

## Phần B: Dọn lint (API 61 lỗi + 10 cảnh báo, web 1 lỗi)

### B1. Gửi tin qua "messenger" mà không dùng `any` (~45 lỗi, toàn bộ 10 cảnh báo `any`)

`TransactionConfirmationService`, `GrantAccessGuard`, `InitialAdminBootstrapGuard`, `ImageBatchHandler`, `CancelPendingImageStrategy` và `StorageUploadPendingImageStrategy` nhận lúc thì `ZcaService` (`sendMessageToChat(chatId, text)`), lúc thì `ZaloService` (`sendMessage(chatId, text)`), lúc thì mock trong test. Mỗi file tự dò bằng `(x as any).isLoggedIn` theo 3 nhánh. Nhánh `isLoggedIn` gọi `sendMessage(text, chatId)` với **thứ tự tham số ngược** các nhánh còn lại.

Cách sửa:
1. Tạo `apps/api/src/zca/chat-messenger.util.ts` gồm:
   - type guard `hasMethod(value, name)`, không dùng `any`
   - `sendChatText(messenger: unknown, chatId, text)`: ưu tiên `sendMessageToChat`, không có thì gọi `sendMessage(chatId, text)`
   - `sendChatTextWithResult(...)` và `undoChatMessage(...)` cho `TransactionConfirmationService`
2. Thay 6 chỗ dò thủ công bằng các hàm trên. Kiểu tham số constructor đổi từ union kèm `any` sang `ChatMessenger` (interface tối thiểu). Không đổi token DI.
3. **Bỏ nhánh `isLoggedIn`**: `ZcaService` thật luôn có `sendMessageToChat`, nên nhánh này chỉ chạy với mock. Mock trong test đều dùng `sendMessage(chatId, text)` (`whitelist-guards.spec.ts`, `transaction-confirmation.service.spec.ts`). Riêng mock của `pending-image.spec.ts` tự đoán thứ tự tham số nên vẫn chạy được.

### B2. Lỗi lẻ trong source

| File | Lỗi | Sửa |
| --- | --- | --- |
| `zca-bot-feature.service.ts:25` | import `GetGroupChatHistoryResponse` thừa | Xoá |
| `zca-bot-feature.service.ts:217` | `JSON.parse` trả `any` | `const parsed: unknown` |
| `zca-bot-feature.service.ts:1462-1494` | `String(msgData.x \|\| '')` với `unknown` (4 lỗi) | Thêm helper `readStringField(value: unknown): string` |
| `text-input.service.ts:344` | So `toolCall.name` (string) với enum | So với `String(editTool)` |
| `transaction-confirmation.service.ts:345` | `${err}` với `unknown` | Dùng `formatErrorMessage` |

### B3. Spec (19 lỗi)

- `require-await` (16 chỗ): mock `async () => x` không có `await`, đổi sang `() => Promise.resolve(x)`. Các file: `zca-bot-feature.service.spec.ts`, `zca.controller.spec.ts`, `zca.service.spec.ts`, `transaction-confirmation.service.spec.ts`.
- `no-unsafe-member-access .drive/.photos` (`zca-bot-feature.service.spec.ts` ~1313, ~1388): khai báo kiểu cho mock.
- `welcome-group-event.strategy.spec.ts:40`: bỏ type assertion thừa.

### B4. Web

`apps/web/src/modules/zca/api/zca-query.ts:25`: xoá import thừa `SyncThreadMediaResponse`.

## Kiểm thử

- **Test mới:**
  - A1: `ZcaService.undo` thành công thì gọi `markRecalled`.
  - A2: luồng ảnh truyền `messageId`.
  - A3: SQL tìm có `msg_id <> $n` và `NOT m.is_bot`; `search` truyền `excludeMsgId`.
  - A4: kênh không có `chatMemory` thì danh sách tool gửi LLM không có `SEARCH_CHAT_HISTORY`.
  - A6: lượt đầu `failed` thì LLM chỉ được gọi 1 lần.
  - A7: câu SQL thu hồi.
  - A8: `RouterProvider` không có model thì trả `failed`.
  - B1: test cho `sendChatText` / `sendChatTextWithResult` / `undoChatMessage`.
- **Chạy:**
  - typecheck contracts/api/web
  - `npm run test --workspace @zalobot/api` và `--workspace @zalobot/web`
  - **`npx eslint` không `--fix`** cho api và web, mục tiêu **0 lỗi, 0 cảnh báo**
  - build web
  - `node .claude/hooks/docs-drift-check.mjs`
- **Docs:**
  - `knowledge|docs/modules/zca/chat-memory.md`: A1, A3, A4, A7
  - `knowledge|docs/global/llm-providers.md`: A6, A8, A9
  - Phần B chỉ đổi code nội bộ, không đổi hành vi nghiệp vụ, nên không cần cập nhật docs.

## Câu hỏi cho anh

1. **A4:** kênh tắt trí nhớ thì **bỏ hẳn tool** khỏi danh sách gửi LLM (đề xuất). Hay giữ tool và trả câu hướng dẫn bật như hiện nay?
2. **Script `npm run lint` của api đang có `--fix`**, nên chạy kiểm tra là tự sửa file (lần trước đã sửa nhầm một spec). Có đổi `lint` thành không `--fix` và thêm `lint:fix` riêng không?

## Rollback

Mỗi phần là một commit riêng (A, rồi B), revert từng commit được. Không có migration.

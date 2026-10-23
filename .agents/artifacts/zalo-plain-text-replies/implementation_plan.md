# Kế hoạch: Bỏ markdown (`**`, `#`, `` ` ``...) khỏi tin nhắn bot gửi lên Zalo

- Route: `implement` · Phase 1 (Planning) · Authority: `inspect-and-plan`
- Rủi ro: TRUNG BÌNH (nhiều file, đổi nội dung mọi tin gửi ra Zalo; không đổi API, DB hay quyền)
- Skill: `backend`

## 1. Hiện trạng và nguyên nhân

- Trong code không có chuỗi template nào chứa `**`, `__`, `#` đầu dòng hay backtick. Template của bot dùng `•`, `- `, `👉`, emoji, đúng với quy ước "mọi phản hồi là văn bản thuần" trong `.agents/knowledge/global/zalo-response-layout.md`.
- `**` là do **LLM tự sinh** (Gemini, OpenAI, Qwen mặc định trả markdown). Không prompt nào nói với LLM rằng Zalo chỉ hiển thị văn bản thuần.
- Các chỗ chữ của LLM đi thẳng ra Zalo:
  - `TextInputService.process`: câu trả lời chit-chat (`generateChitChatReply`) và `response.text` của lượt đầu (`apps/api/src/zca/text/text-input.service.ts`).
  - `TextInputService.handleEditPendingAction`: khi LLM không gọi tool thì trả `response.text`.
  - `SearchChatHistoryToolStrategy`: câu trả lời tra cứu trí nhớ dài hạn (`apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts`).
  - `CreateBillPendingImageStrategy`: prompt đọc hoá đơn (`apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts`).
- Mọi tin gửi ra đều đi qua đúng một hàm: `ZcaService.sendMessage(message, threadId)` (`apps/api/src/zca/zca.service.ts:1733`). `ZcaMessengerService` (cả bản cắt đoạn 1900 ký tự lẫn bản có tag), `ZcaService.sendMessageToChat` và chỗ gọi trực tiếp trong `create-bill-pending-image.strategy.ts:65` đều gọi vào đây.

## 2. Giải pháp: 2 lớp

### Lớp 1 (chặn chắc chắn): làm sạch markdown ngay tại điểm gửi

Thêm hàm thuần `toZaloPlainText(text: string): string` trong file mới `apps/api/src/zca/text/zalo-plain-text.util.ts`, gọi trong `ZcaService.sendMessage` trước `this.api.sendMessage`:

- `message` là `string` → làm sạch.
- `message` là object `{ msg, ... }` **không có** `mentions` → làm sạch `msg`.
- Object **có** `mentions` → giữ nguyên. Lý do: vị trí tag (`pos`, `len`) trỏ vào đúng ký tự trong `msg`, bỏ ký tự sẽ làm lệch tag. Tin có tag hiện chỉ do bot tự dựng (nhắc việc, lời nhắc), không có markdown.

Quy tắc làm sạch (chạy theo thứ tự):

| # | Đầu vào | Đầu ra | Ghi chú |
| --- | --- | --- | --- |
| 1 | `[chữ](https://…)` | `chữ: https://…` (chữ trùng link thì chỉ còn link) | Zalo tự nhận link khi đứng riêng |
| 2 | Link `https?://…` | Giữ nguyên | Tách link ra trước khi xử lý, trả lại sau, để link Drive/Photos có `_` hay `*` không bị sửa |
| 3 | Dòng chỉ có ```` ``` ```` hoặc ```` ```ts ```` | Bỏ dòng, giữ nội dung bên trong | |
| 4 | `***x***`, `**x**`, `__x__` | `x` | Yêu cầu chính |
| 5 | `*x*` (in nghiêng, dính sát chữ) | `x` | `5*3`, `a * b` không bị đụng |
| 6 | `` `x` `` | `x` | |
| 7 | `# `, `## `… ở đầu dòng | Bỏ dấu `#` | |
| 8 | `* ` hoặc `+ ` ở đầu dòng | `• ` | Khớp kiểu gạch đầu dòng của bot. `- ` giữ nguyên |
| 9 | Dòng chỉ có `---`, `***`, `___` | Bỏ dòng | |
| 10 | `**` hoặc `__` lẻ còn sót | Bỏ | LLM đôi khi quên đóng. Tin dài bị cắt đoạn ở giữa `**x**` cũng sinh `**` lẻ |
| 11 | Từ 3 dòng trống liên tiếp trở lên | Gộp còn 1 dòng trống | Dọn chỗ trống sau khi bỏ dòng |

Không đụng tới: dấu `_` đơn (id dạng `user_id`), `•`, `👉`, `<nội dung sửa>`, ngoặc kép, emoji, số tiền.

Vì sao làm ở điểm gửi chứ không chỉ ở chỗ gọi LLM: một chỗ duy nhất phủ mọi đường ra (câu trả lời LLM, kết quả tool có chèn chữ của LLM, đường dẫn sau này thêm vào), và không phải nhớ gọi ở từng strategy.

### Lớp 2 (phòng ngừa): dặn LLM viết văn bản thuần

Export thêm hằng `ZALO_PLAIN_TEXT_INSTRUCTION` từ cùng file util, đại ý: "Zalo không hiển thị markdown. Chỉ viết văn bản thuần: không dùng `**`, `__`, `#`, backtick, bảng hay `[chữ](link)`; gạch đầu dòng dùng `•` hoặc `-`; muốn nhấn mạnh thì dùng emoji hoặc viết hoa." Nối vào system instruction ở:

- `text-input.service.ts`: prompt chính (`process`), prompt sửa (`handleEditPendingAction`), prompt chit-chat (`generateChitChatReply`).
- `search-chat-history-tool.strategy.ts`.
- `create-bill-pending-image.strategy.ts`.

Lớp này để câu trả lời đọc tự nhiên ngay từ đầu (LLM không chia mục bằng heading), còn lớp 1 là chốt chặn cuối khi LLM vẫn lỡ dùng markdown.

## 3. Danh sách file

| File | Thay đổi |
| --- | --- |
| `apps/api/src/zca/text/zalo-plain-text.util.ts` (mới) | `toZaloPlainText`, `ZALO_PLAIN_TEXT_INSTRUCTION` |
| `apps/api/src/zca/text/zalo-plain-text.util.spec.ts` (mới) | Test từng quy tắc ở bảng trên, test link Drive/Photos giữ nguyên, test template của bot (thẻ xác nhận mẫu) không đổi |
| `apps/api/src/zca/zca.service.ts` | `sendMessage` gọi `toZaloPlainText` theo 3 trường hợp ở lớp 1 |
| `apps/api/src/zca/zca.service.spec.ts` | Test `sendMessage`: chuỗi có `**` được làm sạch, `{ msg }` được làm sạch, `{ msg, mentions }` giữ nguyên |
| `apps/api/src/zca/text/text-input.service.ts` | Nối `ZALO_PLAIN_TEXT_INSTRUCTION` vào 3 system instruction |
| `apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts` | Nối instruction |
| `apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts` | Nối instruction |
| `.agents/knowledge/global/zalo-response-layout.md` | Mục Delivery: thêm quy tắc làm sạch markdown tại `ZcaService.sendMessage`, ngoại lệ tin có tag, instruction cho LLM; thêm util mới vào `depends_on` |
| `.agents/docs/global/zalo-response-layout.md` | Giải thích bằng tiếng Việt: vì sao Zalo hiện nguyên `**`, cách làm sạch 2 lớp, ngoại lệ tin có tag |

Không đổi: API, contracts, DB, dashboard web.

## 4. Kiểm tra

1. `npm run test --workspace @zalobot/api` (test mới của util và `zca.service`, cùng toàn bộ test hiện có để chắc template cũ không bị đổi).
2. `npm run typecheck --workspace @zalobot/api`
3. `npm run lint --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs`
5. Chưa kiểm được trên Zalo thật trong phiên này (cần ZCA đăng nhập). Sẽ ghi rõ trong báo cáo; anh thử bằng cách hỏi bot một câu tổng quát có liệt kê (ví dụ "gợi ý 3 món ăn sáng").

## 5. Giới hạn và rủi ro

- Tin cũ đã lưu trong trí nhớ hội thoại (bảng `zca_messages`) vẫn còn `**`. Không sửa dữ liệu cũ. Tin mới lưu từ bản bot nhận lại (echo) nên sẽ sạch.
- Tin có tag người dùng không được làm sạch (lý do ở lớp 1).
- Bảng markdown (`| a | b |`) không được chuyển đổi, chỉ còn dựa vào lớp 2 để LLM không sinh bảng.
- Phương án khác chưa chọn: đổi `**x**` thành chữ in đậm thật của Zalo (`zca-js` có tham số `styles`). Giữ được phần nhấn mạnh nhưng phải tính lại vị trí, và anh yêu cầu bỏ đi nên để làm sau nếu cần.

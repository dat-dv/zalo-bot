---
metadata:
  agent-artifact:
    id: docs-global-llm-providers
    type: documentation
    depends_on:
      - .agents/knowledge/global/llm-providers.md
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/zalo/text/text-tool.definitions.ts
---

# Nhà cung cấp LLM

Tài liệu này ánh xạ với tri thức canonical [`llm-providers.md`](../../knowledge/global/llm-providers.md).

## 1. Vì sao có lớp `LlmService`

Bot cần hiểu câu tiếng Việt tự do ("ăn trưa 45k", "mai 9h họp") và chuyển thành lệnh có cấu trúc (tool call). Để không bị khoá vào một nhà cung cấp, mọi lời gọi đi qua `LlmService.generate(prompt, tools, systemInstruction)` trong `apps/api/src/llm`. Đổi nhà cung cấp chỉ cần đổi biến môi trường `LLM_PROVIDER`, không sửa code.

Mỗi lời gọi là **một lượt độc lập**: provider không giữ lịch sử hội thoại. Lệnh `/reset` chỉ gửi thông báo, không có ngữ cảnh nào để xoá. Khi bật [trí nhớ hội thoại](../modules/zca/chat-memory.md), chính backend chèn vài tin gần nhất của kênh (lấy từ bảng `zca_messages`) vào prompt hệ thống; trí nhớ nằm ở DB của mình, không nằm ở LLM.

`generateMemoryAnswer` là lời gọi riêng (không tool) để viết câu trả lời cho tool `SEARCH_CHAT_HISTORY`. Nếu có `MEMORY_LLM_BASE_URL` thì gọi endpoint OpenAI-compatible đó (ví dụ 9router), không thì dùng provider chính. Nhờ vậy có thể để tool calling ở provider ổn định, còn phần viết câu trả lời dùng model rẻ hơn.

Nơi sử dụng: `TextInputService` (tin nhắn chat, chỉnh sửa thẻ chờ) và chiến lược tạo hoá đơn từ ảnh (`CreateBillPendingImageStrategy`, dùng chữ OCR).

## 2. Chọn nhà cung cấp

| `LLM_PROVIDER` | Provider | Biến môi trường | Mặc định |
| --- | --- | --- | --- |
| `gemini` (mặc định, và mọi giá trị lạ) | `GeminiProvider` | `GEMINI_API_KEY`, `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `openai` | `OpenAiProvider` | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | `gpt-4o-mini`, `https://api.openai.com/v1` |
| `qwen`, `ollama`, `qwen2.5:14b`, `qwen-14b` | `QwenProvider` | `QWEN_*` hoặc `OLLAMA_*` (`BASE_URL`, `MODEL`, `API_KEY`) | `http://localhost:11434`, `qwen2.5:14b` |

Qwen hỗ trợ hai kiểu máy chủ: URL kết thúc bằng `/v1` hoặc `/chat/completions` được gọi theo chuẩn OpenAI; còn lại gọi API gốc của Ollama `/api/chat`. Nếu model nhỏ trả tool call dạng thẻ `<tool_call>` trong văn bản, provider tự bóc tách.

**Không bao giờ ném lỗi ra ngoài:** khi thiếu API key, lỗi HTTP hay mất kết nối, provider trả về `{ text: "<thông báo tiếng Việt>" }` để bot vẫn trả lời người dùng. Với Ollama báo 404, bot nhắc chạy `ollama pull <model>`.

## 3. Làm sạch tham số

Model nhỏ hay trả tham số bị lồng (`{"amount": {"amount": 15000}}`). `cleanToolArguments` tự gỡ lớp bọc cho mọi tool call. `parseAmount` đổi "45k", "2tr", "15.000" thành số nguyên VND dương. `normalizeSchemaTypes` chuyển kiểu schema (`OBJECT` → `object`) cho OpenAI/Ollama.

## 4. Danh sách tool (`ZALO_TOOL_DEFINITIONS` — 15 tool)

| Tool | Mục đích |
| --- | --- |
| `MANAGE_DEBT` | Ghi khoản cho vay / đi vay |
| `RECORD_TRANSACTION` | Ghi khoản thu / chi |
| `DELETE_TRANSACTION` | Xoá giao dịch theo ID hoặc mô tả |
| `SET_REMINDER` | Đặt lời nhắc |
| `GET_REPORT` | Báo cáo chi tiêu (day/month/year) |
| `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT` | Google Calendar |
| `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK` | Google Tasks |
| `LOGIN_GOOGLE` | Link kết nối tài khoản Google |
| `CREATE_PLACE` | Tạo nơi chốn |
| `GET_STORAGE_LINKS` | Link thư mục Drive / album Photos |
| `SEARCH_CHAT_HISTORY` | Tra lại chuyện đã chat trong kênh hiện tại (chỉ đọc, không cần xác nhận) |

Quy tắc an toàn:
- **Nhóm chat thụ động** (không ai nhắc bot): LLM chỉ thấy tool thu–chi (`RECORD_TRANSACTION`, `MANAGE_DEBT`) và/hoặc lịch (`CREATE_CALENDAR_EVENT`, `SET_REMINDER`) theo cấu hình thread; không có tool nào được bật thì bỏ qua LLM. Nhờ vậy người lạ trong nhóm không thể gọi tool quản trị hay lấy link lưu trữ.
- **`edit <mã>`**: LLM chỉ được gọi lại đúng tool của thẻ đang chờ.
- **Trò chuyện tự do** (`allowAiChat` khác `false`, không ở chế độ thụ động): prompt có thêm đoạn cho phép trả lời câu hỏi tổng quát. Khi LLM không gọi tool, hệ thống gọi lại một lần với `tools = undefined` để danh sách tool không kéo câu trả lời về hướng từ chối. Chi tiết ở [Tiếp nhận lệnh Zalo](zalo-command-intake.md).
- Lệnh nhanh (`/start`, `/finance`...) không bao giờ đi qua LLM.

## 5. Nhiều hành động trong một câu

Prompt hệ thống yêu cầu LLM tách mỗi hành động thành một tool call. Hệ thống **không gộp** các tool call lại; chúng chạy lần lượt và mỗi call sinh một thẻ xác nhận riêng. Riêng với nhiều `RECORD_TRANSACTION`, `propagateSharedTransactionContext` điền bù:
1. Thời gian: nếu cả câu chỉ có một mốc thời gian, điền cho các giao dịch thiếu.
2. Nơi chốn và phương thức thanh toán: nếu các giao dịch cùng mốc thời gian và chỉ có một giá trị duy nhất, điền cho các giao dịch thiếu.

Ví dụ: "hôm nay mua cà phê 13k và nước cam 20k ở đối diện ctgroup" → cả hai giao dịch đều có nơi chốn "đối diện ctgroup".

## 6. Kiểm thử
`npm run test --workspace @zalobot/api` (bao gồm `llm.service.spec.ts`, `tool-arguments.util.spec.ts`).

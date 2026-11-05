---
metadata:
  agent-artifact:
    id: docs-global-llm-providers
    type: documentation
    depends_on:
      - .agents/knowledge/global/llm-providers.md
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/llm/llm-admin.controller.ts
      - apps/api/src/llm/llm-admin.module.ts
      - apps/api/src/llm/providers/router.provider.ts
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/strategies/ask-clarification-tool.strategy.ts
---

# Nhà cung cấp LLM

Tài liệu này ánh xạ với tri thức canonical [`llm-providers.md`](../../knowledge/global/llm-providers.md).

## 1. Vì sao có lớp `LlmService`

Bot cần hiểu câu tiếng Việt tự do ("ăn trưa 45k", "mai 9h họp") và chuyển thành lệnh có cấu trúc (tool call). Để không bị khoá vào một nhà cung cấp, mọi lời gọi đi qua `LlmService.generate(prompt, tools, systemInstruction)` trong `apps/api/src/llm`. Đổi nhà cung cấp chỉ cần đổi biến môi trường `LLM_PROVIDER`, không sửa code.

Mỗi lời gọi là **một lượt độc lập**: provider không giữ lịch sử hội thoại. Lệnh `/reset` chỉ gửi thông báo, không có ngữ cảnh nào để xoá. Khi bật [trí nhớ hội thoại](../modules/zca/chat-memory.md), chính backend chèn vài tin gần nhất của kênh (lấy từ bảng `zca_messages`) vào prompt hệ thống; trí nhớ nằm ở DB của mình, không nằm ở LLM.

Tool `SEARCH_CHAT_HISTORY` viết câu trả lời bằng `generate(prompt, undefined, systemInstruction)`, tức một lời gọi không kèm tool, đi qua cùng chuỗi provider như mọi xử lý khác. Không có cấu hình LLM riêng cho trí nhớ.

Nơi sử dụng: `TextInputService` (tin nhắn chat, chỉnh sửa thẻ chờ) và chiến lược tạo hoá đơn từ ảnh (`CreateBillPendingImageStrategy`, dùng chữ OCR).

## 2. Xem và ping LLM trên dashboard

Trước đây muốn biết bot đang dùng LLM nào phải đọc env của server, và khi bot trả lời chậm hay lỗi thì không biết mắt xích nào hỏng. Vì vậy admin có thẻ **AI đang dùng** ở Cài đặt → Tùy chọn hệ thống, gọi hai API chỉ dành cho admin:

- `GET /api/llm/providers`: chuỗi LLM theo đúng thứ tự bot gọi, gồm tên, vai trò, model và đã cấu hình đủ chưa. Không trả base URL hay API key.
- `POST /api/llm/providers/:name/ping`: gọi thử đúng một provider.

Những điều cần hiểu khi đọc kết quả:

- **Ping không đi qua fallback.** Nếu đi qua `generate()`, provider chính chết thì provider dự phòng trả lời thay và thẻ vẫn báo OK. Nên `pingProvider` gọi thẳng một provider.
- **`Trả lời rỗng` cũng là hỏng.** Bot coi trả lời rỗng là lỗi và chuyển provider, nên ping báo riêng trạng thái này.
- **UI chỉ hiện trạng thái, không hiện chuỗi lỗi.** Xem chi tiết trong log server, ví dụ thông báo `ollama pull` của Qwen hoặc mã lỗi HTTP.
- **Mỗi lần ping là một lượt gọi AI thật**, tốn vài token, nên không tự chạy khi tải trang. Provider treo có thể quay tới hết `LLM_TIMEOUT_MS`.
- **Cognee không nằm trong thẻ này** vì nó dùng LLM riêng qua `COGNEE_LLM_*`.

Khi thêm provider mới, phải cài `describe()` để thẻ biết model và trạng thái cấu hình; `describe()` không được gọi mạng và không được trả secret.

## 3. Chọn nhà cung cấp

| `LLM_PROVIDER` | Provider | Biến môi trường | Mặc định |
| --- | --- | --- | --- |
| `gemini` (mặc định, và mọi giá trị lạ) | `GeminiProvider` | `GEMINI_API_KEY`, `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `openai` | `OpenAiProvider` | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | `gpt-4o-mini`, `https://api.openai.com/v1` |
| `router`, `9router` | `RouterProvider` | `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY` | không có (thiếu URL/key thì tính là lỗi) |
| `qwen`, `ollama`, `qwen2.5:14b`, `qwen-14b` | `QwenProvider` | `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_API_KEY` | `http://localhost:11434`, `qwen2.5:14b` |

Qwen hỗ trợ hai kiểu máy chủ: URL kết thúc bằng `/v1` hoặc `/chat/completions` được gọi theo chuẩn OpenAI; còn lại gọi API gốc của Ollama `/api/chat`. Nếu model nhỏ trả tool call dạng thẻ `<tool_call>` trong văn bản, provider tự bóc tách.

**Không bao giờ ném lỗi ra ngoài:** khi thiếu API key, lỗi HTTP, mất kết nối hoặc quá thời gian chờ, provider trả về `{ text: "<thông báo tiếng Việt>", failed: true }`. Với Ollama báo 404, câu thông báo nhắc chạy `ollama pull <model>`. Mỗi lời gọi có timeout `LLM_TIMEOUT_MS` (mặc định 30 giây) để provider bị treo cũng được tính là lỗi.

### Chuỗi dự phòng (fallback)

Vì sao cần: trước đây chỉ có một provider. Khi provider đó lỗi, bot gửi nguyên câu "Có lỗi khi kết nối tới mô hình AI." vào nhóm, và nếu provider treo thì tin nhắn treo theo. Giờ `LlmService` thử lần lượt `LLM_PROVIDER` rồi đến từng provider trong `LLM_FALLBACK_PROVIDERS`:
- Provider trả `failed` hoặc trả rỗng (không text, không tool call; model free hay bị vậy) thì chuyển sang provider kế tiếp, log `warn`.
- Provider nào trả lời được thì dùng luôn; nếu là provider dự phòng thì log `LLM answered by fallback provider "<tên>"`.
- Cả chuỗi lỗi thì trả câu báo lỗi của provider cuối, giống hành vi cũ.
- Không đặt `LLM_FALLBACK_PROVIDERS` thì chỉ có một provider như trước.

Cấu hình đang dùng: 9router đứng đầu, Gemini dự phòng, không có mắt xích thứ ba.

Khi cả chuỗi đều lỗi, bot chỉ báo lỗi **một lần** và bỏ lượt trò chuyện không tool (lượt này sẽ lại chạy hết chuỗi, làm người dùng chờ gấp đôi). `LLM_TIMEOUT_MS` (mặc định 30 giây) áp dụng cho mọi provider, kể cả Qwen chạy local; máy yếu hoặc model nạp chậm thì cần tăng. Provider `router` thiếu `ROUTER_MODEL` thì bị coi là lỗi, không ngầm dùng model mặc định của OpenAI.

```bash
LLM_PROVIDER=router
LLM_FALLBACK_PROVIDERS=gemini
ROUTER_BASE_URL=https://<router>/v1
ROUTER_MODEL=chat-daily
ROUTER_API_KEY=<key>
LLM_TIMEOUT_MS=30000
```

Provider `router` có biến môi trường riêng, tách khỏi `OPENAI_*`, để vẫn dùng được OpenAI thật như một mắt xích khác nếu cần. Rollback: đặt lại `LLM_PROVIDER=gemini` và xoá `LLM_FALLBACK_PROVIDERS`.

## 4. Làm sạch tham số

Model nhỏ hay trả tham số bị lồng (`{"amount": {"amount": 15000}}`). `cleanToolArguments` tự gỡ lớp bọc cho mọi tool call. `parseAmount` đổi "45k", "2tr", "15.000" thành số nguyên VND dương. `normalizeSchemaTypes` chuyển kiểu schema (`OBJECT` → `object`) cho OpenAI/Ollama.

## 5. Danh sách tool (`ZALO_TOOL_DEFINITIONS` — 16 tool)

| Tool | Mục đích |
| --- | --- |
| `MANAGE_DEBT` | Ghi khoản cho vay / đi vay |
| `RECORD_TRANSACTION` | Ghi khoản thu / chi |
| `DELETE_TRANSACTION` | Xoá giao dịch theo ID hoặc mô tả |
| `SET_REMINDER` | Đặt lời nhắc; giờ lặp có thể là hằng ngày, ngày thường, hằng tuần, hằng tháng hoặc hằng năm (dịp lễ, sinh nhật dùng hằng năm, không dùng hằng tháng) |
| `GET_REPORT` | Báo cáo chi tiêu (day/month/year) |
| `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT` | Google Calendar |
| `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK` | Việc cần làm (DB zalobot) |
| `LOGIN_GOOGLE` | Link kết nối tài khoản Google |
| `CREATE_PLACE` | Tạo nơi chốn |
| `GET_STORAGE_LINKS` | Link thư mục Drive / album Photos |
| `SEARCH_CHAT_HISTORY` | Tra lại chuyện đã chat trong kênh hiện tại (chỉ đọc, không cần xác nhận) |
| `ASK_CLARIFICATION` | Hỏi lại người dùng khi thiếu thông tin bắt buộc (ví dụ sinh nhật không nói ngày); gửi sau các thẻ xác nhận, kể cả khi tắt trò chuyện tự do. Chi tiết ở [ZCA](../modules/zca/README.md) |

Quy tắc an toàn:
- **Nhóm chat thụ động** (không ai nhắc bot): LLM chỉ thấy tool thu–chi (`RECORD_TRANSACTION`, `MANAGE_DEBT`) và/hoặc lịch (`CREATE_CALENDAR_EVENT`, `SET_REMINDER`) theo cấu hình thread; không có tool nào được bật thì bỏ qua LLM. Nhờ vậy người lạ trong nhóm không thể gọi tool quản trị hay lấy link lưu trữ.
- **`edit <mã>`**: LLM chỉ được gọi lại đúng tool của thẻ đang chờ.
- **Trò chuyện tự do** (`allowAiChat` khác `false`, không ở chế độ thụ động): prompt có thêm đoạn cho phép trả lời câu hỏi tổng quát. Khi LLM không gọi tool, hệ thống gọi lại một lần với `tools = undefined` để danh sách tool không kéo câu trả lời về hướng từ chối. Chi tiết ở [Tiếp nhận lệnh Zalo](zalo-command-intake.md).
- Lệnh nhanh (`/help`, `/finance`...) không bao giờ đi qua LLM.
- **Bố cục prompt để tận dụng cache của provider**: phần tĩnh (câu giới thiệu bot, bảng phân loại, luật điền tham số, đoạn trò chuyện tự do, luật trả lời thuần văn bản) đứng trước; phần đổi theo kênh và theo lượt (ghi nhớ/điều bot học, mốc giờ, thẻ đang chờ) đứng cuối, và mốc giờ trong prompt chỉ tới phút. Gemini (cache ngầm) và OpenAI (prompt caching) chỉ dùng lại được phần đầu prompt giống hệt nhau giữa các lượt; trước đây profile kênh và giờ tới từng giây đứng đầu nên vài nghìn token tĩnh bị tính tiền và xử lý lại ở mọi tin. Mỗi provider ghi log debug `… tokens: prompt=… cached=… output=…`; từ tin thứ hai của một kênh, `cached > 0` nghĩa là cache đang trúng (cần model có cache ngầm, ví dụ Gemini 2.5+ hoặc gpt-4o+).

## 6. Nhiều hành động trong một câu

Prompt hệ thống yêu cầu LLM tách mỗi hành động thành một tool call. Hệ thống **không gộp** các tool call lại; chúng chạy lần lượt và mỗi call sinh một thẻ xác nhận riêng. Riêng với nhiều `RECORD_TRANSACTION`, `propagateSharedTransactionContext` điền bù:
1. Thời gian: nếu cả câu chỉ có một mốc thời gian, điền cho các giao dịch thiếu.
2. Nơi chốn và phương thức thanh toán: nếu các giao dịch cùng mốc thời gian và chỉ có một giá trị duy nhất, điền cho các giao dịch thiếu.

Ví dụ: "hôm nay mua cà phê 13k và nước cam 20k ở đối diện ctgroup" → cả hai giao dịch đều có nơi chốn "đối diện ctgroup".

## 7. Kiểm thử
`npm run test --workspace @zalobot/api` (bao gồm `llm.service.spec.ts`, `tool-arguments.util.spec.ts`).

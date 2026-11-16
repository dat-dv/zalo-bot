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
      - apps/api/src/llm/llm-provider-config.service.ts
      - apps/api/src/llm/llm-provider-seed.ts
      - apps/api/src/llm/llm-proxy.service.ts
      - apps/api/src/llm/llm-proxy.controller.ts
      - docker-compose.yml
      - apps/web/nginx.conf
      - apps/api/src/database/migrations/1725030000000-CreateLlmProviders.ts
      - apps/web/src/modules/settings/presentation/components/llm-providers-panel.tsx
      - apps/web/src/modules/settings/presentation/components/llm-provider-dialog.tsx
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/strategies/ask-clarification-tool.strategy.ts
---

# Nhà cung cấp LLM

Tài liệu này ánh xạ với tri thức canonical [`llm-providers.md`](../../knowledge/global/llm-providers.md).

## 1. Vì sao có lớp `LlmService`

Bot cần hiểu câu tiếng Việt tự do ("ăn trưa 45k", "mai 9h họp") và chuyển thành lệnh có cấu trúc (tool call). Để không bị khoá vào một nhà cung cấp, mọi lời gọi đi qua `LlmService.generate(prompt, tools, systemInstruction)` trong `apps/api/src/llm`. Đổi nhà cung cấp, model hay API key làm ngay trên dashboard (thẻ **AI đang dùng**), không sửa code, không sửa env, không restart.

Mỗi lời gọi là **một lượt độc lập**: provider không giữ lịch sử hội thoại. Lệnh `/reset` chỉ gửi thông báo, không có ngữ cảnh nào để xoá. Khi bật [trí nhớ hội thoại](../modules/zca/chat-memory.md), chính backend chèn vài tin gần nhất của kênh (lấy từ bảng `zca_messages`) vào prompt hệ thống; trí nhớ nằm ở DB của mình, không nằm ở LLM.

Tool `SEARCH_CHAT_HISTORY` viết câu trả lời bằng `generate(prompt, undefined, systemInstruction)`, tức một lời gọi không kèm tool, đi qua cùng chuỗi provider như mọi xử lý khác. Không có cấu hình LLM riêng cho trí nhớ.

Nơi sử dụng: `TextInputService` (tin nhắn chat, chỉnh sửa thẻ chờ) và chiến lược tạo hoá đơn từ ảnh (`CreateBillPendingImageStrategy`, dùng chữ OCR).

## 2. Cấu hình chuỗi AI trên dashboard

### Vì sao chuyển từ env sang DB

Trước đây chuỗi AI cứng trong env: `LLM_PROVIDER`, `LLM_FALLBACK_PROVIDERS` và cấu hình riêng từng loại (`GEMINI_*`, `ROUTER_*`, `OPENAI_*`, `QWEN_*`). Mỗi loại chỉ có **một** cấu hình (không thể có hai router khác model), và muốn đổi model, key hay thứ tự thì phải sửa env rồi restart server. Giờ chuỗi nằm trong bảng `llm_providers`, admin sửa ở Cài đặt → thẻ **AI đang dùng**, có hiệu lực ngay tin nhắn kế tiếp.

### Mỗi dòng của chuỗi

- **Tên**: chữ thường, số, `.`, `_`, `-` (ví dụ `router`, `gemini`, `router-gpt5`). Không trùng.
- **Loại**: `gemini` (Google AI Studio), `OpenAI-compatible` (OpenAI thật hoặc mọi router kiểu 9router), `ollama` (Qwen/Ollama chạy local, hỗ trợ cả `/api/chat` lẫn URL `/v1`).
- **Base URL**: để trống thì dùng mặc định của loại (`https://api.openai.com/v1`, `http://localhost:11434`); Gemini không có ô này.
- **Model**: bắt buộc. Router mà thiếu model thì bị coi là chưa cấu hình, không ngầm dùng `gpt-4o-mini`.
- **API key**: mã hoá AES-256-GCM bằng `DATA_ENCRYPTION_KEY` (cùng cách mã hoá token Google) trước khi lưu. API **không bao giờ trả key ra**, form chỉ cho nhập key mới (để trống = giữ key cũ) hoặc tick "Xoá API key đã lưu". Nhật ký hoạt động ghi thay đổi của bảng này nhưng che cột `api_key`.
- **Bật/tắt**: tắt thì bot bỏ qua dòng đó nhưng vẫn giữ cấu hình, ping vẫn được.
- **Thứ tự**: nút ↑/↓; dòng bật đầu tiên là **Chính**, các dòng bật sau là **Dự phòng**.

Bảng trống hoặc mọi dòng đều tắt thì bot trả lời "Bot chưa được cấu hình AI nào." và thẻ hiện cảnh báo vàng. Hệ thống **không** quay lại đọc env, để chỉ có một nơi cấu hình.

`DATA_ENCRYPTION_KEY` mà đổi thì key cũ không giải mã được: dòng đó hiện "Chưa cấu hình", log cảnh báo một lần, bot không crash. Nhập lại key trên dashboard là xong.

### Migration seed dữ liệu khi deploy

Migration `1725030000000-CreateLlmProviders` tạo bảng và **chỉ khi bảng còn trống** thì đọc env đang chạy để ghi lại đúng chuỗi cũ (`buildLlmProviderSeed`):

- Thứ tự: `LLM_PROVIDER` (trống thì `gemini`) rồi từng tên trong `LLM_FALLBACK_PROVIDERS`.
- Bí danh cũ vẫn được hiểu: `ollama`, `qwen2.5:14b`, `qwen-14b` → dòng `qwen` (loại ollama); `9router` → dòng `router` (loại OpenAI-compatible). Tên trùng hoặc lạ bị bỏ; không còn gì thì chỉ có `gemini`.
- Model/URL mặc định giống provider cũ; API key được mã hoá. `DATA_ENCRYPTION_KEY` sai định dạng thì vẫn tạo dòng nhưng bỏ key và log cảnh báo.

Vì API chạy migration lúc khởi động (`migrationsRun: true`), deploy lên prod là chuỗi `router → gemini` hiện có tự vào DB, không phải nhập tay. Chạy lại migration trên bảng đã có dữ liệu không ghi đè gì. Sau đó các biến env AI ở trên chỉ còn migration đọc (DB mới không có chúng thì có một dòng `gemini` chưa có key, nhập key trên dashboard). Chúng đã bị bỏ khỏi `.env.example` và xoá được khỏi env prod. `npm run eval:intent` đọc chuỗi từ DB (cần `DATABASE_URL` và `DATA_ENCRYPTION_KEY`). `LLM_TIMEOUT_MS` vẫn ở env.

### API (chỉ admin)

- `GET /api/llm/providers`: mọi dòng theo thứ tự, kể cả dòng tắt.
- `POST /api/llm/providers`: thêm vào cuối chuỗi (tên trùng → 409).
- `PATCH /api/llm/providers/:id`: sửa; chỉ trường gửi lên mới đổi.
- `DELETE /api/llm/providers/:id`: xoá.
- `PUT /api/llm/providers/order` với `{ ids }`: đặt lại thứ tự, phải có đủ mọi id.
- `POST /api/llm/providers/:id/ping`: gọi thử đúng một dòng.

### Đọc kết quả ping

- **Ping không đi qua fallback.** Nếu đi qua `generate()`, provider chính chết thì provider dự phòng trả lời thay và thẻ vẫn báo OK. Nên `pingProvider` gọi thẳng một dòng.
- **`Trả lời rỗng` cũng là hỏng.** Bot coi trả lời rỗng là lỗi và chuyển provider, nên ping báo riêng trạng thái này.
- **UI chỉ hiện trạng thái, không hiện chuỗi lỗi.** Xem chi tiết trong log server, ví dụ thông báo `ollama pull` của Qwen hoặc mã lỗi HTTP.
- **Mỗi lần ping là một lượt gọi AI thật**, tốn vài token, nên không tự chạy khi tải trang. Provider treo có thể quay tới hết `LLM_TIMEOUT_MS`.
- **Cognee (trí nhớ dài hạn) dùng chung chuỗi này** qua cổng AI nội bộ, xem mục dưới. Ping trên thẻ là ping chung cho cả bot lẫn trí nhớ.

### Cổng AI nội bộ cho Cognee

**Vì sao:** Cognee chạy container riêng, chỉ đọc cấu hình AI từ env một lần lúc khởi động và không đọc được DB của mình. Trước đây nó dùng bộ biến riêng `COGNEE_LLM_*`, không có dự phòng, đổi AI phải sửa env rồi restart. Giờ Cognee gọi vào API, API chuyển tiếp qua đúng chuỗi AI trên dashboard.

- **Đường đi:** Cognee → `POST http://api:<cổng>/api/internal/llm/v1/chat/completions` → lần lượt các AI đang bật. Compose đặt sẵn cho Cognee: `LLM_PROVIDER=custom`, `LLM_ENDPOINT` trỏ vào API, `LLM_MODEL=openai/zalobot` (tên này bị bỏ qua, mỗi AI dùng model của nó), `LLM_API_KEY=${COGNEE_USER_PASSWORD}`.
- **Chuyển tiếp nguyên văn:** giữ nguyên `messages`, `tools`, `response_format`…, chỉ thay `model`. Cognee ép AI trả JSON để dựng đồ thị, nên không dịch lại gì cho khỏi sai.
- **Theo loại:** OpenAI-compatible gọi thẳng `<base URL>/chat/completions`; Gemini gọi endpoint tương thích OpenAI của Google; Ollama chỉ dùng khi URL kết thúc bằng `/v1`, kiểu `/api/chat` gốc bị bỏ qua (log cảnh báo một lần).
- **Dự phòng:** lỗi mạng, quá 180 giây, mã HTTP không phải 2xx, hoặc 2xx mà không có nội dung thì chuyển AI kế tiếp. Hết chuỗi thì trả lỗi của AI cuối; không có AI nào dùng được thì 503.
- **Bảo mật:** bắt buộc header `Authorization: Bearer <COGNEE_USER_PASSWORD>` (so sánh constant-time; mật khẩu trống = Cognee tắt = luôn 401). nginx của `web` trả 404 cho `/api/internal/` nên từ Internet không gọi tới được. Log chỉ ghi tên AI, mã HTTP và thời gian, không ghi nội dung chat.
- **Cái giá:** lượt dựng trí nhớ (mỗi đoạn khoảng 1500 token) giờ dùng chung hạn mức với chat. Cơ chế tạm dừng nạp 60 phút khi AI của trí nhớ lỗi vẫn giữ.

## 3. Hành vi khi gọi

**Không bao giờ ném lỗi ra ngoài:** khi thiếu key/model/URL, lỗi HTTP, mất kết nối hoặc quá thời gian chờ, client trả về `{ text: "<thông báo tiếng Việt>", failed: true }`. Với Ollama báo 404, câu thông báo nhắc chạy `ollama pull <model>`. Mỗi lời gọi có timeout `LLM_TIMEOUT_MS` (mặc định 30 giây) để provider bị treo cũng được tính là lỗi.

### Chuỗi dự phòng (fallback)

`LlmService` thử lần lượt các dòng đang bật theo thứ tự:
- Dòng trả `failed` hoặc trả rỗng (không text, không tool call; model free hay bị vậy) thì chuyển sang dòng kế tiếp, log `warn`.
- Dòng nào trả lời được thì dùng luôn; nếu là dòng dự phòng thì log `LLM answered by fallback provider "<tên>"`.
- Cả chuỗi lỗi thì trả câu báo lỗi của dòng cuối.

Cấu hình đang dùng: 9router đứng đầu, Gemini dự phòng, không có mắt xích thứ ba.

Khi cả chuỗi đều lỗi, bot chỉ báo lỗi **một lần** và bỏ lượt trò chuyện không tool (lượt này sẽ lại chạy hết chuỗi, làm người dùng chờ gấp đôi). `LLM_TIMEOUT_MS` áp dụng cho mọi dòng, kể cả Ollama chạy local; máy yếu hoặc model nạp chậm thì cần tăng.

Rollback một provider hỏng: tắt dòng đó hoặc kéo dòng khác lên đầu trên dashboard.

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

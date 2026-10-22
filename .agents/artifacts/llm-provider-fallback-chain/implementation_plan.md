# Implementation Plan: Chuỗi LLM 9router → Gemini → …

Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM** (đổi cách mọi tính năng AI gọi LLM, không đổi schema hay API công khai)

## 1. Mục tiêu

Mọi lời gọi LLM đều thử theo một chuỗi provider có thứ tự: **9router trước**, lỗi thì sang **Gemini**, rồi sang provider thứ ba (anh xác nhận ở mục 6). Các lời gọi gồm:
- tool calling khi nhắn bot
- chit-chat
- `edit <mã>`
- tạo bill từ OCR
- trả lời trí nhớ hội thoại

## 2. Hiện trạng (đã kiểm tra)

- `LlmService.generate` chọn đúng **một** provider theo `LLM_PROVIDER`, không có fallback (`apps/api/src/llm/llm.service.ts`).
- Provider **không bao giờ throw**. Khi lỗi (thiếu key, HTTP lỗi, lỗi mạng) chúng trả `{ text: 'Có lỗi khi kết nối tới mô hình AI.' }` (`gemini.provider.ts`, `openai.provider.ts`, `qwen.provider.ts`). Vì vậy `LlmService` không phân biệt được lỗi với câu trả lời thật, và câu báo lỗi bị gửi thẳng cho người dùng.
- `fetch` không có timeout. Nếu 9router treo thì request treo theo, không có cơ hội fallback.
- 9router đã có đường riêng nhưng chỉ cho trí nhớ (`MEMORY_LLM_*` → `OpenAiProvider.generateWithConfig`).

## 3. Thiết kế

### 3.1 Provider phát tín hiệu lỗi

- `LlmResponse` thêm trường `failed?: boolean`.
- Cả 3 provider đặt `failed: true` ở mọi nhánh lỗi hiện có (thiếu key, `!response.ok`, `catch`, Qwen 404). Câu báo lỗi tiếng Việt giữ nguyên để dùng khi cả chuỗi đều lỗi.
- **Timeout**: thêm `signal: AbortSignal.timeout(LLM_TIMEOUT_MS)` vào `fetch` của cả 3 provider (mặc định `30000` ms). Hết giờ thì rơi vào `catch` và thành `failed: true`.

### 3.2 Provider `router` (9router)

- Provider mới **`RouterProvider`** (`name = 'router'`, alias `9router`). Gọi `OpenAiProvider.generateWithConfig` với env riêng:
  - `ROUTER_BASE_URL` (vd `https://9router.datintech.site/v1`)
  - `ROUTER_MODEL` (vd `chat-daily`)
  - `ROUTER_API_KEY`
- Tách khỏi `OPENAI_*` để vẫn giữ được OpenAI thật làm một mắt xích khác nếu cần.
- Thiếu `ROUTER_BASE_URL` hoặc key thì trả `failed: true` và chuỗi đi tiếp.

### 3.3 Chuỗi fallback trong `LlmService.generate`

- Env mới `LLM_FALLBACK_PROVIDERS` (danh sách phân cách bằng dấu phẩy, vd `gemini,qwen`). Thứ tự thử = `[LLM_PROVIDER, ...LLM_FALLBACK_PROVIDERS]`, bỏ trùng, bỏ tên không hợp lệ (log `warn` một lần).
- Không đặt `LLM_FALLBACK_PROVIDERS` thì hành vi giữ nguyên như hiện nay (một provider). **Tương thích ngược.**
- Lặp từng provider:
  - Thành công (không `failed`) → làm sạch tool args như hiện tại, trả kết quả.
  - `failed` → log `warn` (`LLM provider router failed, falling back to gemini`) rồi thử provider tiếp.
  - **Phản hồi rỗng** (không text, không tool call) cũng tính là lỗi để thử provider sau. Model free đôi khi trả rỗng.
  - Hết chuỗi → trả phản hồi lỗi cuối cùng (giữ câu báo lỗi như hiện nay).
- Log `debug` ghi provider nào đã trả lời, để biết tỷ lệ fallback.

### 3.4 Trí nhớ hội thoại

`generateMemoryAnswer` đi qua cùng chuỗi:
- Nếu `MEMORY_LLM_BASE_URL` có giá trị thì thử nó trước, lỗi thì rơi xuống chuỗi chính.
- Không có thì dùng thẳng chuỗi chính.
- Như vậy khi chuỗi chính là 9router → Gemini, có thể bỏ trống `MEMORY_LLM_*`.

### 3.5 Cấu hình đề xuất cho anh

```bash
LLM_PROVIDER=router
LLM_FALLBACK_PROVIDERS=gemini        # chỉ 9router → Gemini (đã chốt)
ROUTER_BASE_URL=https://9router.datintech.site/v1
ROUTER_MODEL=chat-daily
ROUTER_API_KEY=<key mới>
LLM_TIMEOUT_MS=30000
```

## 4. File thay đổi

- **Mới**: `apps/api/src/llm/providers/router.provider.ts`
- **Sửa**:
  - `llm/types/llm.types.ts` (`failed?`)
  - `llm/providers/{gemini,openai,qwen}.provider.ts` (`failed: true` + timeout)
  - `llm/llm.service.ts` (chuỗi + memory)
  - `llm/llm.module.ts` (đăng ký `RouterProvider`)
  - `config/configuration.ts` (`llm.router`, `llm.fallbackProviders`, `llm.timeoutMs`)
  - `.env.example`, `apps/api/.env.example`
- **Docs**:
  - `.agents/knowledge/global/llm-providers.md` + `.agents/docs/global/llm-providers.md`: chuỗi, `failed`, timeout, provider `router`
  - `environment-guard.md` (EN/VI): env mới
  - `modules/zca/chat-memory.md` (EN/VI): memory đi qua chuỗi

Không đổi caller (`TextInputService`, `CreateBillPendingImageStrategy`, strategy trí nhớ) vì tất cả đã đi qua `LlmService`.

## 5. Kiểm thử

`llm.service.spec.ts` thêm các test:
- Provider đầu thành công → không gọi provider sau.
- Provider đầu `failed` → dùng provider thứ hai.
- Phản hồi rỗng → fallback.
- Cả chuỗi lỗi → trả câu báo lỗi cuối.
- Tên provider không hợp lệ trong chuỗi bị bỏ qua.
- Không đặt fallback → giữ hành vi cũ (test routing hiện có vẫn pass).
- `generateMemoryAnswer`: memory endpoint lỗi → rơi xuống chuỗi.

Test provider:
- `GeminiProvider` thiếu key trả `failed: true`.
- `RouterProvider` thiếu cấu hình trả `failed: true`.

Lệnh:
- `npm run typecheck --workspace @zalobot/api`
- `npm run test --workspace @zalobot/api`
- eslint trên các file sửa
- `node .claude/hooks/docs-drift-check.mjs`

Không chạy `npm run lint` toàn bộ vì lệnh này có `--fix` và đang fail sẵn.

## 6. Cần anh xác nhận

1. ~~Mắt xích thứ ba~~ **Đã chốt (2026-10-22): chuỗi chỉ gồm 9router → Gemini, không có mắt xích thứ ba.** Cấu hình: `LLM_PROVIDER=router`, `LLM_FALLBACK_PROVIDERS=gemini`. Nếu Gemini cũng lỗi thì bot trả câu báo lỗi như hiện nay. Chuỗi đọc từ env, nên muốn thêm provider sau này cũng không cần sửa code.
2. **Timeout 30 giây** mỗi provider có hợp lý không? Trường hợp xấu nhất một tin nhắn chờ khoảng 30s × số mắt xích lỗi.
3. **Chất lượng tool calling**: `chat-daily` (hiện là `deepseek-v4.1-flash-free`) sẽ quyết định cả ghi thu chi và công nợ. Giao dịch vẫn phải xác nhận bằng mã nên không ghi sai âm thầm, nhưng nếu model hay chọn sai tool thì nên để Gemini đứng đầu cho tool calling. Plan giữ đúng ý anh: 9router đứng đầu cho mọi xử lý.
4. **Riêng tư**: 9router đứng đầu nghĩa là mọi tin nhắn gửi bot (kể cả OCR hoá đơn) đi qua bên thứ ba dùng model free. Em sẽ ghi điều này vào `local-first-ai-usage.md`.

## 7. Rollback

Đặt lại `LLM_PROVIDER=gemini` và xoá `LLM_FALLBACK_PROVIDERS`. Hành vi quay về như hiện nay, không cần sửa code.

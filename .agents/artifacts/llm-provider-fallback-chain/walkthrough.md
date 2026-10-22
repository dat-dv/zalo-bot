# Walkthrough: Chuỗi LLM 9router → Gemini

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Chốt: chỉ 9router → Gemini, timeout 30s.

## Đã làm

- `LlmResponse.failed`: cả 3 provider (Gemini, OpenAI, Qwen) đặt `failed: true` ở mọi nhánh lỗi. Câu báo lỗi tiếng Việt giữ nguyên.
- **Timeout**: `utils/llm-timeout.util.ts` (`LLM_TIMEOUT_MS`, mặc định 30000). Mọi `fetch` của provider dùng `AbortSignal.timeout`.
- **Provider mới `RouterProvider`** (`router`, alias `9router`), env `ROUTER_BASE_URL/MODEL/API_KEY`, gọi qua `OpenAiProvider.generateWithConfig`.
- **`LlmService.generate`**: chuỗi `[LLM_PROVIDER, ...LLM_FALLBACK_PROVIDERS]`.
  - Bỏ trùng, bỏ tên lạ (cảnh báo một lần).
  - Lỗi hoặc rỗng thì sang provider kế tiếp; hết chuỗi thì trả lỗi cuối.
  - Không cấu hình fallback thì giữ hành vi cũ.
- **`generateMemoryAnswer`**: endpoint `MEMORY_LLM_*` lỗi thì rơi xuống chuỗi chính.
- **Config và env**: `llm.fallbackProviders`, `llm.timeoutMs`, `llm.router`; `.env.example` và `apps/api/.env.example`.
- **Docs**: `llm-providers`, `environment-guard`, `local-first-ai-usage` (ghi ngoại lệ 9router), `chat-memory`. Mỗi file cập nhật cả bản EN và VI.

## Kiểm tra đã chạy

- `npm run typecheck --workspace @zalobot/api`: PASS.
- `npm run test --workspace @zalobot/api`: 431/431 PASS (thêm 8 test chuỗi/provider).
- `eslint src/llm src/config`: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm chứng

- Chưa gọi 9router thật. Chất lượng tool calling của `chat-daily` với prompt tiếng Việt của bot cần theo dõi qua log `falling back` / `answered by fallback provider`.

## Cấu hình cần đặt trên server

```bash
LLM_PROVIDER=router
LLM_FALLBACK_PROVIDERS=gemini
ROUTER_BASE_URL=https://9router.datintech.site/v1
ROUTER_MODEL=chat-daily
ROUTER_API_KEY=<key mới>
LLM_TIMEOUT_MS=30000
```

## Cập nhật 2026-10-22: gỡ `MEMORY_LLM_*`

Theo yêu cầu, đã bỏ cấu hình LLM riêng cho trí nhớ:
- Xoá `llm.memory` và `LlmService.generateMemoryAnswer`.
- `SEARCH_CHAT_HISTORY` gọi `generate(prompt, undefined, systemInstruction)` qua chuỗi chung.
- Đã xoá các biến này khỏi env example, docs và `.env`/`.env.production`.

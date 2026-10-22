---
metadata:
  agent-artifact:
    id: global-llm-providers-knowledge
    type: documentation
    depends_on:
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/llm/llm.module.ts
      - apps/api/src/llm/types/llm.types.ts
      - apps/api/src/llm/utils/tool-arguments.util.ts
      - apps/api/src/llm/providers/gemini.provider.ts
      - apps/api/src/llm/providers/openai.provider.ts
      - apps/api/src/llm/providers/qwen.provider.ts
      - apps/api/src/llm/providers/router.provider.ts
      - apps/api/src/llm/utils/llm-timeout.util.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
---

# LLM Providers

Owner: Core Engineering Team · Status: active

Human guide: [LLM Providers](../../docs/global/llm-providers.md).

## Purpose

`apps/api/src/llm` (`LlmModule`) gives the bot one provider-agnostic entry point for natural-language tool calling. Callers: `TextInputService` (chat intake, edit of pending actions) and `CreateBillPendingImageStrategy` (OCR text of a bill image). `LlmService` is the only LLM entry point.

## LlmService

- `generate(prompt, tools?, systemInstruction?) => Promise<LlmResponse>`; single-turn (one system + one user message). Conversation context is never kept by the provider: when chat memory is on, `TextInputService` appends the latest stored messages of the chat to `systemInstruction` (see `modules/zca/chat-memory.md`).
- `SEARCH_CHAT_HISTORY` answers with `generate(prompt, undefined, systemInstruction)` (tool-free) through the same chain; there is no memory-specific LLM config.
- Provider chain per call: `[LLM_PROVIDER, ...LLM_FALLBACK_PROVIDERS]` (config `llm.provider`, default `gemini`; `llm.fallbackProviders`, comma-separated, default empty), lower-cased, de-duplicated, looked up in a map: `gemini`, `openai`, `qwen`, `router`, plus aliases `ollama`, `qwen2.5:14b`, `qwen-14b` -> Qwen and `9router` -> Router. Unknown names are skipped (one warning); an empty chain uses Gemini.
- Providers are tried in order. A provider is skipped when its response has `failed: true` or is empty (no text, no tool call). First good response wins (fallback use logged at LOG level). All failed -> the last failed response (its Vietnamese error text) is returned, as before the chain existed. No fallbacks configured = single provider, unchanged behavior.
- Current deployment intent: `LLM_PROVIDER=router` (9router) + `LLM_FALLBACK_PROVIDERS=gemini`, no third link.
- `TextInputService`: when the tool-calling pass returns `failed` (whole chain failed), it sends that error text once and skips the tool-free chit-chat pass (which would run the chain again); with `allowAiChat === false` it stays silent.
- `LLM_TIMEOUT_MS` (default 30000) applies to every provider, including local Qwen/Ollama; raise it for slow local models.
- Post-processing: every `toolCall.args` / `toolCalls[].args` passes through `cleanToolArguments`.

## Types (`llm/types/llm.types.ts`)

- `LlmToolDefinition { name, description, parameters?: { type?, properties: Record<string, LlmToolProperty>, required? } }`; `LlmToolProperty { type, description?, enum? }`.
- `LlmToolCall { name, args: Record<string, unknown> }`.
- `LlmResponse { text?, toolCall?, toolCalls? }` — `toolCall` is the first of `toolCalls`.
- `ILlmProvider { name; generate(...) }`.

## Providers

| Provider | Config (env) | Defaults | Transport |
| --- | --- | --- | --- |
| `GeminiProvider` | `GEMINI_API_KEY`, `GEMINI_MODEL` | model `gemini-3.5-flash-lite` | `POST generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`; tools as `functionDeclarations`; reads all `functionCall` parts. |
| `OpenAiProvider` | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | `gpt-4o-mini`, `https://api.openai.com/v1` | `POST <base>/chat/completions`; tools as `function`, schema types lower-cased via `normalizeSchemaTypes`. `generateWithConfig({ baseUrl, model, apiKey }, …)` runs the same call against any OpenAI-compatible endpoint. |
| `RouterProvider` | `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY` | none (missing URL, key or model -> `failed`; no silent `gpt-4o-mini` default) | OpenAI-compatible LLM router (e.g. 9router `chat-daily`) through `OpenAiProvider.generateWithConfig`; separate from `OPENAI_*` so real OpenAI stays usable as another link. |
| `QwenProvider` | `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_API_KEY` | `http://localhost:11434`, `qwen2.5:14b` | Base ending `/v1` or `/chat/completions` -> OpenAI format; else native Ollama `/api/chat` (`stream: false`). Optional Bearer key. Falls back to parsing `<tool_call>{...}</tool_call>` tags in text. |

Failure contract: providers never throw to callers; they return `{ text, failed: true }` with a Vietnamese error message (missing API key / router config, HTTP error, network error, timeout; Qwen 404 -> "model not pulled" hint). Every `fetch` uses `AbortSignal.timeout(LLM_TIMEOUT_MS)` (default 30000 ms, `utils/llm-timeout.util.ts`), so a hung provider fails and the chain moves on.

## tool-arguments util

- `unwrapArgumentValue` / `cleanToolArguments`: flatten args that small models wrap (`{amount:{amount:15000}}`, `{value:…}`, `{val:…}`, single-key objects).
- `parseAmount`: number or string -> positive integer VND; supports `15k`/`ng`/`nghìn`/`ngàn` (x1000), `15tr`/`triệu`/`m` (x1,000,000), commas stripped; invalid -> 0.
- `normalizeSchemaTypes`: recursive lower-casing of `type` (`OBJECT` -> `object`) for OpenAI/Ollama.

## Tool catalog (`ZALO_TOOL_DEFINITIONS`, 15 tools)

`MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY`.

- Names are `TextToolType` enum values; `TextToolFactory.getStrategy(name)` maps each to a strategy. Unknown name -> `CONVERSATION` (or silence when `allowAiChat === false`).
- `selectToolDefinitions(allowed)` returns an ordered subset; used by `edit <code>` to expose only the pending action's tool. Un-mentioned ZCA group messages never reach the LLM.
- `edit <code>` re-prompts with only the pending action's own tool; a different tool name in the reply is ignored.
- Free chat (`allowAiChat !== false`): tool prompt includes `CHIT_CHAT_INSTRUCTION`; a reply without tool calls is regenerated once with `tools = undefined` so the tool catalog does not bias it toward refusals (costs 2 LLM calls per chit-chat message). No real-time/web grounding: time-sensitive answers come from model knowledge with a staleness note.
- Fast-path commands (`/help`, `/finance`, …) never reach the LLM.

## Shared context propagation

The system prompt asks for one tool call per independent action. There is no call coalescing/batching. After the response, `TextInputService.propagateSharedTransactionContext` runs when there are >= 2 `RECORD_TRANSACTION` calls:
1. If exactly one distinct `occurredAt` is present, fill it into calls missing it.
2. If all present times agree: if exactly one distinct `placeName` (case-insensitive) is present, fill missing ones; same for `paymentMethod`.
Calls then execute sequentially, each creating its own pending confirmation.

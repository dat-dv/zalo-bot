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
      - apps/api/src/config/configuration.ts
      - apps/api/src/zalo/text/text-tool.definitions.ts
      - apps/api/src/zalo/text/text-input.service.ts
      - apps/api/src/zalo/text/strategies/search-chat-history-tool.strategy.ts
---

# LLM Providers

Owner: Core Engineering Team · Status: active

Human guide: [LLM Providers](../../docs/global/llm-providers.md).

## Purpose

`apps/api/src/llm` (`LlmModule`) gives the bot one provider-agnostic entry point for natural-language tool calling. Callers: `TextInputService` (chat intake, edit of pending actions) and `CreateBillPendingImageStrategy` (OCR text of a bill image). `LlmService` is the only LLM entry point.

## LlmService

- `generate(prompt, tools?, systemInstruction?) => Promise<LlmResponse>`; single-turn (one system + one user message). Conversation context is never kept by the provider: when chat memory is on, `TextInputService` appends the latest stored messages of the chat to `systemInstruction` (see `modules/zca/chat-memory.md`).
- `generateMemoryAnswer(prompt, systemInstruction)`: tool-free call for `SEARCH_CHAT_HISTORY`. Uses `llm.memory` (`MEMORY_LLM_BASE_URL`, `MEMORY_LLM_MODEL`, `MEMORY_LLM_API_KEY`) through `OpenAiProvider.generateWithConfig` when the base URL is set, else `generate()` on the main provider.
- Provider chosen per call from config `llm.provider` (`LLM_PROVIDER`, default `gemini`), lower-cased, looked up in a map: `gemini`, `openai`, `qwen`, plus aliases `ollama`, `qwen2.5:14b`, `qwen-14b` -> Qwen. Unknown value falls back to Gemini.
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
| `QwenProvider` | `QWEN_BASE_URL`/`OLLAMA_BASE_URL`, `QWEN_MODEL`/`OLLAMA_MODEL`, `QWEN_API_KEY`/`OLLAMA_API_KEY` | `http://localhost:11434`, `qwen2.5:14b` | Base ending `/v1` or `/chat/completions` -> OpenAI format; else native Ollama `/api/chat` (`stream: false`). Optional Bearer key. Falls back to parsing `<tool_call>{...}</tool_call>` tags in text. |

Failure contract: providers never throw to callers; they return `{ text }` with a Vietnamese error message (missing API key for Gemini/OpenAI, HTTP error, network error; Qwen 404 -> "model not pulled" hint).

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
- Fast-path commands (`/start`, `/finance`, …) never reach the LLM.

## Shared context propagation

The system prompt asks for one tool call per independent action. There is no call coalescing/batching. After the response, `TextInputService.propagateSharedTransactionContext` runs when there are >= 2 `RECORD_TRANSACTION` calls:
1. If exactly one distinct `occurredAt` is present, fill it into calls missing it.
2. If all present times agree: if exactly one distinct `placeName` (case-insensitive) is present, fill missing ones; same for `paymentMethod`.
Calls then execute sequentially, each creating its own pending confirmation.

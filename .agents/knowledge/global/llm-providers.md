---
metadata:
  agent-artifact:
    id: global-llm-providers-knowledge
    type: documentation
    depends_on:
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/llm/llm.module.ts
      - apps/api/src/llm/llm-admin.controller.ts
      - apps/api/src/llm/llm-admin.module.ts
      - apps/api/src/llm/types/llm.types.ts
      - apps/api/src/llm/utils/tool-arguments.util.ts
      - apps/api/src/llm/providers/gemini.provider.ts
      - apps/api/src/llm/providers/openai.provider.ts
      - apps/api/src/llm/providers/qwen.provider.ts
      - apps/api/src/llm/llm-provider-config.service.ts
      - apps/api/src/llm/llm-provider-input.ts
      - apps/api/src/llm/llm-provider-seed.ts
      - apps/api/src/llm/llm-proxy.service.ts
      - apps/api/src/llm/llm-proxy.controller.ts
      - apps/api/src/llm/llm-proxy.module.ts
      - docker-compose.yml
      - apps/web/nginx.conf
      - apps/api/src/database/entities/llm-provider.entity.ts
      - apps/api/src/database/migrations/1725030000000-CreateLlmProviders.ts
      - apps/api/src/common/crypto/secret-cipher.ts
      - apps/api/src/llm/utils/llm-timeout.util.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zca/text/strategies/ask-clarification-tool.strategy.ts
      - apps/api/src/zca/text/text-system-prompt.ts
      - apps/api/src/common/utils/datetime.util.ts
---

# LLM Providers

Owner: Core Engineering Team · Status: active

Human guide: [LLM Providers](../../docs/global/llm-providers.md).

## Purpose

`apps/api/src/llm` (`LlmModule`) gives the bot one provider-agnostic entry point for natural-language tool calling. Callers: `TextInputService` (chat intake, edit of pending actions) and `CreateBillPendingImageStrategy` (OCR text of a bill image). `LlmService` is the only LLM entry point.

## LlmService

- `generate(prompt, tools?, systemInstruction?) => Promise<LlmResponse>`; single-turn (one system + one user message). Conversation context is never kept by the provider: when chat memory is on, `TextInputService` appends the latest stored messages of the chat to `systemInstruction` (see `modules/zca/chat-memory.md`).
- `SEARCH_CHAT_HISTORY` answers with `generate(prompt, undefined, systemInstruction)` (tool-free) through the same chain; there is no memory-specific LLM config.
- Provider chain per call: enabled rows of table `llm_providers`, ordered by `position` (see "Provider table" below), served by `LlmProviderConfigService.getChain()`. Admins edit it on the dashboard; env no longer selects providers. No enabled row -> `{ text: 'Bot chưa được cấu hình AI nào.', failed: true }` and one warning (no env fallback by design: one source of truth).
- Providers are tried in order. A provider is skipped when its response has `failed: true` or is empty (no text, no tool call). First good response wins (fallback use logged at LOG level). All failed -> the last failed response (its Vietnamese error text) is returned, as before the chain existed. No fallbacks configured = single provider, unchanged behavior.
- Current deployment intent: `router` (9router, kind `openai`) then `gemini`, no third link — seeded from the prod env by the migration.
- `TextInputService`: when the tool-calling pass returns `failed` (whole chain failed), it sends that error text once and skips the tool-free chit-chat pass (which would run the chain again); with `allowAiChat === false` it stays silent.
- `LLM_TIMEOUT_MS` (default 30000) applies to every provider, including local Qwen/Ollama; raise it for slow local models.
- Dispatch by row `kind`: `gemini` -> `GeminiProvider`, `openai` -> `OpenAiProvider`, `ollama` -> `QwenProvider`; each client gets the row's `LlmCallConfig { baseUrl, model, apiKey }` on every call. Several rows of one kind (e.g. two routers with different models) are separate links. An unknown kind in a hand-edited row fails that link with a warning.
- `pingProvider(id)`: one tool-free call to that row alone (enabled or not) with a fixed prompt, no user data. It must not use `generate`: the fallback would report OK while the provider is down. Returns `ILlmProviderPingResult` (`name`, `status` ok|empty|failed|not_configured, `latencyMs`); `not_configured` makes no call; unknown id -> null. The provider's error text is dropped, details stay in the server log. Uses `LLM_TIMEOUT_MS`.
- `LlmService` depends on `LlmChainSource` (`getChain`, `findResolved`), injected as `LlmProviderConfigService`; `scripts/eval-intent.ts` passes an in-memory source built from env (`buildLlmProviderSeed`) so the eval needs no database.
- Post-processing: every `toolCall.args` / `toolCalls[].args` passes through `cleanToolArguments`.
- **Prompt layout for provider caching**: both system prompts (`buildToolSystemInstruction`, `generateChitChatReply`) put the static text first (identity line, intent table, parameter rules, `CHIT_CHAT_INSTRUCTION`, plain-text rules) and the per-chat, per-call text last (notes/facts profile, the date-time snippet, pending cards). The date-time snippet stops at the minute (`getVietnamDateTimeContext.systemInstructionSnippet`; the context's `time`/`isoLocal` fields keep seconds). Gemini implicit caching and OpenAI prompt caching only reuse a byte-identical prefix, so with the old order (profile and a clock with seconds first) the several-thousand static tokens were billed and processed in full on every message. Each provider logs `… tokens: prompt=… cached=… output=…` at debug level from the response usage metadata; `cached > 0` from the second call of a chat on shows the cache hitting (needs a model with implicit caching, e.g. Gemini 2.5+ or gpt-4o+).

## Types (`llm/types/llm.types.ts`)

- `LlmToolDefinition { name, description, parameters?: { type?, properties: Record<string, LlmToolProperty>, required? } }`; `LlmToolProperty { type, description?, enum? }`.
- `LlmToolCall { name, args: Record<string, unknown> }`.
- `LlmResponse { text?, toolCall?, toolCalls? }` — `toolCall` is the first of `toolCalls`.
- `LlmCallConfig { baseUrl, model, apiKey }`; `ILlmClient { generate(config, prompt, tools?, systemInstruction?) }`. Clients hold no provider config; only `ConfigService` for `LLM_TIMEOUT_MS`.

## Provider table (`llm_providers`)

Why: the chain used to be hard-coded in env (`LLM_PROVIDER`, `LLM_FALLBACK_PROVIDERS`, `GEMINI_*`, `ROUTER_*`, `OPENAI_*`, `QWEN_*`), one config per kind, and every change needed an env edit plus restart.

| Column | Notes |
| --- | --- |
| `id` uuid | |
| `name` varchar(60) unique | lowercase `[a-z0-9._-]`, shown in logs and the dashboard |
| `kind` | `gemini` \| `openai` (any OpenAI-compatible endpoint, incl. LLM routers) \| `ollama` (`LLM_PROVIDER_KINDS`) |
| `base_url` nullable | null -> `LLM_PROVIDER_DEFAULT_BASE_URLS[kind]` (`openai`: `https://api.openai.com/v1`, `ollama`: `http://localhost:11434`); ignored by `gemini` |
| `model` | required |
| `api_key` nullable | AES-256-GCM `enc:v1:` with `DATA_ENCRYPTION_KEY` (`common/crypto/secret-cipher.ts`, shared with `TokenEncryptionService`); never returned by the API; audit log redacts it (`api_?key` in the subscriber's redact pattern) |
| `enabled` | off = kept but skipped by the chain |
| `position` | call order, lowest first |

- `LlmProviderConfigService` caches all resolved rows (defaults applied, key decrypted) in memory and drops the cache on every write, so edits apply to the next message without restart (single API instance; a failed read is not cached).
- `configured`: `gemini` needs key + model; `openai` needs key + model + base URL; `ollama` needs model + base URL (key optional). A key encrypted with another `DATA_ENCRYPTION_KEY` counts as missing (warned once), never crashes.
- Migration `1725030000000-CreateLlmProviders` creates the table and, **only when it is empty**, seeds it from the env the bot ran with (`buildLlmProviderSeed`, `llm/llm-provider-seed.ts`): chain `[LLM_PROVIDER || gemini, ...LLM_FALLBACK_PROVIDERS]`, legacy aliases (`ollama`/`qwen2.5:14b`/`qwen-14b` -> `qwen` kind `ollama`; `9router` -> `router` kind `openai`), duplicates and unknown names dropped, Gemini alone when nothing is left; same defaults as the old providers. Keys are encrypted with `DATA_ENCRYPTION_KEY` (same `'0'*64` default as `configuration.ts`); an invalid key keeps the row without its API key and logs a warning. Migrations run on API boot (`migrationsRun: true`), so a deploy keeps the prod chain unchanged.
- After the seed, the provider env vars above are read only by that migration (a fresh DB without them gets one `gemini` row without key; add the key on the dashboard). They are removed from `.env.example` and can be deleted from prod env. `scripts/eval-intent.ts` reads the chain from the database (`DATABASE_URL` + `DATA_ENCRYPTION_KEY`). `LLM_TIMEOUT_MS` stays in env.

## Providers

| Client (kind) | Transport |
| --- | --- |
| `GeminiProvider` (`gemini`) | `POST generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=…`; tools as `functionDeclarations`; reads all `functionCall` parts. Missing key or model -> `failed`. |
| `OpenAiProvider` (`openai`) | `POST <base>/chat/completions`, Bearer key; tools as `function`, schema types lower-cased via `normalizeSchemaTypes`. Missing base URL, key or model -> `failed` (no silent `gpt-4o-mini`, a router may not serve it). |
| `QwenProvider` (`ollama`) | Base ending `/v1` or `/chat/completions` -> OpenAI format; else native Ollama `/api/chat` (`stream: false`). Optional Bearer key. Falls back to parsing `<tool_call>{...}</tool_call>` tags in text. |

Failure contract: providers never throw to callers; they return `{ text, failed: true }` with a Vietnamese error message (missing key / model / base URL, HTTP error, network error, timeout; Qwen 404 -> "model not pulled" hint). Every `fetch` uses `AbortSignal.timeout(LLM_TIMEOUT_MS)` (default 30000 ms, `utils/llm-timeout.util.ts`), so a hung provider fails and the chain moves on.

## Admin API (`LlmAdminModule`, `llm-admin.controller.ts`)

Lets an admin manage which LLMs the bot uses and test each one. Every route calls `requireDashboardAdmin` first (paid keys, paid pings). Kept apart from `LlmModule` because `ZcaModule` imports `LlmModule` while the admin check needs `UsersModule`, which imports `ZcaModule`. Bodies are parsed by `llm-provider-input.ts` (400 on invalid input).

- `GET /api/llm/providers` (`API_ROUTES.llmProviders`): every row in call order, off ones included, as `ILlmProviderStatus` (`id`, `name`, `kind`, `baseUrl`, `model`, `enabled`, `role` primary|fallback|null when off, `configured`, `hasApiKey`). Never returns an API key.
- `POST /api/llm/providers` (`ICreateLlmProviderRequest`): adds at the end. Duplicate name -> 409.
- `PATCH /api/llm/providers/:id` (`API_ROUTES.llmProvider`, `IUpdateLlmProviderRequest`): only sent fields change; empty `apiKey` keeps the stored key, `clearApiKey: true` removes it.
- `DELETE /api/llm/providers/:id`: 204.
- `PUT /api/llm/providers/order` (`API_ROUTES.llmProvidersOrder`, `{ ids }`): must list every id once; positions become the index.
- `POST /api/llm/providers/:id/ping` (`API_ROUTES.llmProviderPing`): always 200 with the result; 404 for an unknown id. No server rate limit: admin-only, a few tokens each, the UI locks the row while waiting.
- Writes go through TypeORM, so the audit log (`modules/audit`) records them under table `llm_providers` (group system) with `api_key` redacted.

UI: see `modules/settings/README.md`. The same chain also serves Cognee through the internal gateway below.

## Internal AI gateway for Cognee (`llm-proxy.*`, `LlmProxyModule`)

Why: Cognee (chat-memory container) reads its LLM from env once at start and cannot read our DB, so it used a separate `COGNEE_LLM_*` config with no fallback. Now it calls the API, which forwards over the same dashboard chain.

- `POST /api/internal/llm/v1/chat/completions` (`API_ROUTES.internalLlmChatCompletions`), OpenAI chat-completions format. Compose sets Cognee `LLM_PROVIDER=custom`, `LLM_ENDPOINT=http://api:<BE_PORT>/api/internal/llm/v1`, `LLM_MODEL=openai/zalobot` (ignored), `LLM_API_KEY=${COGNEE_USER_PASSWORD}`.
- Auth: `Authorization: Bearer <COGNEE_USER_PASSWORD>` (`isAuthorizedBearer`, sha256 + `timingSafeEqual`); empty password (Cognee off) = always 401. The web nginx answers 404 for `/api/internal/`, so only containers on the Docker network reach it. Excluded from Swagger.
- `LlmProxyService.chatCompletions(body)`: body must be an object with non-empty `messages`; `stream: true` -> 400 (Cognee calls without streaming). The body is forwarded **as is** (messages, tools, tool_choice, response_format…) with only `model` replaced by each row's model, so Cognee's structured output needs no translation. Prompts are never logged, only `Memory LLM call via "<name>" -> <status> (<ms>ms)`.
- Targets (`proxyTargetFor`), enabled chain rows in order: `openai` -> `<baseUrl>/chat/completions`; `gemini` -> `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (Google's OpenAI-compatible endpoint, Bearer key); `ollama` only when the base URL ends with `/v1` (or `/chat/completions`), native `/api/chat` rows are skipped with one warning; unconfigured rows skipped.
- Next row when: network error/timeout (`LLM_PROXY_TIMEOUT_MS` 180 s per row, longer than chat), any non-2xx, or a 2xx without a usable first choice (`hasUsableChoice`: text or tool calls). All failed -> last status/body (2xx without choice -> 502). No usable row -> 503. Route timeout `LLM_PROXY_REQUEST_TIMEOUT_MS` 600 s.
- Cost: memory ingest (one call per ~1500-token chunk) now shares the quota of the chat chain. The 60-min ingest pause on a failing memory LLM (`modules/zca/chat-memory.md`) still applies.


## tool-arguments util

- `unwrapArgumentValue` / `cleanToolArguments`: flatten args that small models wrap (`{amount:{amount:15000}}`, `{value:…}`, `{val:…}`, single-key objects).
- `parseAmount`: number or string -> positive integer VND; supports `15k`/`ng`/`nghìn`/`ngàn` (x1000), `15tr`/`triệu`/`m` (x1,000,000), commas stripped; invalid -> 0.
- `normalizeSchemaTypes`: recursive lower-casing of `type` (`OBJECT` -> `object`) for OpenAI/Ollama.

## Tool catalog (`ZALO_TOOL_DEFINITIONS`, 16 tools)

`MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY`, `ASK_CLARIFICATION`.

- `ASK_CLARIFICATION { question }`: asks for a required detail the LLM cannot infer, called next to the tools for the parts it could do (system prompt rule "THIẾU THÔNG TIN"). `TextInputService` runs these calls after the other calls of the same reply; sent even when `allowAiChat === false`. See [zca](../modules/zca/README.md).
- Reminder tools: `repeatingTimes[].repeatType` enum `daily|weekdays|weekly|monthly|yearly`; the prompt maps annual occasions to `SET_REMINDER` + `yearly` (never `monthly`), `at` = nearest future occurrence.

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

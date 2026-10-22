---
metadata:
  agent-artifact:
    id: zca-chat-memory-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/memory/chat-memory.service.ts
      - apps/api/src/zca/memory/chat-memory.mapper.ts
      - apps/api/src/zca/memory/chat-memory.query.ts
      - apps/api/src/zca/memory/chat-memory.module.ts
      - apps/api/src/database/entities/zca-message.entity.ts
      - apps/api/src/database/migrations/1724810000000-CreateZcaMessages.ts
      - apps/api/src/database/migrations/1724820000000-AddChatMemoryToZcaThreadConfigs.ts
      - apps/api/src/database/audit-log.subscriber.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zalo/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zalo/text/text-input.service.ts
      - apps/api/src/llm/llm.service.ts
      - packages/contracts/src/index.ts
      - apps/web/src/modules/zca/view/thread-config-modal.tsx
---

# ZCA Chat Memory

Owner: Core Engineering Team · Status: active (Step 1: storage + full-text search + short-term window, switched per thread)

Human guide: [Trí nhớ hội thoại](../../../docs/modules/zca/chat-memory.md). Design records: `.agents/artifacts/chat-memory-recall/`, `.agents/artifacts/chat-memory-per-thread-config/`.

## Purpose

The bot answers questions about past conversations of the current Zalo chat ("năm ngoái mình đi đâu?", "hôm trước Nam nói gửi file gì?"). LLM calls are stateless, so memory lives in Postgres and only matched snippets are sent to the LLM.

## Per-thread switch (`ThreadBotConfig.chatMemory`)

Configured per ZCA thread in the dashboard thread-config modal (card "🧠 Trí nhớ hội thoại"), stored in `zca_thread_configs.chat_memory` (jsonb, migration `1724820000000-AddChatMemoryToZcaThreadConfigs`). There are no env vars; the former global `CHAT_MEMORY_*` env switches were removed.

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | | Store, search and inject this thread's messages. Off for every thread until an admin enables it. |
| `contextWindow` | `10` | 0–30 | Latest messages injected into the LLM prompt (`0` = off). |
| `searchLimit` | `15` | 1–50 | Ranked hits per search (each expanded with neighbours). |

- `normalizeChatMemoryConfig` (`@zalobot/contracts`, with `CHAT_MEMORY_DEFAULTS`, `CHAT_MEMORY_LIMITS`) fills defaults, rounds and clamps. Applied on default creation, `entityToConfig`, cached Redis/JSON configs, the `updateConfig` merge and the web form. `PUT /api/zca/thread-configs/:id` has no class-validator DTO, so this is the guard.
- Memory needs `isListened` **and** `chatMemory.enabled` (only listened threads receive messages). Official Zalo Bot webhook chats are never stored.
- Turning memory off stops storing, searching and context injection; rows already stored are **kept** and reused if it is turned on again. Turning it on stores from then; buffered Redis messages are imported at the next start.
- Dashboard chat table shows badge "🧠 Nhớ" for threads with memory on.
- `ChatMemoryService` has no switch of its own and no ZcaModule dependency (avoids a module cycle); callers gate on the thread config.

## Storage (`zca_messages`, migration `1724810000000-CreateZcaMessages`)

- Columns: `channel_id`, `channel_type`, `msg_id` (unique with `channel_id`), `cli_msg_id`, `sender_uid` (= `users.id` on ZCA), `sender_name`, `is_bot`, `msg_type`, `text`, `content` (jsonb), `quote_msg_id`, `sent_at` (from zca `ts`), `recalled_at`, `created_at`, generated `search_vector`.
- `search_vector = to_tsvector('simple', zalobot_unaccent(coalesce(text,'')))`. `zalobot_unaccent` is an IMMUTABLE wrapper over the `unaccent` extension (created by the migration; needs `CREATE EXTENSION` privilege). Accent-insensitive: "da lat" matches "Đà Lạt".
- Indexes: `(channel_id, sent_at DESC)`, GIN(`search_vector`).
- `text` (`buildMemoryText`): plain text, or `[Ảnh] <caption>`, `[Video]`, `[Ghi âm]`, `[Sticker]`, `[File: name]`…; max 2000 chars. `content` keeps only `title/description/text/fileName/name`; media URLs are dropped (Zalo CDN links expire, may be signed).
- Retention: unlimited (Step 1). Excluded from `AuditLogSubscriber` (`ignoredTables`): chat logs are not business mutations.
- Schema is migration-owned; `TYPEORM_SYNCHRONIZE` must stay `false` (entity does not declare the generated column / GIN index).

## Write paths (never throw, fire-and-forget)

| Event | Hook | Behavior |
| --- | --- | --- |
| Incoming message | `ZcaBotFeatureService.onMessage`, right after the `isListened` gate, before self/trigger filters; only when `config.chatMemory.enabled` | `record` → `INSERT … ON CONFLICT DO NOTHING`. Includes un-addressed group messages (stored, never sent to LLM unless asked). |
| Bot reply | `ZcaService.setupApiInstance` wrapper after `sendMessage` returns `msgId` → `recordBotReplyInMemory`: listened thread and `findStoredConfig(threadId).chatMemory.enabled` | `recordBotReply` → upsert `is_bot = true` (self-listen echo may arrive first) |
| Recall (`undo`) by a member | `ZcaBotFeatureService.onUndo`; **always**, even when the thread has memory off now | `markRecalled(threadId, content.globalMsgId, { cliMsgId, senderUid: data.uidFrom })`: matches `msg_id`, or `cli_msg_id` **with** the same `sender_uid` (client ids are not unique across senders); sets `recalled_at`, erases `text` and `content`. Recalled rows never appear in reads. |
| Recall by the bot account (confirmation cards, owner unsends) | `ZcaService.undo` after `api.undo` succeeds | `markRecalled(threadId, msgId)`. Needed because zca-js drops the account's own undo events unless `ZCA_SELF_LISTEN` is on, so `onUndo` never sees them. |
| Startup backfill | `ZcaBotFeatureService.init` (plugin init after listened threads load); listened threads with `chatMemory.enabled` only | Re-imports Redis buffer `zca:buffered_msgs:<threadId>` (≤200 msgs, 7 days); idempotent. No Zalo history API call. |

Owner's own phone messages (`isSelf`, not bot-sent) are stored only when zca-js delivers them (`ZCA_SELF_LISTEN`).

## Read paths (always filtered by the asking `chat_id`)

- **Channel isolation**: every query has `channel_id = <current chat>`; a question in thread A never reads thread B.
- **Thread settings reach the text pipeline** as `AgentInput.chatMemory = { contextWindow, searchLimit }`, set by `onMessage` (text and image paths, both also set `AgentInput.messageId`) only when the thread has memory on; absent for memory-off threads, webhook chats and unlistened chats.
- **Tool catalog per chat**: `textToolDefinitionsFor({ chatMemory })` leaves `SEARCH_CHAT_HISTORY` (and its system-prompt line) out when `input.chatMemory` is absent, so such questions keep the chit-chat / silent behaviour of the thread.
- **`SEARCH_CHAT_HISTORY` tool** (read-only, no pending action). Without `input.chatMemory` it replies that the thread has not enabled chat memory (enable it in the dashboard "Cấu hình kênh"). Args (flat strings): `keywords` (comma-separated keywords + synonyms generated by the LLM), `fromDate`/`toDate` (`YYYY-MM-DD`, inclusive, in `timezone` config, default `Asia/Ho_Chi_Minh`), `question`.
  1. Hit query: OR of `plainto_tsquery('simple', zalobot_unaccent(kw))` (≤12 keywords), `recalled_at IS NULL`, `NOT is_bot` (earlier bot answers are not evidence), `msg_id <> <asking message>` (the question always matches its own keywords), optional date range, ranked by `ts_rank` then recency, `LIMIT <thread searchLimit>`. Bot rows can still appear as neighbours.
  2. Neighbour query: per hit 3 messages before + hit + 3 after (same channel, not recalled).
  3. `selectMemoryLines`: dedupe, keep best-ranked hits first, cap `MAX_MEMORY_LINES = 80`, sort chronologically.
  4. No lines → "không tìm thấy … từ <from> đến <to>". Else lines `[yyyy-mm-dd HH:mm] <sender|Bot>: text` + question → `LlmService.generate(prompt, undefined, system)` through the shared provider chain (tool-free; answer only from snippets, cite date + speaker, say when unsure).
- **Short-term window**: `TextInputService.buildRecentContextBlock` appends the latest `input.chatMemory.contextWindow` messages (excluding `AgentInput.messageId`, the message being processed) to the tool-calling and chit-chat system prompts, under a header forbidding tool calls for its content (prevents re-recording old transactions). Skipped when `input.chatMemory` is absent or `contextWindow` is 0.

## Data disclosure

Approved exception to local-first AI (see `global/local-first-ai-usage.md`): only the ≤80 matched lines and the short window leave the server, never the full history, and only for threads an admin enabled. Memory answers use the shared provider chain (`LLM_PROVIDER` + `LLM_FALLBACK_PROVIDERS`); there is no memory-specific LLM config. To keep them on-prem, run the whole chain on `qwen`. The raw ZCA payload log is DEBUG-level.

## Not in Step 1

Daily/monthly summaries (episodic memory, best for aggregate questions), pgvector semantic search, retention job, purge of a thread's stored messages, dashboard view of stored messages.

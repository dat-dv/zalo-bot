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
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/llm/llm.service.ts
      - packages/contracts/src/index.ts
      - apps/web/src/modules/zca/view/thread-config-screen.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/short-term-memory-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/long-term-memory-section.tsx
      - apps/api/src/zca/memory/short-term-memory.service.ts
      - apps/web/src/modules/zca/model/thread-config-form.ts
---

# ZCA Chat Memory

Owner: Core Engineering Team · Status: active (Step 1: long-term storage + full-text search, short-term window in Redis; two independent per-thread switches)

Human guide: [Trí nhớ hội thoại](../../../docs/modules/zca/chat-memory.md). Design records: `.agents/artifacts/chat-memory-recall/`, `.agents/artifacts/chat-memory-per-thread-config/`, `.agents/artifacts/chat-memory-short-long-split/`.

## Purpose

LLM calls are stateless, so the bot keeps two independent memories per Zalo chat:

| | Short-term | Long-term |
| --- | --- | --- |
| Purpose | Follow-ups in a running chat ("còn cái kia?", "ghi giúp cái đó") | Questions about the past ("hôm trước Nam nói gửi file gì?") |
| Used | Every bot turn (prompt block) | Only when the LLM calls `SEARCH_CHAT_HISTORY` |
| Store | Redis `zca:short_memory:<threadId>`, `ShortTermMemoryService` | Postgres `zca_messages`, `ChatMemoryService` |
| Lifetime | Messages sent within the last `shortTermDays` (1–7, default 1) | Unlimited |
| Switch | `chatMemory.shortTermEnabled` | `chatMemory.enabled` |

Turning one off never turns the other off.

## Per-thread switches (`ThreadBotConfig.chatMemory`)

Configured per ZCA thread on the dashboard thread config page `/zca/thread?id=…` (cards "💬 Trí nhớ ngắn hạn" and "🧠 Trí nhớ dài hạn"), stored in `zca_thread_configs.chat_memory` (jsonb, migration `1724820000000-AddChatMemoryToZcaThreadConfigs`). There are no env vars; the former global `CHAT_MEMORY_*` env switches were removed.

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | | Long-term memory: store messages in Postgres and offer the history search. Name kept from before the split so stored configs still read. |
| `shortTermEnabled` | `false` | | Short-term memory: keep the latest messages in Redis and add them to the prompt. |
| `contextWindow` | `10` | 1–30 | Messages of the short-term window. |
| `shortTermDays` | `1` | 1–7 | Short-term memory only uses messages sent within this many days (counted per message). Missing in older configs → 1 (the former fixed 24 h). |
| `searchLimit` | `15` | 1–50 | Ranked hits per search (each expanded with neighbours). |

Both are off for every new thread until an admin enables them.

- `normalizeChatMemoryConfig` (`@zalobot/contracts`, with `CHAT_MEMORY_DEFAULTS`, `CHAT_MEMORY_LIMITS`) fills defaults, rounds and clamps. Applied on default creation, `entityToConfig`, cached Redis/JSON configs, the `updateConfig` merge and the web form. `PUT /api/zca/thread-configs/:id` has no class-validator DTO, so this is the guard.
- **Configs saved before `shortTermEnabled` existed** (one switch for both, window off via `contextWindow: 0`): `shortTermEnabled = enabled && contextWindow > 0`, and a `0` window becomes the default 10. Each thread keeps the behaviour it had.
- UI: two `ConfigSectionCard`s (`short-term-memory-section.tsx`, `long-term-memory-section.tsx`), each with its own switch, in the right column of the thread config form. Short-term: fields "Số tin gần đây" and "Nhớ trong (ngày)" side by side (one column on mobile), warning names the configured days. Long-term: a "Cách hoạt động" list (what is stored, how to ask, what the AI sees, scope and recall, limits) so admins know what they enable, then "Số kết quả mỗi lần tra".
- Either memory needs `isListened` (only listened threads receive messages).
- Turning long-term off stops storing and searching; rows already stored are **kept** and reused if it is turned on again. Turning it on stores from then; buffered Redis messages are imported at the next start.
- Turning short-term off stops recording and injecting; the Redis list is left to expire.
- Dashboard chat table, Features column: `Ngữ cảnh` for short-term on, `Nhớ` for long-term on.
- Neither memory service has a switch of its own or a ZcaModule dependency (avoids a module cycle); both live in `ChatMemoryModule` and callers gate on the thread config.

## Short-term store (`ShortTermMemoryService`)

- Redis list `zca:short_memory:<threadId>` of JSON entries `{ msgId, cliMsgId, senderUid, senderName, isBot, text, sentAt }`; `text` from `buildMemoryText` (same labels as long-term). Entries without an id or text are skipped.
- `rpush` + `ltrim` to `SHORT_TERM_MEMORY_MAX_ENTRIES` (60 = 2 × max window, because a bot reply can be stored twice: send result and self-listen echo) + `expire` `shortTermTtlSeconds(shortTermDays)` on every write (`record` / `recordBotReply` take the thread's days), so a chat quiet for that long loses its list.
- `getRecent(threadId, { limit, maxAgeDays, excludeMsgId })`: drops entries whose `sentAt` is older than `maxAgeDays` (age counts per message: a chat that never goes quiet still forgets), merges copies by `msgId` (bot flag wins), sorts by `sentAt`, returns the last `limit` as `MemoryLine[]`.
- A recall rewrite does not know the thread's days and sets the expiry to the 7-day maximum; reads still filter by age.
- `markRecalled`: same matching rule as long-term (`msg_id`, or `cli_msg_id` with the same sender); rewrites the list without the entry.
- Without Redis: in-process Map with the same cap and expiry (lost on restart). Never throws.
- Not backfilled at startup and not read by the history search.

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
| Incoming message | `ZcaBotFeatureService.onMessage`, right after the `isListened` gate, before self/trigger filters | `shortTermEnabled` → `ShortTermMemoryService.record`; `enabled` → `ChatMemoryService.record` → `INSERT … ON CONFLICT DO NOTHING`. Includes un-addressed group messages (stored, never sent to LLM unless the bot is addressed). |
| Bot reply | `ZcaService.setupApiInstance` wrapper after `sendMessage` returns `msgId` → `recordBotReplyInMemory`: listened thread, per switch of `findStoredConfig(threadId).chatMemory` | Short-term `recordBotReply` (append `isBot`); long-term `recordBotReply` → upsert `is_bot = true` (self-listen echo may arrive first) |
| Recall (`undo`) by a member | `ZcaBotFeatureService.onUndo`; **always**, both memories, even when the thread has them off now | `markRecalled(threadId, content.globalMsgId, { cliMsgId, senderUid: data.uidFrom })`: matches `msg_id`, or `cli_msg_id` **with** the same `sender_uid` (client ids are not unique across senders); sets `recalled_at`, erases `text` and `content`. Recalled rows never appear in reads. |
| Recall by the bot account (confirmation cards, owner unsends) | `ZcaService.undo` after `api.undo` succeeds | `markRecalled(threadId, msgId)` on both memories. Needed because zca-js drops the account's own undo events unless `ZCA_SELF_LISTEN` is on, so `onUndo` never sees them. |
| Startup backfill | `ZcaBotFeatureService.init` (plugin init after listened threads load); listened threads with `chatMemory.enabled` only | Re-imports Redis buffer `zca:buffered_msgs:<threadId>` (≤200 msgs, 7 days); idempotent. No Zalo history API call. |

Owner's own phone messages (`isSelf`, not bot-sent) are stored only when zca-js delivers them (`ZCA_SELF_LISTEN`).

## Read paths (always filtered by the asking `chat_id`)

- **Channel isolation**: every query has `channel_id = <current chat>`; a question in thread A never reads thread B.
- **Thread settings reach the text pipeline** as `AgentInput.shortTermMemory = { contextWindow }` and `AgentInput.longTermMemory = { searchLimit }`, set by `onMessage` (text and image paths, both also set `AgentInput.messageId`), each only when its switch is on; absent for unlistened chats.
- **Tool catalog per chat**: `textToolDefinitionsFor({ longTermMemory })` leaves `SEARCH_CHAT_HISTORY` (and its system-prompt line) out when `input.longTermMemory` is absent, so such questions keep the chit-chat / silent behaviour of the thread.
- **`SEARCH_CHAT_HISTORY` tool** (read-only, no pending action). Without `input.longTermMemory` it replies that the thread has not enabled chat memory (enable it in the dashboard "Cấu hình kênh"). Args (flat strings): `keywords` (comma-separated keywords + synonyms generated by the LLM), `fromDate`/`toDate` (`YYYY-MM-DD`, inclusive, in `timezone` config, default `Asia/Ho_Chi_Minh`), `question`.
  1. Hit query: OR of `plainto_tsquery('simple', zalobot_unaccent(kw))` (≤12 keywords), `recalled_at IS NULL`, `NOT is_bot` (earlier bot answers are not evidence), `msg_id <> <asking message>` (the question always matches its own keywords), optional date range, ranked by `ts_rank` then recency, `LIMIT <thread searchLimit>`. Bot rows can still appear as neighbours.
  2. Neighbour query: per hit 3 messages before + hit + 3 after (same channel, not recalled).
  3. `selectMemoryLines`: dedupe, keep best-ranked hits first, cap `MAX_MEMORY_LINES = 80`, sort chronologically.
  4. No lines → "không tìm thấy … từ <from> đến <to>". Else lines `[yyyy-mm-dd HH:mm] <sender|Bot>: text` + question → `LlmService.generate(prompt, undefined, system)` through the shared provider chain (tool-free; answer only from snippets, cite date + speaker, say when unsure).
- **Short-term window**: `TextInputService.buildRecentContextBlock` appends `ShortTermMemoryService.getRecent(chatId, { limit: contextWindow, maxAgeDays: days, excludeMsgId: AgentInput.messageId })` from `input.shortTermMemory = { contextWindow, days }` (the message being processed is excluded) to the tool-calling and chit-chat system prompts, under a header forbidding tool calls for its content (prevents re-recording old transactions). Skipped when `input.shortTermMemory` is absent. Independent of the long-term memory.

## Data disclosure

Approved exception to local-first AI (see `global/local-first-ai-usage.md`): only the ≤80 matched lines (long-term) and the ≤30-message short-term window leave the server, never the full history, and each only for threads where an admin enabled that memory. Memory answers use the shared provider chain (`LLM_PROVIDER` + `LLM_FALLBACK_PROVIDERS`); there is no memory-specific LLM config. To keep them on-prem, run the whole chain on `qwen`. The raw ZCA payload log is DEBUG-level.

## Not in Step 1

Daily/monthly summaries (episodic memory, best for aggregate questions), pgvector semantic search, retention job, purge of a thread's stored messages, dashboard view of stored messages.

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
      - apps/api/src/zca/memory/memory-kind.ts
      - apps/api/src/zca/memory/memory-text.util.ts
      - apps/api/src/zca/memory/memory-profile.util.ts
      - apps/api/src/zca/memory/channel-notes.service.ts
      - apps/api/src/zca/memory/learned-facts.service.ts
      - apps/api/src/zca/memory/channel-memory.controller.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
      - apps/api/src/zca/memory/long-term/local-embedder.ts
      - apps/api/src/zca/memory/long-term/embedding-text.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.service.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.processor.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.jobs.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.scheduler.ts
      - apps/api/src/database/migrations/1725040000000-AddMessageEmbeddings.ts
      - apps/api/src/zca/text/strategies/sync-memory-tool.strategy.ts
      - apps/api/src/database/entities/zca-message.entity.ts
      - apps/api/src/database/entities/zca-channel-note.entity.ts
      - apps/api/src/database/entities/zca-learned-fact.entity.ts
      - apps/api/src/database/migrations/1724810000000-CreateZcaMessages.ts
      - apps/api/src/database/migrations/1724820000000-AddChatMemoryToZcaThreadConfigs.ts
      - apps/api/src/database/migrations/1724980000000-AddChatMemoryV2.ts
      - apps/api/src/database/audit-log.subscriber.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/confirmation/dto-descriptor.util.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/zca.module.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zca/text/strategies/remember-note-tool.strategy.ts
      - apps/api/src/zca/text/strategies/forget-memory-tool.strategy.ts
      - apps/api/src/zca/text/strategies/dashboard-tool.strategy.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/reminders/reminder-target.service.ts
      - apps/api/src/users/user-merge.service.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/ocr/ocr.service.ts
      - packages/contracts/src/index.ts
      - docker-compose.yml
      - docker/postgres/Dockerfile
      - apps/api/Dockerfile
      - apps/web/src/modules/zca/view/thread-config-screen.tsx
      - apps/web/src/modules/zca/api/zca-api.ts
      - apps/web/src/modules/zca/api/zca-query.ts
      - apps/web/src/modules/zca/model/thread-config-form.ts
      - apps/web/src/modules/zca/model/channel-memory.ts
      - apps/web/src/modules/zca/presentation/components/thread-config/thread-config-form.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/long-term-memory-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/learned-facts-panel.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/image-text-memory-section.tsx
---

# ZCA Chat Memory

Owner: Core Engineering Team · Status: active (v3: one Postgres store with message kinds, per-chat notes, local embeddings in pgvector; Cognee removed 2026-11-17)

Human guide: [Trí nhớ hội thoại](../../../docs/modules/zca/chat-memory.md). Design records: `.agents/artifacts/chat-memory-recall/`, `chat-memory-per-thread-config/`, `chat-memory-short-long-split/`, `chat-memory-image-text/`, `chat-memory-persona-forgetting/`, `chat-memory-cognee/`, `chat-memory-long-term-v2/`, `memory-config-cleanup/`, `local-vector-memory/` (why Cognee went: 2026-11-16 prod log, ~19k memory LLM calls/day, 313 succeeded, every Google key 429).

## Purpose

LLM calls are stateless. The bot keeps three memory layers per Zalo chat (`channelId`); a chat never reads another chat's memory.

| Layer | What | In the prompt | Written by | Switch |
| --- | --- | --- | --- | --- |
| **Notes (Ghi nhớ)** | What the chat told the bot to always remember (persona, conventions), ≤20 × 200 chars | Every turn, right after the identity line | Members via `REMEMBER_NOTE` / `FORGET_MEMORY` in the chat, saved at once (no dashboard UI) | none (always on) |
| **Learned facts** | Stable facts about the bot and members, ≤5 per subject. **Frozen**: nothing learns new ones since the nightly LLM job was removed (owner's decision 2026-11-17: no LLM in the memory pipeline) | Every turn: bot + sender + tagged, ≤15 lines | Earlier nightly job (removed) | `chatMemory.enabled` |
| **Long-term** | Every message (Postgres) + one local embedding per hit-able message (`zca_message_embeddings`, pgvector) | Only via `SEARCH_CHAT_HISTORY` | Every listened message; embedded ~20 s after the chat goes quiet, `/sync`, boot sweep, nightly sweep | `chatMemory.enabled` |

Redis keeps only transient state (pending cards, temp messages to recall, ZCA session, rate limits, cache, BullMQ). The former Redis list `zca:short_memory:<threadId>` is no longer written and expires.

**No short-term window** (removed 2026-10-26, owner's decision): no recent messages go into the prompt, so each message is handled on its own. Follow-ups that amend a pending card ("tag @Nam nha", `yes/cancel/edit <code>`) do not need it: they use the sender's pending cards in Redis (5-minute TTL, `AMEND_PENDING`). Configs saved with `shortTermEnabled`/`contextWindow`/`shortTermDays` are cleaned by the normalizer.

## Per-thread config (`ThreadBotConfig.chatMemory`, jsonb `zca_thread_configs.chat_memory`)

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | | Long-term memory: keep rows, embed them, history search. |
| `readImageText` | `true` | | Local OCR of photos into the stored row (needs `enabled`). |
| `learnPeople` | `true` | | Ignored (kept so stored configs round-trip); no UI. |

`normalizeChatMemoryConfig` (`@zalobot/contracts`) fills defaults (missing `readImageText`/`learnPeople` → `true`) and drops keys of removed options (`shortTermEnabled`, `contextWindow`, `shortTermDays`, `searchLimit`). The memory needs `isListened`. Notes need neither. Hits per history search are not a setting: the agent picks them (see History search).

## One store: `zca_messages` with `memory_kind`

Migration `1724980000000-AddChatMemoryV2` added `memory_kind varchar default 'chat'` (existing bot rows → `bot_chat`) and `expires_at`.

| Kind | Set by | Embedded | Search hit (keyword + meaning) |
| --- | --- | --- | --- |
| `chat` | Member message (default) | ✅ | ✅ |
| `request` | Member message that became a tool call (`TextInputService`) or a `yes/cancel/edit <code>` command | ✅ | ✅ |
| `action` | Row written after a confirmed tool call **ran successfully** | ✅ | ✅ |
| `bot_chat` | Bot message (default) | ❌ | neighbour only |
| `tool` | Answers of read-only tools (`GET_REPORT`, `LIST_TASKS`, `LIST_CALENDAR_EVENTS`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY`) | ❌ | neighbour only |
| `reminder` | Reminder deliveries (`ReminderTargetService.deliver`) | ❌ | neighbour only |
| `result` | "✅ [358] …" success notices | ❌ | ❌ |
| `card` | Confirmation cards | ❌ | ❌ |
| `system` | Timeout / cancel / heart notices and any other message of `TransactionConfirmationService` | ❌ | ❌ |
| `secret` | Dashboard sign-in link + code; text stored as `[Link đăng nhập dashboard]` | ❌ | ❌ |

- Bot kinds are tagged with `OutgoingMemoryKind.run(kind, fn)` (`memory-kind.ts`, AsyncLocalStorage, like `AuditContext`). The `api.sendMessage` wrapper in `ZcaService.setupApiInstance` reads it before awaiting; `TransactionConfirmationService` wraps its messenger so its sends default to `system` (cards run under `card`, `executeConfirmed` under `result`).
- `recordBotReply` upserts `is_bot`, `memory_kind`, `text`, `content` (self-listen echo stored first is overwritten; a `secret` echo loses its text). `onMessage` skips the bot's own echo when `isBotSentMessage`.
- Retention: rows are stored only while the long-term memory is on (messages, bot replies, done actions, photo text); new rows never get `expires_at`. Rows with `expires_at` are leftovers of the removed short-term memory: the nightly job deletes them once expired (`purgeExpired`), and search and embedding ignore them.
- `content` keeps only `title/description/text/fileName/name`; `text` ≤2000 chars (`buildMemoryText`); photo with OCR text → `[Ảnh] <caption> — chữ trong ảnh: …`.
- Recall (`onUndo`, `ZcaService.undo`): `markRecalled` erases `text`/`content`, sets `recalled_at`, deletes the embeddings of the recalled row and of the rows sent up to `EMBEDDING_CONTEXT_WINDOW_MS` (10 min) after it in the chat (their embedding text read it as context), notifies the change listeners (re-embedded ~20 s later without it) and resolves the recalled rows' `sent_at`.
- Excluded from `AuditLogSubscriber`: `zca_messages`, `zca_learned_facts` (`zca_message_embeddings` has no entity, so it is never audited). `zca_channel_notes` is audited.

## Tool calls reach memory only after success (D6)

- Pending cards stay in Redis (`TransactionConfirmationService`, unchanged keys `pending:tx:*`).
- `executeConfirmed`: each branch posts its summary via `post(summary, remember)`; after the switch, only when no exception was thrown, `recordConfirmedAction` writes one `action` row: `msg_id = action:<code>:<createdAt>`, sender = requester (`pending.userId`, name from `UsersService.resolveZaloNames` or the requester's last `sender_name` in the chat), text = `confirmedActionText(summary)` (emoji and `[code]` removed, lines joined with ` · `, prefixed `(đã duyệt)`). Only when the chat is listened with the long-term memory on.
- Not written: cancel, timeout, edit intermediates, failed execution, delete-not-found, `BAN_USER`, the generic fallback. Notes are done at once (no card) and recorded by their strategy through the same `recordDoneAction` (`memory/action-memory.ts`).
- Companion place: the transaction summary already names the place.
- Prompt rule `CURRENT_DATA_RULE`: current money/debt/calendar/task/reminder data must come from tools, never from memory.

## Notes (Ghi nhớ)

- Table `zca_channel_notes` (`channel_id`, `text varchar(200)`, `created_by`, `source_msg_id`); `ChannelNotesService` (list oldest first, add/update/remove, `findMatching` accent-insensitive all-words). Limits `CHANNEL_NOTES_LIMITS` (20, 200).
- Tool `REMEMBER_NOTE { text, reply?, replaceNoteId? }` (routing: see `global/zalo-command-intake.md`, lasting facts about the bot or group with no time and no task): **saved at once, no confirmation card** (owner's decision 2026-10-26: a pending card nobody approved dropped "mày là con mèo đen"). The strategy rejects empty/too long, maps `n2` to the 2nd note and updates it, else adds (limit → refusal text); a duplicate (folded) is not saved again. It then sends the LLM's in-character `reply` (≤500 chars; fallback `Dạ em nhớ rồi: <text>`) as `bot_chat`, and writes the `action` row `(đã duyệt) Đã ghi nhớ: …` via `recordDoneAction`.
- Tool `FORGET_MEMORY { query, reply? }`: forgets at once the notes and active learned facts containing every word (≤5; more → asks to narrow; none → "không nhớ điều gì khớp"); facts are soft-deleted with `deleted_by` = sender; answers with `reply` or a line listing what was forgotten. Not written to memory.
- Prompt (`TextInputService`, both the tool pass and the chit-chat pass): `BOT_IDENTITY_LINE` ("…nếu phần ĐIỀU ĐƯỢC DẶN mô tả bạn khác đi… thì luôn theo phần đó") + `buildMemoryProfileBlock` (notes as `[n1] …`, then learned facts) before the date context. Built whatever the memory switches; learned facts only when long-term is on.
- Notes are managed only in the chat; the dashboard has no notes UI (removed 2026-10-26). The notes API below is kept without a web caller.

## Long-term memory: local embeddings (no LLM)

Owner's decision 2026-11-17 (`.agents/artifacts/local-vector-memory/`): the memory pipeline makes **no LLM call**. Cognee (graph built by the LLM per chunk) burned the free Google quota shared with chat replies and left 49 chat days `failed`; the data is small (~65 messages/day), so meaning search over local embeddings is enough.

### Storage

- Postgres image `docker/postgres/Dockerfile`: `postgres:16-alpine` + pgvector 0.8.1 built from source. Same Alpine/musl base as the existing volume, so the `en_US.utf8` collation (and every text index) is unchanged; the official pgvector image is Debian/glibc and would need a `REINDEX`. Compose (`docker-compose.yml`, `docker-compose.local.yml`) builds it as `zalobot-postgres:16-pgvector`.
- Migration `1725040000000-AddMessageEmbeddings`: `CREATE EXTENSION vector`; table `zca_message_embeddings` (`message_id uuid` PK → `zca_messages(id) ON DELETE CASCADE`, `channel_id`, `embedding vector(384)`, `model varchar(120)`, `created_at`), index (`channel_id`, `model`); drops `zca_memory_segments` and `zca_memory_ingestions` (Cognee bookkeeping only). No TypeORM entity (no vector type): rows are read and written with SQL.
- No HNSW index: every search is scoped to one chat (a few thousand rows), an exact scan is fast and an approximate index would drop matches once filtered by channel/date. Add HNSW only if one chat grows past ~100k rows.
- `model` holds the model id: rows of another model count as missing and are re-embedded (switching model = automatic full re-embed).

### Embedder (`LocalEmbedder`, `long-term/local-embedder.ts`, provided by `ChatMemoryModule`)

- transformers.js (`@huggingface/transformers` 4.3.2, ONNX runtime, CPU) pipeline `feature-extraction`, `dtype: 'q8'`, mean pooling, normalized → 384-dim vectors (`EMBEDDING_DIMENSIONS`). Model `memory.embeddingModel` (`EMBEDDING_MODEL`, default `DEFAULT_EMBEDDING_MODEL` = `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, ~120 MB); files read from `memory.embeddingModelDir` (`EMBEDDING_MODEL_DIR`, default `<DATA_DIR>/models`; the API image sets `/app/models` and bakes the model in a build stage, so prod never downloads it; in dev the first use downloads it there).
- Loaded lazily (dynamic import, so tests never load ONNX); a failed load sets state `failed`, logs once and is retried after `EMBEDDER_RETRY_MS` (10 min). Batches of 8 (`EMBED_BATCH_SIZE`), input cut at 500 chars (`EMBED_MAX_CHARS`, MiniLM was trained on 128 tokens), ONNX session without memory arena/pattern and with 2 intra-op threads (`EMBEDDER_SESSION_OPTIONS`); the image sets `MALLOC_ARENA_MAX=2`. Why: with ONNX defaults (batch 32, arena, one glibc heap per thread) prod API RSS reached 2.4 GB after the first backfill; measured on 1500 chat-length texts the tuned setup keeps ~635 MB after vs ~1030 MB, and runs ~1.8x faster. Never throws: `null` when unavailable. State `idle|loading|ready|failed` (`ChannelMemoryEmbedderState`).
- The API runs on `node:22-bookworm-slim` (prod-deps, builder, runner): the ONNX runtime ships glibc binaries only. Tesseract data stage stays Alpine (files only).

### What is embedded

- Rows that may be search hits: `memory_kind IN ('chat','request','action')`, not bot, not recalled, `expires_at IS NULL`, `text` not null, in listened chats with `chatMemory.enabled`.
- Text (`buildEmbeddingText`): `Name: text` of the message first, then up to 2 earlier hit-able messages of the same chat sent ≤10 min before it (newest first), so "ok chốt" carries what it answers; context lines are dropped before the message is cut. Nothing is masked (owner's decision 2026-10-26).

### Jobs (`MemoryEmbeddingService`, `MemoryEmbeddingProcessor`, `MemoryEmbeddingScheduler`)

- BullMQ queue `chat-memory` (`memory-embedding.jobs.ts`), concurrency 1, every job as system (`AuditContext.runAsSystem`). Jobs: `nightly` (scheduler, cron `0 3 * * *` in `timezone`: `purgeExpired` + sweep of every memory chat), `embed { channelId }`, `sync { channelId }`; a leftover `segment` job (old name) runs as `embed`.
- `embedPending(channelIds, limit = 5000)`: rounds of 128 rows without an embedding of the current model (oldest first, context rows joined as JSON), `embed`, then `INSERT … SELECT FROM unnest(…) ON CONFLICT (message_id) DO UPDATE` skipping rows deleted meanwhile. Model unavailable → `null` (nothing marked; the next run retries). Nothing is ever marked failed.
- `ChatMemoryService.onChange(listener)`: every successful insert (`record`, `recordAction`, `backfill`), recall and photo-text update notifies the chat. `MemoryEmbeddingScheduler` subscribes on bootstrap: per-chat in-process timer pushed back to `EMBED_IDLE_MS` (20 s), capped at `EMBED_MAX_WAIT_MS` (2 min) after the first change, then an `embed` job. `EMBED_CATCH_UP_DELAY_MS` (60 s) after boot it queues one `nightly` sweep (lost timers, backfill after deploy). Redis down → the nightly sweep catches up. `runChannel` checks `isListened && chatMemory.enabled` again.
- Photo text (`attachImageText`, `RETURNING sent_at`): deletes the embeddings of the photo row and the next 10 min, then notifies → re-embedded with the OCR text.
- Status: `status(channelId)` → `IChannelMemoryStatus { embedder, embeddedMessages, pendingMessages, lastEmbeddedAt }` (counts of the current model over hit-able rows).

### `/sync`

- Fast path (`TextToolFactory.resolveFastPathToolType`: `/sync`, `/sync …`, also after the bot mention) → `TextToolType.SYNC_MEMORY` → `SyncMemoryToolStrategy`; no LLM. Long-term off → "🧠 Kênh này chưa bật Nhớ lâu dài…"; else `MemoryEmbeddingScheduler.requestSync` (cancels the chat's timer, queues `sync`) → "🔄 Đang cập nhật trí nhớ…" (queue error → "⚠️ Chưa cập nhật được…").
- `sync` job → `runChannel`, then `syncResultText`: "🧠 Đã cập nhật trí nhớ: N tin mới." / "🧠 Trí nhớ đã đủ, không có tin mới." / model unavailable → "⚠️ Bộ nhớ theo ý nghĩa chưa sẵn sàng…, bot vẫn tìm lại tin theo từ khoá…".

### Removed with Cognee (2026-11-17)

Services `cognee`, `cognee-ui`, volume `zalobot-cognee`, `CogneeClient`, segments, nightly day documents, ingest pause, the internal LLM gateway `POST /api/internal/llm/v1/chat/completions` (`LlmProxyModule`), `apps/web/30-cognee-proxy.sh` and the `/cognee` nginx routes, env `COGNEE_*`, the nightly learned-facts job (`learned-facts.prompt.ts`, `LearnedFactsService.replaceForSubject/deletedFor`). Server clean-up after deploy (volume, images) is manual.

## History search (`SEARCH_CHAT_HISTORY`)

- Offered only with `input.longTermMemory` (boolean). Tool args `keywords`, `fromDate`, `toDate`, `question`, `limit`: the agent picks `limit` per question (more for broad/listing questions, fewer for one detail); `readSearchLimit` clamps it to `CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN..MAX` (1–50), default `SEARCH_LIMIT_DEFAULT` (15). `ChatMemoryService.search(channelId, { keywords, question, … })` runs two hit queries in parallel and merges them by reciprocal rank fusion (`mergeRankedIds`, k = 60; ids found by both first; ≤ `limit`): (1) keyword search (terms from `searchTerms`: each keyword as a phrase (all its words), plus each word of multi-word keywords alone (≤24, folded stop words like có/là/nói/đã skipped), all OR'ed; keywords with `.`/`@`/`/` (domains, emails, links, kept whole by the `simple` parser) also match as `text ILIKE` and rank first, then `ts_rank`; `limit` hits); (2) meaning search (`buildVectorHitQuery`: the question (else the keywords) embedded by `LocalEmbedder`, `ORDER BY embedding <=> $q` within the chat and the current model, cosine distance < `VECTOR_MAX_DISTANCE` 0.6, `limit` hits). Both share `hitConditions` (channel, `chat|request|action`, not bot, not recalled, `expires_at IS NULL`, date range in `timezone`, skip the asking message). Then neighbours ±3/4 skipping `card|system|secret|result`, ≤80 lines, into one `LlmService` prompt (the only LLM call). No hit → "không thấy". Embedder unavailable or meaning query failing → keyword search only.
- The `keywords` description asks for short keywords, common abbreviations (mk, pass, tk, stk, sdt) and domains kept whole. With long-term memory the tool prompt adds `CHAT_HISTORY_INTENT_RULE` (before chat in the intent table): asking again for, or asking the bot to pass on, something said in the chat ("chỉ Hằng biết tài khoản admin của web …", "nói lại cho Nam cái link lúc nãy", "pass wifi là gì") → `SEARCH_CHAT_HISTORY`. Intent eval has these cases.
- Without a recent-message window a bare "lúc nãy a có nói r" has no topic; the bot can only search with what that message says.

## Dashboard (admin only)

- API (`ChannelMemoryController`, `/api/zca/threads/:threadId/…`): `GET|POST notes`, `PATCH|DELETE notes/:noteId` (no web caller since the notes UI was removed), `GET learned-facts`, `DELETE learned-facts/:factId` (soft delete, `deleted_by` = admin), `GET memory-status`. Routes in `API_ROUTES` (`zcaThreadNotes`, `zcaThreadNote`, `zcaThreadFacts`, `zcaThreadFact`, `zcaThreadMemoryStatus`); DTOs `IChannelNote`, `IUpsertChannelNoteRequest`, `IChannelLearnedFact`, `IChannelMemoryStatus`. Mutations answer with the fresh list (cache replaced).
- Thread config page, right column, group "🧠 Trí nhớ": **🧠 Nhớ lâu dài** (switch; privacy note: every message is stored as written on the server, and only the snippets found for a question go to the AI that writes the answer; how-it-works list ("Khi nào nạp": ~20 s after the chat goes quiet, ≤2 min, local model, `/sync`); status line `memoryStatusText` ("Đã nhớ N tin. M tin đang chờ…", or the keyword-only warning when the model failed); "Điều bot đã học trước đây" grouped by subject with delete, hidden when empty; no "Tự học" toggle, no number settings), **🖼️ Đọc chữ trong ảnh** (hint when long-term is off). Phone: one column; small radius.
- Chat table Features column: `Nhớ` (long-term on).

## User merge

`UserMergeService.merge` moves `zca_channel_notes.created_by` and `zca_learned_facts.subject_user_id` / `deleted_by` to the kept user in the same transaction.

## Data disclosure

See `global/local-first-ai-usage.md` (exception "Chat memory"): prompt layers above and, for a memory question, ≤80 found lines go to the bot's LLM chain. Embeddings are computed on the server; no message is sent anywhere to be remembered. Photo bytes never leave the server.

## Not done

Purging a chat's whole memory, daily/monthly summaries, a relation graph (multi-hop questions), re-ranking, re-reading old photos.

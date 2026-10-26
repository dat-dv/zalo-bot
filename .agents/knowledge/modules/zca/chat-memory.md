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
      - apps/api/src/zca/memory/long-term/cognee.client.ts
      - apps/api/src/zca/memory/long-term/chat-day-document.ts
      - apps/api/src/zca/memory/long-term/learned-facts.prompt.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.service.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.processor.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.jobs.ts
      - apps/api/src/zca/memory/long-term/memory-segment.scheduler.ts
      - apps/api/src/database/entities/zca-memory-segment.entity.ts
      - apps/api/src/zca/text/strategies/sync-memory-tool.strategy.ts
      - apps/api/src/database/entities/zca-message.entity.ts
      - apps/api/src/database/entities/zca-channel-note.entity.ts
      - apps/api/src/database/entities/zca-learned-fact.entity.ts
      - apps/api/src/database/entities/zca-memory-ingestion.entity.ts
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
      - apps/web/nginx.conf
      - apps/web/30-cognee-proxy.sh
      - apps/web/Dockerfile
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

Owner: Core Engineering Team · Status: active (v2: one Postgres store with message kinds, per-chat notes, nightly Cognee graph, learned facts)

Human guide: [Trí nhớ hội thoại](../../../docs/modules/zca/chat-memory.md). Design records: `.agents/artifacts/chat-memory-recall/`, `chat-memory-per-thread-config/`, `chat-memory-short-long-split/`, `chat-memory-image-text/`, `chat-memory-persona-forgetting/`, `chat-memory-cognee/`, `chat-memory-long-term-v2/`, `memory-config-cleanup/`.

## Purpose

LLM calls are stateless. The bot keeps three memory layers per Zalo chat (`channelId`); a chat never reads another chat's memory.

| Layer | What | In the prompt | Written by | Switch |
| --- | --- | --- | --- | --- |
| **Notes (Ghi nhớ)** | What the chat told the bot to always remember (persona, conventions), ≤20 × 200 chars | Every turn, right after the identity line | Members via `REMEMBER_NOTE` / `FORGET_MEMORY` in the chat, saved at once (no dashboard UI) | none (always on) |
| **Learned facts** | Stable facts about the bot and members, ≤5 per subject | Every turn: bot + sender + tagged, ≤15 lines | Nightly job (Cognee + LLM) | `chatMemory.enabled` + `learnPeople` |
| **Long-term** | Every message (Postgres) + Cognee: segments of today, then one document per chat day | Only via `SEARCH_CHAT_HISTORY` | Every listened message; segment after ~3 min quiet or `/sync`; nightly job | `chatMemory.enabled` |

Redis keeps only transient state (pending cards, temp messages to recall, ZCA session, rate limits, cache, BullMQ). The former Redis list `zca:short_memory:<threadId>` is no longer written and expires.

**No short-term window** (removed 2026-10-26, owner's decision): no recent messages go into the prompt, so each message is handled on its own. Follow-ups that amend a pending card ("tag @Nam nha", `yes/cancel/edit <code>`) do not need it: they use the sender's pending cards in Redis (5-minute TTL, `AMEND_PENDING`). Configs saved with `shortTermEnabled`/`contextWindow`/`shortTermDays` are cleaned by the normalizer.

## Per-thread config (`ThreadBotConfig.chatMemory`, jsonb `zca_thread_configs.chat_memory`)

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | | Long-term memory: keep rows, nightly Cognee ingest, history search. |
| `readImageText` | `true` | | Local OCR of photos into the stored row (needs `enabled`). |
| `learnPeople` | `true` | | Nightly learned facts (needs `enabled`). |

`normalizeChatMemoryConfig` (`@zalobot/contracts`) fills defaults (missing `readImageText`/`learnPeople` → `true`) and drops keys of removed options (`shortTermEnabled`, `contextWindow`, `shortTermDays`, `searchLimit`). The memory needs `isListened`. Notes need neither. Hits per history search are not a setting: the agent picks them (see History search).

## One store: `zca_messages` with `memory_kind`

Migration `1724980000000-AddChatMemoryV2` added `memory_kind varchar default 'chat'` (existing bot rows → `bot_chat`) and `expires_at`.

| Kind | Set by | Sent to Cognee | Keyword-search hit |
| --- | --- | --- | --- |
| `chat` | Member message (default) | ✅ | ✅ |
| `request` | Member message that became a tool call (`TextInputService`) or a `yes/cancel/edit <code>` command | ❌ | ✅ |
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
- Retention: rows are stored only while the long-term memory is on (messages, bot replies, done actions, photo text); new rows never get `expires_at`. Rows with `expires_at` are leftovers of the removed short-term memory: the nightly job deletes them once expired (`purgeExpired`), and long-term search and Cognee ignore them.
- `content` keeps only `title/description/text/fileName/name`; `text` ≤2000 chars (`buildMemoryText`); photo with OCR text → `[Ảnh] <caption> — chữ trong ảnh: …`.
- Recall (`onUndo`, `ZcaService.undo`): `markRecalled` erases `text`/`content`, sets `recalled_at`, marks that local day `stale` in `zca_memory_ingestions` (resent to Cognee without it next night) and resolves the recalled rows' `sent_at`. A member's recall of a message of today (`ZcaBotFeatureService.onUndo`) also queues a `segment` job with `resetToday` (today's segments forgotten and sent again without it).
- Excluded from `AuditLogSubscriber`: `zca_messages`, `zca_learned_facts`, `zca_memory_ingestions`, `zca_memory_segments`. `zca_channel_notes` is audited.

## Tool calls reach memory only after success (D6)

- Pending cards stay in Redis (`TransactionConfirmationService`, unchanged keys `pending:tx:*`).
- `executeConfirmed`: each branch posts its summary via `post(summary, remember)`; after the switch, only when no exception was thrown, `recordConfirmedAction` writes one `action` row: `msg_id = action:<code>:<createdAt>`, sender = requester (`pending.userId`, name from `UsersService.resolveZaloNames` or the requester's last `sender_name` in the chat), text = `confirmedActionText(summary)` (emoji and `[code]` removed, lines joined with ` · `, prefixed `(đã duyệt)`). Only when the chat is listened with the long-term memory on.
- Not written: cancel, timeout, edit intermediates, failed execution, delete-not-found, `BAN_USER`, the generic fallback. Notes are done at once (no card) and recorded by their strategy through the same `recordDoneAction` (`memory/action-memory.ts`).
- Companion place: the transaction summary already names the place.
- Prompt rule `CURRENT_DATA_RULE`: current money/debt/calendar/task/reminder data must come from tools, never from memory.

## Notes (Ghi nhớ)

- Table `zca_channel_notes` (`channel_id`, `text varchar(200)`, `created_by`, `source_msg_id`); `ChannelNotesService` (list oldest first, add/update/remove, `findMatching` accent-insensitive all-words). Limits `CHANNEL_NOTES_LIMITS` (20, 200).
- Tool `REMEMBER_NOTE { text, reply?, replaceNoteId? }` (routing: see `global/zalo-command-intake.md`, lasting facts about the bot or group with no time and no task): **saved at once, no confirmation card** (owner's decision 2026-10-26: a pending card nobody approved dropped "mày là con mèo đen"). The strategy rejects empty/too long, maps `n2` to the 2nd note and updates it, else adds (limit → refusal text); a duplicate (folded) is not saved again. It then sends the LLM's in-character `reply` (≤500 chars; fallback `Dạ em nhớ rồi: <text>`) as `bot_chat`, and writes the `action` row `(đã duyệt) Đã ghi nhớ: …` via `recordDoneAction`.
- Tool `FORGET_MEMORY { query, reply? }`: forgets at once the notes and active learned facts containing every word (≤5; more → asks to narrow; none → "không nhớ điều gì khớp"); facts are soft-deleted with `deleted_by` = sender so they are not learned again; answers with `reply` or a line listing what was forgotten. Not written to memory.
- Prompt (`TextInputService`, both the tool pass and the chit-chat pass): `BOT_IDENTITY_LINE` ("…nếu phần ĐIỀU ĐƯỢC DẶN mô tả bạn khác đi… thì luôn theo phần đó") + `buildMemoryProfileBlock` (notes as `[n1] …`, then learned facts) before the date context. Built whatever the memory switches; learned facts only when long-term is on.
- Notes are managed only in the chat; the dashboard has no notes UI (removed 2026-10-26). The notes API below is kept without a web caller.

## Cognee (long-term graph)

- Service `cognee` in `docker-compose.yml`: image `cognee/cognee:1.6.5`, no published port, volume `zalobot-cognee:/cognee-storage` (its own SQLite + LanceDB + Kuzu; the main Postgres image is untouched to avoid an alpine→debian collation change). Fixed env: `ENABLE_BACKEND_ACCESS_CONTROL=true` (dataset filter only works with it), `TELEMETRY_DISABLED=true`, `SUMMARY_METHOD=from_extraction`, fastembed `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384, in-container), `DEFAULT_USER_EMAIL=zalobot@example.com`. Interpolated: `COGNEE_LLM_PROVIDER` (default `custom`), `COGNEE_LLM_ENDPOINT`, `COGNEE_LLM_MODEL` (`openai/<model>`), `COGNEE_LLM_API_KEY`, `COGNEE_JWT_SECRET`, `COGNEE_USER_PASSWORD`.
- API config `cognee`: `COGNEE_URL` (compose fixes `http://cognee:8000`), `COGNEE_USER_EMAIL` (default `zalobot@example.com`), `COGNEE_USER_PASSWORD`, `COGNEE_TIMEOUT_MS` (600000). Off unless URL and password are set.
- `CogneeClient` (REST `/api/v1`, verified on 1.6.5): login `POST /auth/login` (form) → JWT reused 50 min, re-login once on 401; `remember` (multipart `data`, `datasetName`, `run_in_background=false`) → `{ dataset_id, items[0].id }`; `forget` (`{ datasetId, dataId }` → `status: success`); `recallContext(dataset, query, { temporal })` → `POST /recall` with `only_context: true`, `search_type` `TEMPORAL` or `GRAPH_COMPLETION`, 404 (unknown dataset) → `[]`. Never throws.
- Dataset per chat: `zca-<channelId>` (`cogneeDatasetName`).
- Remote access (all through the `web` nginx, written at start by `apps/web/30-cognee-proxy.sh`; closed unless `COGNEE_UI_HOST` is set (then `/cognee/…` without it answers 404); protected by Cognee's own login only (owner's choice, 2026-10-26: no Basic Auth), and `…/api/v1/auth/register` always 403 so nobody can sign up and spend the LLM key):
  - API on the main domain: `https://<domain>/cognee/…` → `http://cognee:8000/…` (prefix stripped, Docker DNS resolver so the web starts while cognee is down → 502, 600 s timeouts, 20 MB body). Swagger does not work under the prefix.
  - UI (`cognee-ui` service, image `cognee/cognee-ui:1.6.5`, internal): on its own host `COGNEE_UI_HOST` (prod `cognee-zalobot.datintech.site`; server block `/etc/nginx/conf.d/zz-cognee-ui.conf`): `/` → `cognee-ui:3000`, `/api/` and `/health` → `cognee:8000`, so the UI's host-scoped login cookie and CORS stay on one origin (`COGNEE_BACKEND_URL` and Cognee `UI_APP_URL` = `https://<COGNEE_UI_HOST>`). The UI has no basePath, so it cannot live under `/cognee/`; `/cognee` and `/cognee/` on the main domain answer 302 to the UI host. Sign in with `zalobot@example.com` + `COGNEE_USER_PASSWORD` (superuser: sees every chat's dataset). The UI server also listens on container port 8081, published as `COGNEE_UI_PORT` (3006) as its default server, so a tunnel can point the UI host straight at that port (one-level subdomain so Cloudflare's free certificate covers it).

## Ingest jobs (`MemoryIngestService`, `MemoryIngestProcessor`, `MemorySegmentScheduler`)

- BullMQ queue `chat-memory` (`memory-ingest.jobs.ts`), concurrency 1 (segments never run beside the nightly job), every job as system (`AuditContext.runAsSystem`). Jobs: `nightly` (scheduler, cron `0 3 * * *` in `timezone`), `segment { channelId, resetToday? }`, `sync { channelId }`.
- **Nothing is masked** (owner's decision 2026-10-26, "ghi gì nhớ đó"): documents carry the text as written, passwords and account numbers included. `maskLongNumbers` was removed.

### Segments of today (owner's decision 2026-10-26: remember within minutes)

- Table `zca_memory_segments` (migration `1724990000000-AddChatMemorySegments`): `channel_id`, `day`, `from_sent_at`, `to_sent_at`, `cognee_data_id` (`<datasetId>:<dataId>`).
- `MemorySegmentScheduler.noteMessage(channelId)` after each stored message of a long-term chat (`ZcaBotFeatureService.onMessage`, not the bot's echo): an in-process timer per chat, pushed back to `SEGMENT_IDLE_MS` (3 min) by every message but capped at `SEGMENT_MAX_WAIT_MS` (15 min) after the first unsent one; then a `segment` job. Timers are lost on restart, so `SEGMENT_CATCH_UP_DELAY_MS` (60 s) after boot every listened long-term chat gets one `segment` job. Redis down → no job; the nightly run still sends the day.
- `ingestSegment(config)`: today's `dayLines` after `max(to_sent_at)` of today's segments (same filter as the day document); none → nothing (0). Document = day document with the time range in the header (`…ngày 26/10/2026 (Thứ Hai), 14:28–14:56`), file `chatSegmentFileName` (`<channelId>_<day>_<lastSentAtMs>.txt`). `remember` fails → `null`, no row (next run takes the lines again). Lines sent late with an older `sent_at` wait for the nightly run.
- Learned facts are not touched by segments (nightly only).

### Nightly run

- `runNightly`: `purgeExpired`; if Cognee is on, for each listened chat with `enabled` (one after another):
  1. `daysToIngest`: local days before today with long-term rows whose ingestion row is missing/`pending`/`stale`/`failed` with attempts < 5; newest first, ≤8 per night (`INGEST_DAYS_PER_NIGHT`).
  2. Per day: forget the day's segments (rows deleted) and the previous document (`cognee_data_id` stored as `<datasetId>:<dataId>`), so a day ends as one document; build `buildChatDayDocument` (header `Nhật ký cuộc trò chuyện "<name>" ngày dd/mm/yyyy (Thứ …)`, lines `HH:mm Name: text`, kinds `chat` + `action`, not bot, not recalled), empty day → `ingested` without a call; `remember` → `ingested` or `failed` (+attempts, `last_error`).
  3. If anything went in and `learnPeople`: subjects = bot (`zalo.botName`) + 10 most active members of those days; per subject `recallContext(factRecallQuery)` → `LlmService.generate` (`LEARNED_FACTS_SYSTEM_INSTRUCTION`: stable facts only, skip jokes/insults/threats/one-day info, JSON `{"facts": []}`), `parseLearnedFacts`, `replaceForSubject` (drops facts equal to deleted ones, ≤5). No context → previous facts kept.
- Status for the dashboard: `status(channelId)` → `IChannelMemoryStatus` (`cogneeEnabled`, `lastIngestedDay`, `failedDays`, `lastError`, `todayIngestedUntil` = `to_sent_at` of today's last segment).

### `/sync`

- Fast path (`TextToolFactory.resolveFastPathToolType`: `/sync`, `/sync …`, also after the bot mention) → `TextToolType.SYNC_MEMORY` → `SyncMemoryToolStrategy`; no LLM. Same access as other commands.
- Long-term off → "🧠 Kênh này chưa bật Nhớ lâu dài…"; Cognee off → says so; else `MemorySegmentScheduler.requestSync` (cancels the chat's timer, queues `sync`) and answers "🔄 Đang cập nhật trí nhớ…" (queue error → "⚠️ Chưa cập nhật được…").
- `sync` job: `runSync` = `ingestChannel(..., { learn: false })` (past pending/stale/failed days) + `ingestSegment`; the processor posts `syncResultText`: "🧠 Đã cập nhật trí nhớ: N tin mới hôm nay, M ngày trước còn chờ." / "🧠 Trí nhớ đã đủ, không có tin mới." / "⚠️ Chưa cập nhật được trí nhớ lúc này, thử lại sau.".
- A recalled message's facts can survive until the next night (day resent, its sender re-learned).

## History search (`SEARCH_CHAT_HISTORY`)

- Offered only with `input.longTermMemory` (boolean). Tool args `keywords`, `fromDate`, `toDate`, `question`, `limit`: the agent picks `limit` per question (more for broad/listing questions, fewer for one detail); `readSearchLimit` clamps it to `CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN..MAX` (1–50), default `SEARCH_LIMIT_DEFAULT` (15). Runs in parallel: keyword search (`ChatMemoryService.search`, terms from `searchTerms`: each keyword as a phrase (all its words), plus each word of multi-word keywords alone (≤24, folded stop words like có/là/nói/đã skipped), all OR'ed; keywords with `.`/`@`/`/` (domains, emails, links, kept whole by the `simple` parser) also match as `text ILIKE` and rank first, then `ts_rank`; hits `chat|request|action`, not bot, `expires_at IS NULL`, `limit` hits; neighbours ±3/4 skip `card|system|secret|result`; ≤80 lines) and, when Cognee is on, `recallContext` (temporal when a date range is given). Both go into one `LlmService` prompt (graph context ≤6000 chars, original lines win on conflict). Neither → "không thấy". Cognee failing → keyword search only.
- The `keywords` description asks for short keywords, common abbreviations (mk, pass, tk, stk, sdt) and domains kept whole. With long-term memory the tool prompt adds `CHAT_HISTORY_INTENT_RULE` (before chat in the intent table): asking again for, or asking the bot to pass on, something said in the chat ("chỉ Hằng biết tài khoản admin của web …", "nói lại cho Nam cái link lúc nãy", "pass wifi là gì") → `SEARCH_CHAT_HISTORY`. Intent eval has these cases.
- Without a recent-message window a bare "lúc nãy a có nói r" has no topic; the bot can only search with what that message says.

## Dashboard (admin only)

- API (`ChannelMemoryController`, `/api/zca/threads/:threadId/…`): `GET|POST notes`, `PATCH|DELETE notes/:noteId` (no web caller since the notes UI was removed), `GET learned-facts`, `DELETE learned-facts/:factId` (soft delete, `deleted_by` = admin), `GET memory-status`. Routes in `API_ROUTES` (`zcaThreadNotes`, `zcaThreadNote`, `zcaThreadFacts`, `zcaThreadFact`, `zcaThreadMemoryStatus`); DTOs `IChannelNote`, `IUpsertChannelNoteRequest`, `IChannelLearnedFact`, `IChannelMemoryStatus`. Mutations answer with the fresh list (cache replaced).
- Thread config page, right column, group "🧠 Trí nhớ": **🧠 Nhớ lâu dài** (switch, privacy warning that every message goes as written, passwords included, to the Cognee LLM a few minutes later, how-it-works list ("Khi nào nạp": ~3 min quiet, ≤15 min, `/sync`, nightly rebuild), "Tự học về mọi người" toggle, status line ("Đã nạp tới ngày dd/mm/yyyy. Hôm nay đã nạp tới HH:mm."), "Bot đã học" grouped by subject with delete; no number settings), **🖼️ Đọc chữ trong ảnh** (hint when long-term is off). Phone: one column; small radius.
- Chat table Features column: `Nhớ` (long-term on).

## User merge

`UserMergeService.merge` moves `zca_channel_notes.created_by` and `zca_learned_facts.subject_user_id` / `deleted_by` to the kept user in the same transaction.

## Data disclosure

See `global/local-first-ai-usage.md` (exception "Chat memory"): prompt layers above, keyword snippets ≤80 lines, today's segments a few minutes after a chat goes quiet and the nightly whole-day documents of long-term chats to the Cognee LLM, unmasked. Photo bytes never leave the server.

## Not done

Purging a chat's whole memory, monthly roll-ups beyond Cognee's own summaries, pgvector in the main Postgres, re-reading old photos.

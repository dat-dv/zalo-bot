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
      - apps/api/src/zca/memory/short-term-memory.service.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
      - apps/api/src/zca/memory/long-term/cognee.client.ts
      - apps/api/src/zca/memory/long-term/chat-day-document.ts
      - apps/api/src/zca/memory/long-term/learned-facts.prompt.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.service.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.processor.ts
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
      - apps/web/src/modules/zca/presentation/components/thread-config/channel-notes-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/short-term-memory-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/long-term-memory-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/learned-facts-panel.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/image-text-memory-section.tsx
---

# ZCA Chat Memory

Owner: Core Engineering Team · Status: active (v2: one Postgres store with message kinds, per-chat notes, nightly Cognee graph, learned facts)

Human guide: [Trí nhớ hội thoại](../../../docs/modules/zca/chat-memory.md). Design records: `.agents/artifacts/chat-memory-recall/`, `chat-memory-per-thread-config/`, `chat-memory-short-long-split/`, `chat-memory-image-text/`, `chat-memory-persona-forgetting/`, `chat-memory-cognee/`, `chat-memory-long-term-v2/`.

## Purpose

LLM calls are stateless. The bot keeps four memory layers per Zalo chat (`channelId`); a chat never reads another chat's memory.

| Layer | What | In the prompt | Written by | Switch |
| --- | --- | --- | --- | --- |
| **Notes (Ghi nhớ)** | What the chat told the bot to always remember (persona, conventions), ≤20 × 200 chars | Every turn, right after the identity line | Members via `REMEMBER_NOTE` (saved at once); admins on the dashboard | none (always on) |
| **Short-term window** | Latest conversation messages | Every turn | Every listened message | `chatMemory.shortTermEnabled` |
| **Learned facts** | Stable facts about the bot and members, ≤5 per subject | Every turn: bot + sender + tagged + people in the window, ≤15 lines | Nightly job (Cognee + LLM) | `chatMemory.enabled` + `learnPeople` |
| **Long-term** | Every message (Postgres) + one Cognee document per chat day | Only via `SEARCH_CHAT_HISTORY` | Every listened message; nightly job | `chatMemory.enabled` |

Redis keeps only transient state (pending cards, temp messages to recall, ZCA session, rate limits, cache, BullMQ). The former Redis list `zca:short_memory:<threadId>` is no longer written and expires.

## Per-thread config (`ThreadBotConfig.chatMemory`, jsonb `zca_thread_configs.chat_memory`)

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | | Long-term memory: keep rows, nightly Cognee ingest, history search. |
| `shortTermEnabled` | `false` | | Short-term window in the prompt. |
| `contextWindow` | `10` | 1–30 | Messages in the window. |
| `shortTermDays` | `1` | 1–7 | Window only uses messages sent within this many days. |
| `searchLimit` | `15` | 1–50 | Keyword hits per search (each expanded with neighbours). |
| `readImageText` | `true` | | Local OCR of photos into the stored row. |
| `learnPeople` | `true` | | Nightly learned facts (needs `enabled`). |

`normalizeChatMemoryConfig` (`@zalobot/contracts`) fills defaults/clamps (also legacy: `shortTermEnabled = enabled && contextWindow > 0`; missing `readImageText`/`learnPeople` → `true`). Either memory needs `isListened`. Notes need neither switch.

## One store: `zca_messages` with `memory_kind`

Migration `1724980000000-AddChatMemoryV2` added `memory_kind varchar default 'chat'` (existing bot rows → `bot_chat`) and `expires_at`.

| Kind | Set by | Short-term window | Sent to Cognee | Keyword-search hit |
| --- | --- | --- | --- | --- |
| `chat` | Member message (default) | ✅ | ✅ | ✅ |
| `request` | Member message that became a tool call (`TextInputService`) or a `yes/cancel/edit <code>` command | ✅ | ❌ | ✅ |
| `action` | Row written after a confirmed tool call **ran successfully** | ✅ | ✅ | ✅ |
| `bot_chat` | Bot message (default) | ✅ | ❌ | neighbour only |
| `tool` | Answers of read-only tools (`GET_REPORT`, `LIST_TASKS`, `LIST_CALENDAR_EVENTS`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY`) | ✅ | ❌ | neighbour only |
| `reminder` | Reminder deliveries (`ReminderTargetService.deliver`) | ✅ | ❌ | neighbour only |
| `result` | "✅ [358] …" success notices | ❌ | ❌ | ❌ |
| `card` | Confirmation cards | ❌ | ❌ | ❌ |
| `system` | Timeout / cancel / heart notices and any other message of `TransactionConfirmationService` | ❌ | ❌ | ❌ |
| `secret` | Dashboard sign-in link + code; text stored as `[Link đăng nhập dashboard]` | ❌ | ❌ | ❌ |

- Bot kinds are tagged with `OutgoingMemoryKind.run(kind, fn)` (`memory-kind.ts`, AsyncLocalStorage, like `AuditContext`). The `api.sendMessage` wrapper in `ZcaService.setupApiInstance` reads it before awaiting; `TransactionConfirmationService` wraps its messenger so its sends default to `system` (cards run under `card`, `executeConfirmed` under `result`).
- `recordBotReply` upserts `is_bot`, `memory_kind`, `text`, `content` (self-listen echo stored first is overwritten; a `secret` echo loses its text). `onMessage` skips the bot's own echo when `isBotSentMessage`.
- Retention: one row is stored while either memory is on. Long-term off → `expires_at = sent_at + 7 days` (`SHORT_TERM_ONLY_RETENTION_DAYS` = `SHORT_TERM_DAYS_MAX`); the nightly job deletes expired rows (`purgeExpired`). Long-term search and Cognee ignore rows with `expires_at` (turning long-term on later never exposes them).
- `content` keeps only `title/description/text/fileName/name`; `text` ≤2000 chars (`buildMemoryText`); photo with OCR text → `[Ảnh] <caption> — chữ trong ảnh: …`.
- Recall (`onUndo`, `ZcaService.undo`): `markRecalled` erases `text`/`content`, sets `recalled_at`, and marks that local day `stale` in `zca_memory_ingestions` (resent to Cognee without it next night).
- Excluded from `AuditLogSubscriber`: `zca_messages`, `zca_learned_facts`, `zca_memory_ingestions`. `zca_channel_notes` is audited.

## Tool calls reach memory only after success (D6)

- Pending cards stay in Redis (`TransactionConfirmationService`, unchanged keys `pending:tx:*`).
- `executeConfirmed`: each branch posts its summary via `post(summary, remember)`; after the switch, only when no exception was thrown, `recordConfirmedAction` writes one `action` row: `msg_id = action:<code>:<createdAt>`, sender = requester (`pending.userId`, name from `UsersService.resolveZaloNames` or the requester's last `sender_name` in the chat), text = `confirmedActionText(summary)` (emoji and `[code]` removed, lines joined with ` · `, prefixed `(đã duyệt)`). Only when the chat is listened with a memory on.
- Not written: cancel, timeout, edit intermediates, failed execution, delete-not-found, `BAN_USER`, the generic fallback. Notes are done at once (no card) and recorded by their strategy through the same `recordDoneAction` (`memory/action-memory.ts`).
- Companion place: the transaction summary already names the place.
- Prompt rule `CURRENT_DATA_RULE`: current money/debt/calendar/task/reminder data must come from tools, never from memory.

## Notes (Ghi nhớ)

- Table `zca_channel_notes` (`channel_id`, `text varchar(200)`, `created_by`, `source_msg_id`); `ChannelNotesService` (list oldest first, add/update/remove, `findMatching` accent-insensitive all-words). Limits `CHANNEL_NOTES_LIMITS` (20, 200).
- Tool `REMEMBER_NOTE { text, reply?, replaceNoteId? }` (routing: see `global/zalo-command-intake.md`, lasting facts about the bot or group with no time and no task): **saved at once, no confirmation card** (owner's decision 2026-10-26: a pending card nobody approved dropped "mày là con mèo đen"). The strategy rejects empty/too long, maps `n2` to the 2nd note and updates it, else adds (limit → refusal text); a duplicate (folded) is not saved again. It then sends the LLM's in-character `reply` (≤500 chars; fallback `Dạ em nhớ rồi: <text>`) as `bot_chat`, and writes the `action` row `(đã duyệt) Đã ghi nhớ: …` via `recordDoneAction`.
- Tool `FORGET_MEMORY { query, reply? }`: forgets at once the notes and active learned facts containing every word (≤5; more → asks to narrow; none → "không nhớ điều gì khớp"); facts are soft-deleted with `deleted_by` = sender so they are not learned again; answers with `reply` or a line listing what was forgotten. Not written to memory.
- Prompt (`TextInputService`, both the tool pass and the chit-chat pass): `BOT_IDENTITY_LINE` ("…nếu phần ĐIỀU ĐƯỢC DẶN mô tả bạn khác đi… thì luôn theo phần đó") + `buildMemoryProfileBlock` (notes as `[n1] …`, then learned facts) before the date context. Built whatever the memory switches; learned facts only when long-term is on.
- The recent-context header still forbids tool calls for old requests but says instructions in it still apply.

## Short-term window

`ShortTermMemoryService.getRecent` → `ChatMemoryService.getRecent(channelId, { limit, maxAgeDays, excludeMsgId })`: SQL on `zca_messages`, kinds `SHORT_TERM_KINDS`, `recalled_at IS NULL`, `sent_at >= now() - days`, newest `limit` then oldest first; returns `senderUid` (used to pick learned facts); photo text cut to 500 chars. Fed from `AgentInput.shortTermMemory = { contextWindow, days }` (absent when off).

## Cognee (long-term graph)

- Service `cognee` in `docker-compose.yml`: image `cognee/cognee:1.6.5`, no published port, volume `zalobot-cognee:/cognee-storage` (its own SQLite + LanceDB + Kuzu; the main Postgres image is untouched to avoid an alpine→debian collation change). Fixed env: `ENABLE_BACKEND_ACCESS_CONTROL=true` (dataset filter only works with it), `TELEMETRY_DISABLED=true`, `SUMMARY_METHOD=from_extraction`, fastembed `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384, in-container), `DEFAULT_USER_EMAIL=zalobot@example.com`. Interpolated: `COGNEE_LLM_PROVIDER` (default `custom`), `COGNEE_LLM_ENDPOINT`, `COGNEE_LLM_MODEL` (`openai/<model>`), `COGNEE_LLM_API_KEY`, `COGNEE_JWT_SECRET`, `COGNEE_USER_PASSWORD`.
- API config `cognee`: `COGNEE_URL` (compose fixes `http://cognee:8000`), `COGNEE_USER_EMAIL` (default `zalobot@example.com`), `COGNEE_USER_PASSWORD`, `COGNEE_TIMEOUT_MS` (600000). Off unless URL and password are set.
- `CogneeClient` (REST `/api/v1`, verified on 1.6.5): login `POST /auth/login` (form) → JWT reused 50 min, re-login once on 401; `remember` (multipart `data`, `datasetName`, `run_in_background=false`) → `{ dataset_id, items[0].id }`; `forget` (`{ datasetId, dataId }` → `status: success`); `recallContext(dataset, query, { temporal })` → `POST /recall` with `only_context: true`, `search_type` `TEMPORAL` or `GRAPH_COMPLETION`, 404 (unknown dataset) → `[]`. Never throws.
- Dataset per chat: `zca-<channelId>` (`cogneeDatasetName`).
- Remote access (all through the `web` nginx, written at start by `apps/web/30-cognee-proxy.sh`; closed unless `COGNEE_UI_HOST` is set (then `/cognee/…` without it answers 404); protected by Cognee's own login only (owner's choice, 2026-10-26: no Basic Auth), and `…/api/v1/auth/register` always 403 so nobody can sign up and spend the LLM key):
  - API on the main domain: `https://<domain>/cognee/…` → `http://cognee:8000/…` (prefix stripped, Docker DNS resolver so the web starts while cognee is down → 502, 600 s timeouts, 20 MB body). Swagger does not work under the prefix.
  - UI (`cognee-ui` service, image `cognee/cognee-ui:1.6.5`, internal): on its own host `COGNEE_UI_HOST` (prod `cognee-zalobot.datintech.site`; server block `/etc/nginx/conf.d/zz-cognee-ui.conf`): `/` → `cognee-ui:3000`, `/api/` and `/health` → `cognee:8000`, so the UI's host-scoped login cookie and CORS stay on one origin (`COGNEE_BACKEND_URL` and Cognee `UI_APP_URL` = `https://<COGNEE_UI_HOST>`). The UI has no basePath, so it cannot live under `/cognee/`; `/cognee` and `/cognee/` on the main domain answer 302 to the UI host. Sign in with `zalobot@example.com` + `COGNEE_USER_PASSWORD` (superuser: sees every chat's dataset). The UI server also listens on container port 8081, published as `COGNEE_UI_PORT` (3006) as its default server, so a tunnel can point the UI host straight at that port (one-level subdomain so Cloudflare's free certificate covers it).

## Nightly job (`MemoryIngestService`, `MemoryIngestProcessor`)

- BullMQ queue `chat-memory`, scheduler `nightly`, cron `0 3 * * *` in `timezone`; concurrency 1; runs as system (`AuditContext.runAsSystem`).
- `runNightly`: `purgeExpired`; if Cognee is on, for each listened chat with `enabled` (one after another):
  1. `daysToIngest`: local days before today with long-term rows whose ingestion row is missing/`pending`/`stale`/`failed` with attempts < 5; newest first, ≤8 per night (`INGEST_DAYS_PER_NIGHT`).
  2. Per day: forget the previous document (`cognee_data_id` stored as `<datasetId>:<dataId>`), build `buildChatDayDocument` (header `Nhật ký cuộc trò chuyện "<name>" ngày dd/mm/yyyy (Thứ …)`, lines `HH:mm Name: text`, kinds `chat` + `action`, not bot, not recalled, numbers ≥12 digits masked `***1234`), empty day → `ingested` without a call; `remember` → `ingested` or `failed` (+attempts, `last_error`).
  3. If anything went in and `learnPeople`: subjects = bot (`zalo.botName`) + 10 most active members of those days; per subject `recallContext(factRecallQuery)` → `LlmService.generate` (`LEARNED_FACTS_SYSTEM_INSTRUCTION`: stable facts only, skip jokes/insults/threats/one-day info, JSON `{"facts": []}`), `parseLearnedFacts`, `replaceForSubject` (drops facts equal to deleted ones, ≤5). No context → previous facts kept.
- Status for the dashboard: `status(channelId)` → `IChannelMemoryStatus` (`cogneeEnabled`, `lastIngestedDay`, `failedDays`, `lastError`).
- A recalled message's facts can survive until the next night (day resent, its sender re-learned).

## History search (`SEARCH_CHAT_HISTORY`)

- Offered only with `input.longTermMemory`. Runs in parallel: keyword search (`ChatMemoryService.search`: hits `chat|request|action`, not bot, `expires_at IS NULL`, ranked `ts_rank`, `searchLimit`; neighbours ±3/4 skip `card|system|secret|result`; ≤80 lines) and, when Cognee is on, `recallContext` (temporal when a date range is given). Both go into one `LlmService` prompt (graph context ≤6000 chars, original lines win on conflict). Neither → "không thấy". Cognee failing → keyword search only.

## Dashboard (admin only)

- API (`ChannelMemoryController`, `/api/zca/threads/:threadId/…`): `GET|POST notes`, `PATCH|DELETE notes/:noteId`, `GET learned-facts`, `DELETE learned-facts/:factId` (soft delete, `deleted_by` = admin), `GET memory-status`. Routes in `API_ROUTES` (`zcaThreadNotes`, `zcaThreadNote`, `zcaThreadFacts`, `zcaThreadFact`, `zcaThreadMemoryStatus`); DTOs `IChannelNote`, `IUpsertChannelNoteRequest`, `IChannelLearnedFact`, `IChannelMemoryStatus`. Mutations answer with the fresh list (cache replaced).
- Thread config page, right column, group "🧠 Trí nhớ": **📌 Ghi nhớ** (list `nX`, edit/delete with confirm dialog, add input, `x/20`; saved at once, not with the form), **💬 Nhớ đoạn chat gần đây** (switch, messages, days), **🧠 Nhớ lâu dài** (switch, privacy warning that each night's whole chat goes to the Cognee LLM, how-it-works list, "Tự học về mọi người" toggle, nightly status line, "Bot đã học" grouped by subject with delete, "Nâng cao" → results per search), **🖼️ Đọc chữ trong ảnh**. Phone: one column; small radius.
- Chat table Features column: `Ngữ cảnh` (short-term on), `Nhớ` (long-term on).

## User merge

`UserMergeService.merge` moves `zca_channel_notes.created_by` and `zca_learned_facts.subject_user_id` / `deleted_by` to the kept user in the same transaction.

## Data disclosure

See `global/local-first-ai-usage.md` (exception "Chat memory"): prompt layers above, keyword snippets ≤80 lines, and the nightly whole-day documents of long-term chats to the Cognee LLM. Photo bytes never leave the server.

## Not done

Purging a chat's whole memory, monthly roll-ups beyond Cognee's own summaries, pgvector in the main Postgres, re-reading old photos.

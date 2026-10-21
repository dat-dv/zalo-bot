# ZCA (Zalo Client Account) Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/zca/README.md)

## Purpose

`apps/api/src/zca` and `apps/web/src/modules/zca` connect a personal Zalo account through `zca-js` (WebSocket), route its events (messages, reactions, group events), store per-thread bot configuration, back up media to Google Drive/Photos, and host the "Zalo & Users" admin page.

## Backend services

- **`ZcaService`** (connection & session):
  - QR login (`startQrLogin`, `loginQR`), chat commands `/zalo-login`, `/zca-login`, `/zlogin` and `/zalo-logout`, `/zca-logout`, `/zlogout`; CLI `npm run zca:login --workspace @zalobot/api` (`apps/api/scripts/zca-login.ts`).
  - Session persisted to file `.zca-session.json` in `DATA_DIR`/`ZCA_DATA_DIR` (else `./data` if it exists, else cwd) and to Redis key `zca:session`. Restore order on bootstrap: file → Redis (then rewritten to file). `ZCA_AUTO_LOGIN=true` forces `login()` on bootstrap. `logout()` clears file + Redis.
  - Caches `msgId → cliMsgId` in memory and Redis `zca:msg:cli:<msgId>` (TTL 24h). `undo(payload, threadId)` resolves thread type and the real `cliMsgId` to avoid Zalo "Lỗi không xác định". `deleteMessage(dest, onlyMe)` is the fallback.
  - `getAvailableThreads(forceRefresh)` lists groups/friends; `setListenedThreadIds` / `toggleListenedThread` sync listening state to `ThreadConfigService`.
  - Event dispatch: `dispatchMessage`, `dispatchReaction`, `dispatchGroupEvent` (→ `GroupEventDispatcher`), friend/undo/typing/seen/delivered events to registered plugins.
- **`ZcaBotFeatureService`**: `onMessage`, `onReaction`, `syncThreadMediaHistory` (see below).
- **`ThreadConfigService`** + `ZcaThreadConfigEntity` (table `zca_thread_configs`): memory → Redis `zca:thread_config:<id>` (TTL 24h) → DB. Listened set in Redis `zca:listened_threads`.
- **`TransactionConfirmationService`** (`confirmation/`): pending actions (`yes/cancel/edit <code>`, reactions), message recall.
- **Guards** (`guards/`): `InitialAdminBootstrapGuard`, `GrantAccessGuard`.
- **Pending image** (`pending-image/`): `ImageBatchHandler` (1s debounce per sender) shows a choice menu for an image. Since mention-only routing, `onMessage` no longer calls it (an uncaptioned image is only backed up), so ZCA creates no new pending images; the dispatcher still answers `1`/`2`/`hủy` for any pending image that exists. `PendingImageActionService` keeps the pending image (memory + Redis `pending:image:user:<userId>`, 5 min). `PendingImageActionDispatcher` (`pending-image-dispatcher.service.ts`) strategies: `CreateBillPendingImageStrategy` (`1` / `tạo bill [note]` → OCR + LLM with `ZALO_TOOL_DEFINITIONS`), `StorageUploadPendingImageStrategy` (`2` / `lưu drive|ảnh|photo` → Drive/Photos), `CancelPendingImageStrategy` (`hủy`, `cancel`, `bỏ qua`, `không`…).
- **Group events**: `GroupEventDispatcher` with `WelcomeGroupEventStrategy` (registered by default). Handles `JOIN` (not self) only when enabled (`ZCA_ENABLE_WELCOME=true` / `zca.enableWelcome`); sends "Chào mừng @name đến với nhóm!" (or multi-member text) with optional image `ZCA_WELCOME_IMAGE_PATH` (default `./welcome.jpg`).

## Per-thread configuration (`ThreadBotConfig`)

| Field | Default (`createDefaultThreadConfig`) | Meaning |
| --- | --- | --- |
| `threadType` | from zca-js, else legacy prefix, else `user` | `user` / `group` |
| `isListened` | `false` | Bot receives messages from this thread |
| `directInteraction.enabled` | `false` | Shows the direct-interaction settings in the dashboard; routing does not read it |
| `directInteraction.triggerPrefixes` | `[]` | Group trigger prefixes besides @mention, e.g. `['!', 'bot:']`. Case-insensitive, no whitespace, 1–20 chars, max 10, de-duplicated, stored longest first (`normalizeTriggerPrefixes` in `@zalobot/contracts`) |
| `directInteraction.allowAiChat` | `false` | Free chat in L1: adds the chit-chat block to the LLM prompt and a tool-free second pass (see [Zalo Command Intake](../../global/zalo-command-intake.md)); `false` = silent on non-tool replies |
| `directInteraction.allowSelf` | `false` | Process messages sent by the bot account itself |
| `mediaBackup.enabled` + `uploadImages/Videos/Files/Audios` | all `false` | L3 auto backup per type |
| `mediaBackup.notifyInThread` | `false` | Post Drive/Photos links after auto backup |
| `mediaBackup.customFolder` | `zalobot/<sanitized threadName>` when name known, else `''` | Drive folder override |
| `mediaBackup.fileSuffix` | `_<sanitized name or id>` | Filename suffix |
| `mediaBackup.photosAlbum` | `''` | Google Photos album title override |
| `confirmationRules.allowReactions` | `false` | ❤️/😡 reactions confirm/cancel |
| `confirmationRules.requiredHearts` | group `5`, user `1` | Hearts needed |
| `confirmationRules.timeoutMinutes` | `5` | Pending timeout |
| `driveFolderId/Url/Path`, `photosAlbumId/Url/Title` | unset | Cached link to the channel storage root and channel Photos album (see Channel Storage Links) |

- `setListened(id, true)` on a thread whose `directInteraction.enabled` is false also enables it with `allowAiChat: true` (keeps `triggerPrefixes`).
- Legacy data: rows written before `triggerPrefixes` may hold a single `directInteraction.triggerPrefix` string; `normalizeDirectInteraction` folds it into the list on every read (DB, Redis, legacy JSON file), and the next save drops the old key. `requireMention` no longer exists: groups always need a mention or prefix.
- Removed: `expenseTracking` / `calendarExtraction` (columns dropped by migration `1724800000000-DropZcaPassiveTrackingColumns`, which also strips `requireMention` from `direct_interaction`).

## Message Flows (`ZcaBotFeatureService.onMessage`)

Shared gates, in order: (1) `getConfig(threadId, { threadType })` + `isListened` (unlistened → ignore); (2) self-message rules: `message.isSelf` is ignored unless `allowSelf` or `ZCA_SELF_LISTEN`, and messages sent by the backend itself (`isBotSentMessage`) are always ignored. Responsibility split: **Users module = WHO may interact; thread config = HOW the bot behaves in a thread.**

| Flow | Trigger | User access check | Behavior |
|---|---|---|---|
| Pending fast-path | `yes/cancel/edit <code>`, pending image replies | `yes`/`cancel`/reactions: collective (any member). `edit`: pending owner, bot account or granted user only; others ignored silently **before** the card is recalled/deleted (`handleCommand(..., canEdit)`) | `edit` re-issues only the tool of `pending.actionType`; non-tool action types (`create`, `delete`, `BAN_USER`…) cannot be edited (reply: cancel and recreate) |

Pending fast-path input is mention-stripped first (`stripBotMentions`): cut the bot's own mention entities (`data.mentions` with `uid === api.getOwnId()`, by `pos`/`len`, trailing `, : . -` removed), then `cleanBotMention` (`@bot` aliases, the first matching `triggerPrefixes` entry). Other members' mentions are kept. So `@Đen edit 125 …` / `@bot yes 123` reach `handleCommand` as `edit 125 …` / `yes 123` and never fall through to the LLM.
| L3 passive media | image/video/file/voice, `mediaBackup.enabled` + type flag on | None — group storage, every member is backed up | Upload to Drive + Photos album (dedup via Redis set `zca:synced_media:<threadId>`), saves album info to thread config (never the upload's Drive sub-folder); no OCR, no LLM |
| L1 direct | Group: `@bot`/bot-name regex, mention entity, or text starting with a `triggerPrefixes` entry (case-insensitive). 1-1 chat: any non-empty text. Media without text never triggers | `InitialAdminBootstrapGuard` + `GrantAccessGuard` (replies with denial, `registerPendingUser`) + cooldown with reply; bot account bypasses | Full tool set; free chat per `allowAiChat` |
| Not addressed | Everything else (group text without mention/prefix, any media without text) | None | Ignored: no LLM call, no access check, no reply. Rationale: the bot only works when a user explicitly asks; it also avoids one LLM request per group message |

The official Zalo Bot webhook (`apps/api/src/zalo/input-processor.service.ts`) is a separate path and is not gated by mention.

Image/video handling inside L1:
- Quote-reply to an image/video with a trigger: storage instruction (`isStorageUploadInstruction`, e.g. "@bot lưu ảnh này lên drive") → Drive/Photos upload; otherwise **mandatory OCR context** → `TextInputService.process` (type `image`) for any intent (expense, calendar, task, reminder).
  - URL resolution (`extractQuotedImageUrl`): real Zalo photo quotes (`cliMsgType: 32`) carry the URL in the nested JSON string `quote.attach.params.hd`. Order: `params.hd` → `params.rawUrl` → `params.oriUrl` → `attach.href` → `hdUrl` → `thumb` → `url`; only `http(s)://` or `data:image/`. Unresolvable photo quote → `warn` log, falls through to plain text flow.
  - `prepareImageOcrContext` (shared by quoted and captioned images): fetch → `OcrService.extractTextFromBuffer` → bill archive upload (`uploadBill`, Drive link replaces the CDN URL) → `buildImageOcrPrompt`. Logs `<Quoted|Direct> image in thread X -> OCR N chars`; OCR text only at DEBUG.
  - Prompt (neutral, not bill-framed): `[Văn bản trích từ ảnh đính kèm (OCR, có thể sai chính tả):\n<ocr ≤2000 chars>]\nYêu cầu của người dùng: <instruction>`. Empty OCR → `[Ảnh đính kèm không đọc được chữ qua OCR]` marker, still forwarded. Empty instruction → `Ghi nhận hóa đơn này`.
- Captioned image with trigger: same split (save vs. mandatory OCR context). Image without text (group or 1-1) → only L3 backup; to process it, reply to the image with a mention/prefix (1-1: any text) — the quote flow above OCRs it and combines it with the request.
- Video with trigger → upload to Drive/Photos and reply with summary.
- Every listened message is buffered (last 200, Redis `zca:buffered_msgs:<threadId>`, 7 days) as a fallback for history sync.

- Full LLM tool set `ZALO_TOOL_DEFINITIONS` has 14 tools: `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS` (called through `LlmService`).

## Reactions (`onReaction`)

Requires `isListened` and `confirmationRules.allowReactions`; same self rules. Extracts target `gMsgID`/`cMsgID` from `rMsg` and calls `TransactionConfirmationService.handleReaction`: ❤️ counts towards `requiredHearts` (bot posts "❤️ x/y"), 😡 cancels. Matching is strict: the reaction must target the pending card itself — Redis `pending:tx:msg:<msgId>` or in-memory `messageId === msgId` / `cliMsgId === cliMsgId`, same chat, not expired. No fallback to the latest pending of the chat/user (a heart on any other message, e.g. a previous success notice, is ignored with a DEBUG log). A foreign message never overwrites `pending.cliMsgId` or joins the code's recall list; `cliMsgId` is only backfilled when the card had none. Each pending card copies `requiredHearts` from the thread's saved `confirmationRules` when it is created (`ThreadConfigService.findStoredConfig`), so later config edits do not change open cards.

## Media history sync (`syncThreadMediaHistory`)

- `POST /api/zca/threads/:threadId/sync-media` with `SyncThreadMediaDto` (`limit` ≤ 500, `timeRange: SyncMediaTimeRange` = `all` | `1_month` | `2_months` | `3_months` | `6_months`, `sinceTimestamp`, `mediaTypes`).
- Requires ZCA logged in (401 otherwise); group threads only (1-1 returns a message with zero counts).
- Reads `getGroupChatHistory`; if Zalo's history API fails, falls back to buffered messages, else returns `warning: 'zalo_history_api_unavailable'`. Skips already-synced `msgId`s. Response `SyncThreadMediaResponse` (scanned/found/synced/skipped/failed counts).
- Web: `SyncMediaModal` (`apps/web/src/modules/zca/view/sync-media-modal.tsx`) chooses time range and media types.

## Group vs User Channel Detection

- ZCA group ids are plain numbers (same shape as user UIDs); only legacy Bot API ids carry `g-` / `group_`.
- `ThreadConfigService.isGroupThread(id)`: stored `threadType` from memory → Redis → DB (never creates a config); fallback `hasLegacyGroupPrefix(id)` only when nothing is stored.
- Drive folder persistence (`GET_STORAGE_LINKS`, `SHARE_DRIVE`, `google-resources.controller` share/folder-link): group → `ThreadConfigService.saveDriveFolderInfo` only; user → `UsersService.saveDriveFolderInfo` only.
- `createDefaultThreadConfig`, `saveDriveFolderInfo`/`savePhotosAlbumInfo` (new entity) and `ZcaService.resolveThreadType` use the same rule.
- Stored `threadType` must come from zca-js, never from the id. Callers that know the type pass it as `getConfig(id, { threadType })`:
  - `ZcaBotFeatureService.onMessage` (`message.type`), `onReaction` (`reaction.isGroup`).
  - `ZcaService.setListenedThreadIds` / `toggleListenedThread` → `ThreadConfigService.setListened(id, flag, { threadType })`, type from `knownThreadTypes` (zca-js thread list/events only; the whitelist fallback in `getAvailableThreads` guesses `group` and is ignored).
- `getConfig`: when `meta.threadType` is given and differs from the stored value, it overwrites it and persists to DB + Redis (independent of `threadName` changes). `confirmationRules.requiredHearts` is not touched.
- Self-heal of legacy rows: after a successful fresh fetch, `getAvailableThreads` calls `ThreadConfigService.reconcileThreadTypes` (fire-and-forget) with ZCA-confirmed types. It only fixes existing configs and never creates new ones.
- No SQL migration: numeric group ids and user UIDs cannot be told apart in the DB. `users:cleanup-groups` reads `thread_type='group'`, so run it after the ZCA threads page or Users sync has loaded the thread list once post-deploy.

## Backend API

`ZcaController` (`@Controller('zca')`, global prefix `/api`):

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/zca/status` | `loggedIn`, `ownId`, `isListening`, `listenedCount`, `proxyEnabled`, `qrStatus` |
| GET | `/api/zca/qr` | Latest QR as PNG (404 if none) |
| POST | `/api/zca/login-qr` | Starts QR login (`{ forceNew? }`), waits ≤4s for the QR, returns `{ message, qrUrl, code }` |
| POST | `/api/zca/logout` | Logout and clear session |
| GET | `/api/zca/threads?refresh=true` | Groups + friends (`AvailableThread[]`) |
| GET | `/api/zca/listened-threads` | Listened thread ids |
| PUT | `/api/zca/listened-threads` | Replace listened list `{ threadIds }` |
| POST | `/api/zca/listened-threads/toggle` | Toggle one `{ threadId }` |
| GET | `/api/zca/thread-configs` | All configs |
| GET | `/api/zca/thread-configs/:threadId` | One config (creates and persists a default config if missing) |
| PUT | `/api/zca/thread-configs/:threadId` | `UpdateThreadBotConfigDto`; also syncs listened list when `isListened` is sent |
| POST | `/api/zca/threads/:threadId/sync-media` | Media history sync |

`GoogleResourcesController` links used by the ZCA page: `GET /api/drive/folder-link?channelId=&threadName=`, `GET /api/drive/open` (302 to folder), `POST /api/drive/share` (`{ channelId, email }`), `GET /api/photos/album-link`, `GET /api/photos/open` (302 to album).

### Channel Storage Links

Why: the table's Drive/Photos links used to jump between folders because every upload overwrote `driveFolderUrl` with its own month sub-folder, while share/storage-link tools stored `zalobot/<channelId>` and ignored `customFolder`.

- **Drive root** (`resolveChannelDriveRoot` in `google/channel-storage.util.ts`, `getThreadDriveRoot(config)`): `mediaBackup.customFolder` (slash-trimmed) else `zalobot/<channelId>`. Uploads still go to `<root>/<category>/<YYYY-MM>` or `<customFolder>/<YYYY-MM>`; links always point at the root.
- **Photos album** (`resolveChannelPhotosAlbumTitle`, `getThreadPhotosAlbumTitle(config)`): `mediaBackup.photosAlbum` → stored `photosAlbumTitle` → `[Zalo] <threadName>` → `[Zalo] Nhóm <channelId>`. Used by all three upload paths and by `/api/photos/*`.
- `ThreadConfigService.saveDriveFolderInfo` ignores any `folderPath` that is not the root; `savePhotosAlbumInfo` ignores a title other than the channel album. Media uploads no longer call `saveDriveFolderInfo`.
- `withoutStaleStorageLinks(config)` runs on every load (`entityToConfig`, Redis/JSON cache) and at the end of `updateConfig`: drops `driveFolder*` whose path is not the root, and `photosAlbum*` whose title differs from a `photosAlbum` override. Changing `customFolder`/`photosAlbum` in the modal therefore clears the cached links (the modal echoes them back). Stale DB values are not rewritten; they are dropped on read and replaced on the next resolve.
- `/api/drive/*` and `/api/photos/*` use a cached URL only when it matches the root/album; otherwise they resolve (`getFolderWebLink` / `getAlbumLink`) and save it. `POST /api/drive/share`, `GET_STORAGE_LINKS` and `SHARE_DRIVE` share/store the same root.
- Web labels: `getThreadDriveFolderLabel` / `getThreadPhotosAlbumLabel` (`api/zca-api.ts`) mirror these rules for tooltips in `ChatTableRow`, `ThreadConfigModal`, `SyncMediaModal`.

### Access control

- Every `ZcaController` route is **admin-only**: `requireDashboardAdmin` (`dashboard-auth/dashboard-user.ts`) needs a Bearer dashboard access token (401 otherwise) whose user passes `UsersService.isAdmin` (403 otherwise). Rationale: these routes log the bot's personal Zalo account in/out, change which chats it listens to, and `status` exposes `qrStatus.code` (the raw QR payload), which would let anyone hijack an in-progress QR login.
- `GET /api/zca/qr` is opened by `<img src>` on the dashboard and by the link the bot sends to Zalo, neither of which can send a header. It accepts any one of: valid `?key=` QR access key, Bearer admin token, or the admin's `reports_refresh` cookie.
- QR access key: `ZcaService` creates a random 32-byte base64url key when a new QR login flow starts (`startQrLogin`, not on flow reuse) and revokes it when that flow ends (success or failure) or on `logout()`; a `forceNew` flow only revokes its own key. `getQrImageUrl()` returns `${APP_URL}/api/zca/qr?key=…` while a flow is active (used by `POST /zca/login-qr` and the `/zalo-login` chat reply); `isQrAccessKeyValid` compares with `timingSafeEqual`. Logs print the URL without the key.
- Drive/Photos link routes used by this page are admin-only too (see `global/backend-runtime-services.md`).

## Web UI (`ZcaScreen` — page "Zalo & Users", route `APP_ROUTES.zca`)

The former Users page (`/users`) was removed; user management lives here. Nav label key `nav.zca` = "Zalo & Người dùng" / "Zalo & Users".

- **Why one page**: a 1-1 ZCA thread and a `users` row are the same Zalo person (`thread.id === users.id`). Two pages forced admins to toggle listening and access in different places without seeing each other's state.
- **Two independent controls per person** (deliberately not coupled):
  - Listening (`zca_thread_configs.is_listened`, `toggleZcaListenedThread`): does the bot receive messages from that thread.
  - Interaction access (`users.grantAccess` / role, `PATCH usersGrantAccess(id)`): may that person use bot features. Granting on a personal thread with no `users` row creates it (backend `setGrantAccess` upserts).
- **Row model** (`apps/web/src/modules/zca/model/chat-rows.ts`, pure, tested in `chat-rows.spec.ts`): `buildChatRows(threads, users)` →
  - `group`: ZCA group thread; access column `n/a` (groups are never users, even if a stray `users` row shares the id).
  - `personal`: ZCA user thread joined to `users` by id; access `admin|granted|pending` (`pending` = `grantAccess` DENIED), or `none` when no `users` row.
  - `user-only`: `users` row without a ZCA thread (webhook 20-hex ids, non-friend group members). Shown even when ZCA is logged out.
  - Name/avatar prefer ZCA thread data, fall back to `users`.
- **Screen (`apps/web/src/modules/zca/view/zca-screen.tsx`)**:
  - Header: refresh, QR login / logout. QR modal polls status and auto-closes on login.
  - Cards: connection (+ listener state), listened count, interaction access (pending count, click → `pending` filter), total rows.
  - Toolbar: "Đồng bộ thông tin" (`usersSyncZca`), "+ Thêm người dùng" (`UserFormDialog` create), Drive root link, manual ID form (adds id to listened list only).
  - Filters (`ChatRowFilter`): all, listened, group, personal (personal + user-only), pending (`pending|none`), granted (`granted|admin`), admin. Sorts (`ChatRowSort`) incl. `pending_first`. Accent-insensitive search over name, alias, Zalo name, username, phone, id. Pagination.
  - Columns: type, name/identity, id (copy), Listening (clickable pill + config badges: `🤖 @Bot` for groups with prefixes in the tooltip, `🤖 Chat riêng` for 1-1, Drive/Photos links; `—` for user-only), Interaction access (badge + grant/revoke; revoking an admin asks confirmation; `—` for groups), actions.
  - Actions (`presentation/components/chat-table-row.tsx`): group media history sync (`SyncMediaModal`), Drive link and Photos album link (`getThreadDriveLink` / `getThreadPhotosLink`: stored URL, else `/api/drive/open` / `/api/photos/open`), `ThreadConfigModal` (thread rows only); "⋯" menu (`chat-row-menu.tsx`, fixed-positioned to escape table overflow) for non-group rows: edit info & role (`UserFormDialog` edit; or create prefilled when no `users` row), merge (`MergeUserDialog` from users module), view linked contacts (`LinkedContactsDialog` from users module), delete (non-admin, confirm). Rows with `user.linkedContactCount > 0` show a clickable badge "🔗 N" next to the name that opens the same dialog.
- **`ThreadConfigModal`** (`view/thread-config-modal.tsx`): listening; direct interaction (enabled, a read-only note explaining the trigger rule for group vs 1-1, `allowAiChat`, `allowSelf`, trigger prefixes via `TriggerPrefixInput` — chip input in `presentation/components/trigger-prefix-input.tsx`: Enter/comma/"Thêm" commits, × or Backspace on empty input removes, inline error per `validateTriggerPrefix`, warning when `/` is a prefix); media backup (enabled, images/videos/files/audios, `notifyInThread`, `customFolder`, `fileSuffix`, `photosAlbum`); confirmation rules (`allowReactions`, `requiredHearts`, `timeoutMinutes`); channel Drive/Photos links.
- Web API (`api/zca-api.ts`, `api/zca-query.ts`): status, QR login/logout, threads (+ refresh), listened threads (get/set/toggle), thread configs (list/one/update), Drive folder link, `syncThreadMedia` (`useSyncThreadMediaMutation`).

- QR login modal, `ThreadConfigModal`, `SyncMediaModal`, `UserFormDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard). `ThreadConfigModal` no longer caps its form at `75vh`; the panel scrolls.

## Integration Seams & Contracts

- `API_ROUTES`: `zcaStatus`, `zcaQr`, `zcaLoginQr`, `zcaLogout`, `zcaThreads`, `zcaListenedThreads`, `zcaListenedThreadsToggle`, `zcaThreadConfigs`, `zcaThreadConfig(threadId)`, `zcaSyncThreadMedia(threadId)`, `driveFolderLink`, `driveOpen`, `photosAlbumLink`, `photosOpen`. Web builds the QR image URL with `getZcaQrImageUrl()` (`API_ROUTES.zcaQr` on `resolveApiBaseUrl()`).
- Contracts (`packages/contracts`): `ThreadBotConfig`, `UpdateThreadBotConfigDto`, `ThreadDirectInteractionConfig`, `ThreadMediaBackupConfig`, `ThreadConfirmationConfig`, `TRIGGER_PREFIX_LIMITS`, `TriggerPrefixError`, `validateTriggerPrefix`, `normalizeTriggerPrefixes`, `findTriggerPrefix` (shared by API routing, `cleanBotMention` and the web chip input), `SyncThreadMediaDto`, `SyncMediaTimeRange`, `SyncThreadMediaResponse`.
- Env (`apps/api/src/config/configuration.ts` `zca.*`): `DATA_DIR`/`ZCA_DATA_DIR`, `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN`, `ZCA_CHECK_UPDATE`, `ZCA_LOGGING`, `ZCA_AUTO_LOGIN`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`.

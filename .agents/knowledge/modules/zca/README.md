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
- **Pending image** (`pending-image/`): `ImageBatchHandler` (1s debounce per sender) shows a menu for an uncaptioned 1-1 image; `PendingImageActionService` keeps the pending image (memory + Redis `pending:image:user:<userId>`, 5 min). `PendingImageActionDispatcher` (`pending-image-dispatcher.service.ts`) strategies: `CreateBillPendingImageStrategy` (`1` / `tạo bill [note]` → OCR + LLM with `ZALO_TOOL_DEFINITIONS`), `StorageUploadPendingImageStrategy` (`2` / `lưu drive|ảnh|photo` → Drive/Photos), `CancelPendingImageStrategy` (`hủy`, `cancel`, `bỏ qua`, `không`…).
- **Group events**: `GroupEventDispatcher` with `WelcomeGroupEventStrategy` (registered by default). Handles `JOIN` (not self) only when enabled (`ZCA_ENABLE_WELCOME=true` / `zca.enableWelcome`); sends "Chào mừng @name đến với nhóm!" (or multi-member text) with optional image `ZCA_WELCOME_IMAGE_PATH` (default `./welcome.jpg`).

## Per-thread configuration (`ThreadBotConfig`)

| Field | Default (`createDefaultThreadConfig`) | Meaning |
| --- | --- | --- |
| `threadType` | from zca-js, else legacy prefix, else `user` | `user` / `group` |
| `isListened` | `false` | Bot receives messages from this thread |
| `directInteraction.enabled` | `false` | Direct mode on |
| `directInteraction.requireMention` | `true` (all thread types) | Needs `@bot`/mention/prefix to trigger L1 |
| `directInteraction.triggerPrefix` | `''` | Custom prefix, e.g. `!bot` |
| `directInteraction.allowAiChat` | `false` | Free chat in L1: adds the chit-chat block to the LLM prompt and a tool-free second pass (see [Zalo Command Intake](../../global/zalo-command-intake.md)); `false` = silent on non-tool replies |
| `directInteraction.allowSelf` | `false` | Process messages sent by the bot account itself |
| `mediaBackup.enabled` + `uploadImages/Videos/Files/Audios` | all `false` | L3 auto backup per type |
| `mediaBackup.notifyInThread` | `false` | Post Drive/Photos links after auto backup |
| `mediaBackup.customFolder` | `zalobot/<sanitized threadName>` when name known, else `''` | Drive folder override |
| `mediaBackup.fileSuffix` | `_<sanitized name or id>` | Filename suffix |
| `mediaBackup.photosAlbum` | `''` | Google Photos album title override |
| `expenseTracking.enabled` / `requireConfirm` | `false` / `false` | L2 passive expense tools |
| `calendarExtraction.enabled` / `requireConfirm` | `false` / `false` | L2 passive calendar tools |
| `confirmationRules.allowReactions` | `false` | ❤️/😡 reactions confirm/cancel |
| `confirmationRules.requiredHearts` | group `5`, user `1` | Hearts needed |
| `confirmationRules.timeoutMinutes` | `5` | Pending timeout |
| `driveFolderId/Url/Path`, `photosAlbumId/Url/Title` | unset | Channel Drive partition `zalobot/<channelId>` and per-group Photos album |

- `setListened(id, true)` on a thread whose `directInteraction.enabled` is false also enables it with `allowAiChat: true` (keeps `requireMention`).
- Known gap: `expenseTracking.requireConfirm` / `calendarExtraction.requireConfirm` are stored and editable in `ThreadConfigModal` but no backend code reads them.

## Message Flows (`ZcaBotFeatureService.onMessage`)

Shared gates, in order: (1) `getConfig(threadId, { threadType })` + `isListened` (unlistened → ignore); (2) self-message rules: `message.isSelf` is ignored unless `allowSelf` or `ZCA_SELF_LISTEN`, and messages sent by the backend itself (`isBotSentMessage`) are always ignored. Responsibility split: **Users module = WHO may interact; thread config = HOW the bot behaves in a thread.**

| Flow | Trigger | User access check | Behavior |
|---|---|---|---|
| Pending fast-path | `yes/cancel/edit <code>`, pending image replies | `yes`/`cancel`/reactions: collective (any member). `edit`: pending owner, bot account or granted user only; others ignored silently **before** the card is recalled/deleted (`handleCommand(..., canEdit)`) | `edit` re-issues only the tool of `pending.actionType`; non-tool action types (`create`, `delete`, `BAN_USER`…) cannot be edited (reply: cancel and recreate) |
| L3 passive media | image/video/file/voice, `mediaBackup.enabled` + type flag on | None — group storage, every member is backed up | Upload to Drive + Photos album (dedup via Redis set `zca:synced_media:<threadId>`), saves folder/album info to thread config; no OCR, no LLM |
| L1 direct | `@bot`/bot-name regex, mention entity, `triggerPrefix`, or `enabled && !requireMention`; also an uncaptioned image in 1-1 | `InitialAdminBootstrapGuard` + `GrantAccessGuard` (replies with denial, `registerPendingUser`) + cooldown with reply; bot account bypasses | Full tool set; free chat per `allowAiChat` |
| L2 passive text | text without trigger, `expenseTracking` and/or `calendarExtraction` on | Silent: owner bypass, else `isGrantAccess` must be true; cooldown (2s, in-memory) drops silently. Never replies, never registers pending users | LLM sees only the allowlist; empty allowlist → no LLM call; tools outside allowlist are skipped; never free chat |

Image/video handling inside L1:
- Quote-reply to an image/video with a trigger: storage instruction (`isStorageUploadInstruction`, e.g. "@bot lưu ảnh này lên drive") → Drive/Photos upload; otherwise OCR + bill upload → `TextInputService.process` (type `image`).
- Captioned image with trigger: same split (save vs. OCR bill). Uncaptioned 1-1 image → `ImageBatchHandler` menu. Group image without trigger → only L3 backup.
- Video with trigger → upload to Drive/Photos and reply with summary.
- Every listened message is buffered (last 200, Redis `zca:buffered_msgs:<threadId>`, 7 days) as a fallback for history sync.

- Passive allowlist (`apps/api/src/zalo/text/text-tool.definitions.ts`): `expenseTracking` → `PASSIVE_EXPENSE_TOOLS` (`RECORD_TRANSACTION`, `MANAGE_DEBT`); `calendarExtraction` → `PASSIVE_CALENDAR_TOOLS` (`CREATE_CALENDAR_EVENT`, `SET_REMINDER`). Passed as `AgentInput.allowedTools` with `passiveOnly: true`.
- Full LLM tool set `ZALO_TOOL_DEFINITIONS` has 14 tools: `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS` (called through `LlmService`).
- Passive LLM call uses a dedicated system instruction listing only allowlisted tools and no typing indicator (`withChatAction`), so un-mentioned chat leaves no visible trace.
- Known trade-off: L2 shares `UsersService.checkCooldown` with L1, so two expense lines within 2s lose the second one, and a passive message right before `@bot` makes L1 reply "too fast".

## Reactions (`onReaction`)

Requires `isListened` and `confirmationRules.allowReactions`; same self rules. Extracts target `gMsgID`/`cMsgID` from `rMsg` and calls `TransactionConfirmationService.handleReaction`: ❤️ counts towards `requiredHearts` (bot posts "❤️ x/y"), 😡 cancels. Each pending card copies `requiredHearts` from the thread's saved `confirmationRules` when it is created (`ThreadConfigService.findStoredConfig`), so later config edits do not change open cards.

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
  - Columns: type, name/identity, id (copy), Listening (clickable pill + config badges; `—` for user-only), Interaction access (badge + grant/revoke; revoking an admin asks confirmation; `—` for groups), actions.
  - Actions (`presentation/components/chat-table-row.tsx`): group media history sync (`SyncMediaModal`), Drive link and Photos album link (`getThreadDriveLink` / `getThreadPhotosLink`: stored URL, else `/api/drive/open` / `/api/photos/open`), `ThreadConfigModal` (thread rows only); "⋯" menu (`chat-row-menu.tsx`, fixed-positioned to escape table overflow) for non-group rows: edit info & role (`UserFormDialog` edit; or create prefilled when no `users` row), merge (`MergeUserDialog` from users module), delete (non-admin, confirm).
- **`ThreadConfigModal`** (`view/thread-config-modal.tsx`): listening; direct interaction (enabled, `requireMention`, `allowAiChat`, `allowSelf`, `triggerPrefix`); media backup (enabled, images/videos/files/audios, `notifyInThread`, `customFolder`, `fileSuffix`, `photosAlbum`); expense tracking and calendar extraction (enabled, `requireConfirm`); confirmation rules (`allowReactions`, `requiredHearts`, `timeoutMinutes`); channel Drive/Photos links.
- Web API (`api/zca-api.ts`, `api/zca-query.ts`): status, QR login/logout, threads (+ refresh), listened threads (get/set/toggle), thread configs (list/one/update), Drive folder link, `syncThreadMedia` (`useSyncThreadMediaMutation`).

## Integration Seams & Contracts

- `API_ROUTES`: `zcaStatus`, `zcaQr`, `zcaLoginQr`, `zcaLogout`, `zcaThreads`, `zcaListenedThreads`, `zcaListenedThreadsToggle`, `zcaThreadConfigs`, `zcaThreadConfig(threadId)`, `zcaSyncThreadMedia(threadId)`, `driveFolderLink`, `driveOpen`, `photosAlbumLink`, `photosOpen`. Web builds the QR image URL with `getZcaQrImageUrl()` (`API_ROUTES.zcaQr` on `resolveApiBaseUrl()`).
- Contracts (`packages/contracts`): `ThreadBotConfig`, `UpdateThreadBotConfigDto`, `ThreadDirectInteractionConfig`, `ThreadMediaBackupConfig`, `ThreadExpenseConfig`, `ThreadCalendarConfig`, `ThreadConfirmationConfig`, `SyncThreadMediaDto`, `SyncMediaTimeRange`, `SyncThreadMediaResponse`.
- Env (`apps/api/src/config/configuration.ts` `zca.*`): `DATA_DIR`/`ZCA_DATA_DIR`, `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN`, `ZCA_CHECK_UPDATE`, `ZCA_LOGGING`, `ZCA_AUTO_LOGIN`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`.

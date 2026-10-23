# ZCA (Zalo Client Account) Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/zca/README.md)

## Purpose

`apps/api/src/zca` and `apps/web/src/modules/zca` connect a personal Zalo account through `zca-js` (WebSocket), route its events (messages, reactions, group events), store per-thread bot configuration, back up media to Google Drive/Photos, and host the "Zalo & Users" admin page.

## Backend services

- **`ZcaService`** (connection & session):
  - QR login (`startQrLogin`, `loginQR`), chat commands `/zalo-login`, `/zca-login`, `/zlogin` and `/zalo-logout`, `/zca-logout`, `/zlogout`; CLI `npm run zca:login --workspace @zalobot/api` (`apps/api/scripts/zca-login.ts`).
  - Session persisted to file `.zca-session.json` in `DATA_DIR` (default `./data`, resolved from cwd; `npm run zca:login` uses the same default) and to Redis key `zca:session`. Restore order: file → Redis (then rewritten to file). Bootstrap auto-login has no flag: `onApplicationBootstrap` calls `login()` when `ZCA_IMEI` + `ZCA_COOKIE` are configured or a saved session exists; otherwise it logs a hint and waits for QR login. `logout()` clears file + Redis.
  - Caches `msgId → cliMsgId` in memory and Redis `zca:msg:cli:<msgId>` (TTL 24h). `undo(payload, threadId)` resolves thread type and the real `cliMsgId` to avoid Zalo "Lỗi không xác định". `deleteMessage(dest, onlyMe)` is the fallback.
  - `getAvailableThreads(forceRefresh)` lists groups/friends from the Redis directory cache `zca:directory:<ownId>` (7-day stale-while-revalidate; Zalo is called only when empty, stale, or on `forceRefresh`). See [Directory Cache](directory-cache.md). `setListenedThreadIds` / `toggleListenedThread` sync listening state to `ThreadConfigService`.
  - Event dispatch: `dispatchMessage`, `dispatchReaction`, `dispatchGroupEvent` (→ `GroupEventDispatcher`), friend/undo/typing/seen/delivered events to registered plugins.
- **`ZcaBotFeatureService`**: `onMessage`, `onReaction`, `onUndo` (chat-memory recall), `init` (chat-memory backfill), `syncThreadMediaHistory` (see below).
- **`ChatMemoryService`** (`memory/`, own `ChatMemoryModule`) + `ZcaMessageEntity` (table `zca_messages`): stores listened-thread messages and serves `SEARCH_CHAT_HISTORY`. See [Chat Memory](chat-memory.md).
- **`ChannelStorageLinkService`** (`storage/`, own `ChannelStorageLinkModule`) + `ChannelStorageLinkEntity` (table `channel_storage_links`): history of every Drive root / Photos album a channel used, across Google accounts. See [Channel Storage](channel-storage.md).
- **`ThreadConfigService`** + `ZcaThreadConfigEntity` (table `zca_thread_configs`): memory → Redis `zca:thread_config:<id>` (TTL 24h) → DB. Listened set in Redis `zca:listened_threads`.
- **`TransactionConfirmationService`** (`confirmation/`): pending actions (`yes/cancel/edit <code>`, reactions), message recall.
- **Guards** (`guards/`): `InitialAdminBootstrapGuard`, `GrantAccessGuard` (`canActivate(input, { threadGrant })`).
- **Thread access** (`access/`): `ThreadAccessService` picks a `ThreadAccessPolicy` per thread kind (`GroupMemberAccessPolicy`, `PersonalAccessPolicy`) to grant access in one group on top of global access. See [Member Access](member-access.md).
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
| `chatMemory.enabled` / `contextWindow` / `searchLimit` | `false` / `10` / `15` | Chat memory of this thread (store, search, prompt context); clamped by `normalizeChatMemoryConfig`. See [Chat Memory](chat-memory.md) |
| `memberAccess.mode` / `memberIds` | `granted-users` / `[]` | Who may call the bot in this group besides admins and globally granted users: `granted-users` (nobody extra), `all-members`, `selected-members` (`memberIds`); groups only, normalized by `normalizeMemberAccessConfig`. See [Member Access](member-access.md) |
| `driveFolderId/Url/Path`, `photosAlbumId/Url/Title` | unset | Legacy cached link to the channel storage root / album; the dashboard lists `channel_storage_links` instead (see [Channel Storage](channel-storage.md)) |

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
| L1 direct | Group: `@bot`/bot-name regex, mention entity, or text starting with a `triggerPrefixes` entry (case-insensitive). 1-1 chat: any non-empty text. Media without text never triggers Checked once, right after the trigger is resolved (`checkDirectGuardsAndCooldown`): bot account bypasses → `InitialAdminBootstrapGuard` → `GrantAccessGuard` with `threadGrant` from `ThreadAccessService` (replies with denial, `registerPendingUser`) → cooldown with reply ([Member Access](member-access.md)) | Full tool set; free chat per `allowAiChat` |
| Not addressed | Everything else (group text without mention/prefix, any media without text) | None | Ignored: no LLM call, no access check, no reply. Rationale: the bot only works when a user explicitly asks; it also avoids one LLM request per group message |

Image/video handling inside L1:
- Quote-reply to an image/video with a trigger: storage instruction (`isStorageUploadInstruction`, e.g. "@bot lưu ảnh này lên drive") → Drive/Photos upload; otherwise **mandatory OCR context** → `TextInputService.process` (type `image`) for any intent (expense, calendar, task, reminder).
  - URL resolution (`extractQuotedImageUrl`): real Zalo photo quotes (`cliMsgType: 32`) carry the URL in the nested JSON string `quote.attach.params.hd`. Order: `params.hd` → `params.rawUrl` → `params.oriUrl` → `attach.href` → `hdUrl` → `thumb` → `url`; only `http(s)://` or `data:image/`. Unresolvable photo quote → `warn` log, falls through to plain text flow.
  - `prepareImageOcrContext` (shared by quoted and captioned images): fetch → `OcrService.extractTextFromBuffer` → bill archive upload (`uploadBill`, Drive link replaces the CDN URL) → `buildImageOcrPrompt`. Logs `<Quoted|Direct> image in thread X -> OCR N chars`; OCR text only at DEBUG.
  - Prompt (neutral, not bill-framed): `[Văn bản trích từ ảnh đính kèm (OCR, có thể sai chính tả):\n<ocr ≤2000 chars>]\nYêu cầu của người dùng: <instruction>`. Empty OCR → `[Ảnh đính kèm không đọc được chữ qua OCR]` marker, still forwarded. Empty instruction → `Ghi nhận hóa đơn này`.
- Captioned image with trigger: same split (save vs. mandatory OCR context). Image without text (group or 1-1) → only L3 backup; to process it, reply to the image with a mention/prefix (1-1: any text) — the quote flow above OCRs it and combines it with the request.
- Video with trigger → upload to Drive/Photos and reply with summary.
- Every listened message is buffered (last 200, Redis `zca:buffered_msgs:<threadId>`, 7 days) as a fallback for history sync, and, when the thread has `chatMemory.enabled`, stored in `zca_messages` ([Chat Memory](chat-memory.md)).

- Full LLM tool set `ZALO_TOOL_DEFINITIONS` has 15 tools: `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY` (called through `LlmService`).

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
- Self-heal of legacy rows: after each fetch from Zalo (not on cache reads), the directory cache calls `ThreadConfigService.reconcileThreadTypes` (fire-and-forget) with ZCA-confirmed types. It only fixes existing configs and never creates new ones.
- No SQL migration: numeric group ids and user UIDs cannot be told apart in the DB. `users:cleanup-groups` reads `thread_type='group'`, so run it after the ZCA threads page or Users sync has loaded the thread list once post-deploy.

## Backend API

`ZcaController` (`@Controller('zca')`, global prefix `/api`):

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/zca/status` | `loggedIn`, `ownId`, `isListening`, `listenedCount`, `proxyEnabled`, `qrStatus` |
| GET | `/api/zca/qr` | Latest QR as PNG (404 if none) |
| POST | `/api/zca/login-qr` | Starts QR login (`{ forceNew? }`), waits ≤4s for the QR, returns `{ message, qrUrl, code }` |
| POST | `/api/zca/logout` | Logout and clear session |
| GET | `/api/zca/threads?refresh=true` | `{ threads: AvailableThread[], fetchedAt }` from the directory cache; `refresh=true` re-fetches from Zalo ([Directory Cache](directory-cache.md)) |
| GET | `/api/zca/listened-threads` | Listened thread ids |
| PUT | `/api/zca/listened-threads` | Replace listened list `{ threadIds }` |
| POST | `/api/zca/listened-threads/toggle` | Toggle one `{ threadId }` |
| GET | `/api/zca/thread-configs` | All configs |
| GET | `/api/zca/thread-configs/:threadId` | One config (creates and persists a default config if missing) |
| PUT | `/api/zca/thread-configs/:threadId` | `UpdateThreadBotConfigDto`; also syncs listened list when `isListened` is sent |
| DELETE | `/api/zca/thread-configs/:threadId` | Deletes the config of a chat Zalo no longer returns (409 if still in the directory cache, 404 if no config); keeps chat memory and storage-link history. See [Directory Cache](directory-cache.md#deleting-a-placeholder-chat) |
| POST | `/api/zca/threads/:threadId/sync-media` | Media history sync |
| GET | `/api/zca/threads/:threadId/storage-links` | Every Drive root / Photos album of the thread across Google accounts (`ChannelStorageLinksResponse`); see [Channel Storage](channel-storage.md) |
| POST | `/api/zca/threads/:threadId/storage-links` | Add an existing Drive folder / Photos album link to the history by hand (`CreateChannelStorageLinkDto`; 409 if already listed; nothing created on Google) |
| GET | `/api/zca/threads/:threadId/members` | Group members for the member-access picker (`IZcaGroupMembersResponse`, Redis 10 min, `?refresh=true` forces Zalo); 400 ZCA logged out, 404 group not returned. See [Member Access](member-access.md) |
| PATCH / DELETE | `/api/zca/threads/:threadId/storage-links/:linkId` | Edit display name / URL / account email, or remove a link from the history (never the link in use, never data on Google) |

`GoogleResourcesController` links used by the ZCA page: `GET /api/drive/folder-link?channelId=&threadName=`, `GET /api/drive/open` (302 to folder), `POST /api/drive/share` (`{ channelId, email }`), `GET /api/photos/album-link`, `GET /api/photos/open` (302 to album).

### Channel Storage Links

Why: the table's Drive/Photos links used to jump between folders because every upload overwrote `driveFolderUrl` with its own month sub-folder, while share/storage-link tools stored `zalobot/<channelId>` and ignored `customFolder`.

- **Drive root** (`resolveChannelDriveRoot` in `google/channel-storage.util.ts`, `getThreadDriveRoot(config)`): `mediaBackup.customFolder` (slash-trimmed) else `zalobot/<channelId>`. Uploads still go to `<root>/<category>/<YYYY-MM>` or `<customFolder>/<YYYY-MM>`; links always point at the root.
- **Photos album** (`resolveChannelPhotosAlbumTitle`, `getThreadPhotosAlbumTitle(config)`): `mediaBackup.photosAlbum` → stored `photosAlbumTitle` → `[Zalo] <threadName>` → `[Zalo] Nhóm <channelId>`. Used by every upload path (via `ChannelStorageTarget`, incl. bills) and by `/api/photos/*`.
- Every upload takes a `ChannelStorageTarget` and uses the shared Google account; the history of roots/albums per account lives in `channel_storage_links` ([Channel Storage](channel-storage.md)).
- `ThreadConfigService.saveDriveFolderInfo` ignores any `folderPath` that is not the root; `savePhotosAlbumInfo` ignores a title other than the channel album. Media uploads no longer call `saveDriveFolderInfo`.
- `withoutStaleStorageLinks(config)` runs on every load (`entityToConfig`, Redis/JSON cache) and at the end of `updateConfig`: drops `driveFolder*` whose path is not the root, and `photosAlbum*` whose title differs from a `photosAlbum` override. Changing `customFolder`/`photosAlbum` in the modal therefore clears the cached links (the modal echoes them back). Stale DB values are not rewritten; they are dropped on read and replaced on the next resolve.
- `/api/drive/*` use a cached URL only when it matches the root; otherwise they resolve (`getFolderWebLink`) and save it. `/api/photos/*` read the channel's album of the current Google account from `channel_storage_links` and never use the cached `photosAlbumUrl` (see [channel-storage.md](channel-storage.md)). `POST /api/drive/share`, `GET_STORAGE_LINKS` and `SHARE_DRIVE` share/store the same root.
- Web labels: `getThreadDriveFolderLabel` / `getThreadPhotosAlbumLabel` (`api/zca-api.ts`) mirror these rules for tooltips in `ChatTableRow`, the thread config page (`StorageLinkBanner`), `SyncMediaModal`.

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
  - `user-only`: `users` row without a ZCA thread (legacy 20-hex ids from the removed official-bot webhook, `dashboard-owner`, non-friend group members). Shown even when ZCA is logged out.
  - Name/avatar prefer ZCA thread data, fall back to `users`.
- **Screen (`apps/web/src/modules/zca/view/zca-screen.tsx`)**:
  - Non-admin: when `GET /api/zca/status` answers 403 the whole page is replaced by `ZcaAdminOnlyNotice` (`presentation/components/zca-admin-only-notice.tsx`: "admins only" title, how to get access, link to `APP_ROUTES.home`; keys `zca.forbidden.*`). Status, thread-configs and Drive-link queries do not retry on 403 (`isForbiddenError`), so the notice shows at once. Other status errors keep the normal page.
  - Header: "Cập nhật lúc …" (directory `fetchedAt`), refresh, QR login / logout. QR modal polls status and auto-closes on login.
  - Cards: connection (+ listener state), listened count, interaction access (pending count, click → `pending` filter), total rows.
  - Toolbar: "Đồng bộ thông tin" (`usersSyncZca`), "+ Thêm người dùng" (`UserFormDialog` create), Drive root link, manual ID form (adds id to listened list only).
  - Filters (`ChatRowFilter`): all, listened, group, personal (personal + user-only), pending (`pending|none`), granted (`granted|admin`), admin. Sorts (`ChatRowSort`) incl. `pending_first`. Accent-insensitive search over name, alias, Zalo name, username, phone, id. Pagination.
  - Table state in the URL: search, filter, sort, page and page size are mirrored into the `/zca` query (`?q=&filter=&sort=&page=&size=`, defaults omitted) by `view/use-chat-table-url-state.ts` via `history.replaceState`; parsing/serializing is pure in `model/chat-table-url-state.ts` (tested; unknown values fall back to defaults, `size` must be one of 15/25/50/100/10000). The last query is also kept in `sessionStorage` (`zca:chat-table-query`) for the config page's back link. Changing search/filter/sort/size resets to page 1; a restored page larger than the loaded rows is clamped for display only, so it applies once rows load. `app/(private)/zca/page.tsx` wraps the screen in `<Suspense>` (needed by `useSearchParams` under static export).
  - Table style (`presentation/components/chat-table-row.tsx`): flat, no pills or coloured chips, no emoji in cells. State = text + dot (`●`/`○`), colour only on the text. In-cell buttons are square `h-[22px] rounded-[2px] border` (same as the debts table). Each cell is one line (`whitespace-nowrap`, truncate); only the name cell has 2 lines. Avatar is square `rounded-[3px]`.
  - Columns: type (plain text `Nhóm` / `Cá nhân` / `Người dùng`), name/identity (line 1: name + `(alias)`; line 2 joined by `·`: member count for groups, or Zalo name · phone · `@username`, plus a text link "N người liên quan" when `user.linkedContactCount > 0` that opens `LinkedContactsDialog`), id (copy), Listening (toggle button `● Đang nghe` / `○ Bỏ qua`; `—` for user-only), Features (text joined by `·`, only enabled ones: `@Bot` for groups with prefixes in the tooltip or `Chat riêng` for 1-1, `Nhớ`, `Sao lưu media`; `—` when none), Interaction access (status text + grant/revoke button on the same line; revoking an admin asks confirmation; `—` for groups), actions.
  - Actions: one primary link `Cấu hình` (`APP_ROUTES.zcaThread(id)` → `/zca/thread?id=…`, thread rows only; a real `<Link>`, so Cmd/Ctrl+click opens a new tab) + "⋯" menu (`chat-row-menu.tsx`, fixed-positioned to escape table overflow). Menu for thread rows: open Drive / open Photos (`ThreadStorageLinksDialog`, all roots of the thread across Google accounts), group media history sync (`SyncMediaModal`, groups only), and "🗑️ Xoá cấu hình kênh" only on placeholder rows (`thread.missingFromZalo`, confirm, `useDeleteZcaThreadConfigMutation`; see [Directory Cache](directory-cache.md#deleting-a-placeholder-chat)). Menu for non-group rows adds: "Xem hồ sơ" / "Tạo hồ sơ" for rows with a `users` row (opens the contact profile, creating and linking a contact first when none; `useOpenContactProfile` from the contacts module, see contacts knowledge), edit info & role (`UserFormDialog` edit; or create prefilled when no `users` row), merge (`MergeUserDialog` from users module), view linked contacts (`LinkedContactsDialog` from users module), delete (non-admin, confirm).
- **Thread config page** `/zca/thread?id=<threadId>` (`app/(private)/zca/thread/page.tsx` → `view/thread-config-screen.tsx`). Replaces the former `ThreadConfigModal` (too cramped: 672px wide, 5 sections stacked, 10–11px text). Static export has no dynamic segments, so the id is a query param read with `useSearchParams` inside `<Suspense>`; the nav item "Zalo & Người dùng" stays active (`pathname.startsWith('/zca')`).
  - Identity: name/type come from `useZcaThreadsQuery()` (served from the Redis directory cache, no Zalo call), falling back to the saved config's `threadName`/`threadType` (a chat Zalo no longer lists). Without a known type the page shows "not found" and offers no save, because the update API requires `threadType`.
  - States: missing `id` → message + back link; loading → skeleton; config load error → message + retry; unknown chat → not found; else form.
  - Layout: header (back link to the table with its remembered query, avatar letter, name truncated with `title`, Nhóm/Cá nhân badge, ID `break-all`); body `grid lg:grid-cols-2` — left: listening (`ListenToggleCard`), direct interaction, confirmation rules; right: media backup, chat memory; one column under 1024px. Action bar `sticky bottom-0` with save status (saved / failed) and "Lưu cấu hình"; there is no close button and saving keeps the user on the page. The bar spans exactly the form width with no negative margin: the private layout's content section is `overflow-y-auto` without padding on desktop, so any overhang turns into a horizontal scrollbar.
  - Sections (`presentation/components/thread-config/`, each file ≤ ~100 lines): `ConfigSectionCard` (icon, title, description, enable switch; children only while enabled), `ConfigToggleRow` + `ConfigSwitch` (one switch component with `role="switch"`, `aria-label`, focus ring; sizes lg/md/sm; the track is `relative` so the knob (`::after`) is placed against the track, not the label that grows into a 40×40px tap area on phones — without it the knob sits at the top of that area), `ConfigField` (label bound to input, hint via `aria-describedby`). Direct interaction: read-only trigger-rule note for group vs 1-1, `allowAiChat`, `allowSelf`, trigger prefixes via `TriggerPrefixInput` (chip input in `presentation/components/trigger-prefix-input.tsx`: Enter/comma/"Thêm" commits, × or Backspace on empty input removes, inline error per `validateTriggerPrefix`, warning when `/` is a prefix). Media backup: Drive and Photos banners (`StorageLinkBanner`, open `ThreadStorageLinksDialog`), media types, `notifyInThread`, `customFolder` / `photosAlbum` / `fileSuffix` (`MediaStorageFields`). Confirmation rules: `allowReactions`, `requiredHearts` (1–50), `timeoutMinutes` (1–60). Chat memory: enabled, `contextWindow`, `searchLimit` (raw text while typing, normalized on blur and on save). Member access (groups only): `MemberAccessSection` + `GroupMemberPicker`, see [Member Access](member-access.md).
  - Form logic (pure, `model/thread-config-form.ts`, tested): `configToForm` (fills optional fields; missing confirmation rules default to 5 hearts for groups, 1 for 1-1), `memoryDraftFrom`, `resolveChatMemory` (empty field → default, clamped), `formToPayload` (sends `threadName`, `threadType` and every section, `memberAccess` normalized). `use-thread-config-form.ts` holds edit state; the form mounts only after the config has loaded (keyed by thread id).
  - No unsaved-changes warning (the modal had none either).
- Web API (`api/zca-api.ts`, `api/zca-query.ts`): status, QR login/logout, threads (+ refresh), listened threads (get/set/toggle), thread configs (list/one/update), Drive folder link, `syncThreadMedia` (`useSyncThreadMediaMutation`), `getThreadStorageLinks` (`useThreadStorageLinksQuery`).

- QR login modal, `SyncMediaModal`, `UserFormDialog`, `ThreadStorageLinksDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard). Phones: ✕ `MODAL_CLOSE_TAP` (QR ✕ has `aria-label` `common.close`), footer buttons `MODAL_FOOTER_TAP`, inputs/selects 40px; `SyncMediaModal` is `phoneLayout="fullscreen"` (long); storage-link row buttons and inputs 40px.
- **Compact `/zca` (<= 960px)**:
  - The topbar title is `nav.zca` (`ROUTE_HEADER_MAP` in `workspace-header.tsx` maps `/zca` and `/zca/thread`); the page h1 is hidden there. The sort/filter chip row carries `min-w-0 max-w-full` and scrolls on its own; without it the nowrap chips widened the whole page (and the fixed tab bar) to ~980px.
  - Row logic is shared: `presentation/components/chat-row-parts.tsx` (`useChatRowModel`: kind label, identity line, features, "⋯" menu items, storage-links dialog state; shared labels/button tones) feeds both `ChatTableRow` (desktop) and `ChatListRow` (`chat-list-row.tsx`). Both call the same `ZcaScreen` handlers.
  - The 7-column table is replaced by a flat list (`useIsCompact`): row min 52px, `border-b`; line 1 = name `(alias)` + trailing listen state (`● Đang nghe` emerald / `○ Bỏ qua`; none for user-only); line 2 = type · short id (`…` + last 6 chars when > 10) · access status (people) or member count (groups).
  - Tap opens a `Modal` sheet: header (avatar, name, identity line incl. linked-contacts link, ✕ 40px), details (type, ID + 40px copy, Listening toggle, Features, Access status + grant/revoke), then every "⋯" menu item as a 40px full-width row (danger items rose), and sticky footer `Cấu hình` link (thread rows). The `ChatRowMenu` popover is never used on compact. Storage-links dialog stacks above the sheet.
  - Page h1 + subtitle hidden (topbar shows the route title); refresh/logout stay (40px at phone). QR login (when logged out) and "+ Thêm người dùng" move to `MobileActionBar`, toolbar copies `max-[960px]:hidden`.
  - Phone (<= 640px): search full width 36px (`PHONE_TOOLBAR_INPUT`, clear ✕ 32×32), sort select + filter tabs in one sideways-scrolling row of 32px chips (`PHONE_CHIP`; sort select is duplicated into that row only on compact), Sync/Drive chips 32px scroll in one row, manual-ID input and submit 40px full width, pagination select and ← / → buttons 32px, notice ✕ 40px.
- **Thread config page on phones**: back links 40px; `ConfigSwitch` label gets a 40×40 tap area around the unchanged track; media-type checkbox labels, `ConfigField` inputs, storage banner buttons, trigger-prefix input/Add and chip × are 40px. The sticky action bar sits above the tab bar on compact (`bottom: 56px + safe-area`), Save 40px.
- Thread config page layout invariant: nothing scrolls horizontally (the workspace section is `overflow-y-auto`, so any too-wide child shows a horizontal scrollbar). Long thread name truncates with `title`; thread ID and Drive/Photos `<code>` labels use `break-all`; the Drive and Photos banners `flex-wrap` so the open button drops to its own line; every `justify-between` row gives its text block `min-w-0` and its toggle/button `shrink-0`, so descriptions wrap instead of squeezing the toggle. Keep this when adding rows.

## Integration Seams & Contracts

- `API_ROUTES`: `zcaStatus`, `zcaQr`, `zcaLoginQr`, `zcaLogout`, `zcaThreads`, `zcaListenedThreads`, `zcaListenedThreadsToggle`, `zcaThreadConfigs`, `zcaThreadConfig(threadId)`, `zcaSyncThreadMedia(threadId)`, `zcaThreadStorageLinks(threadId)`, `zcaThreadStorageLink(threadId, linkId)`, `driveFolderLink`, `driveOpen`, `photosAlbumLink`, `photosOpen`. Web builds the QR image URL with `getZcaQrImageUrl()` (`API_ROUTES.zcaQr` on `resolveApiBaseUrl()`).
- Contracts (`packages/contracts`): `ThreadBotConfig`, `UpdateThreadBotConfigDto`, `ThreadDirectInteractionConfig`, `ThreadMediaBackupConfig`, `ThreadConfirmationConfig`, `TRIGGER_PREFIX_LIMITS`, `TriggerPrefixError`, `validateTriggerPrefix`, `normalizeTriggerPrefixes`, `findTriggerPrefix` (shared by API routing, `cleanBotMention` and the web chip input), `SyncThreadMediaDto`, `SyncMediaTimeRange`, `SyncThreadMediaResponse`, `ChannelStorageLink`, `ChannelStorageLinkKind`, `ChannelStorageLinksResponse`, `UpdateChannelStorageLinkDto`, `validateChannelStorageLinkUpdate`, `CHANNEL_STORAGE_LINK_LIMITS`, `CHANNEL_STORAGE_LINK_HOSTS`.
- Env (`apps/api/src/config/configuration.ts` `zca.*`): `DATA_DIR`, `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN`, `ZCA_CHECK_UPDATE` (default false), `ZCA_LOGGING`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`. Defaults: `global/environment-guard.md`.

## Buttons

- Colours come from `BUTTON_TONE`; cursor, disabled dimming, focus outline and transitions come from the base layer, so buttons here never re-spell them. Primaries are `primary` (slate-900, dark sky-600), replacing the former blue-600/indigo-600/emerald-600/amber-600 ones: QR login (toolbar and mobile action bar), add user, `UserFormDialog` submit, Google storage sign-in, storage-link form submit, thread-config Save, `SyncMediaModal` start and its Drive/Photos result links, and the Drive/Photos open buttons of `storage-link-banner`. Pagination, Retry/Refresh and dialog footers are `secondary`; dialog ✕ and icon buttons `ghost`; Logout (screen and storage panel) and storage-link Delete `dangerSoft`; destructive chat-row menu items `dangerGhost`; the trigger-prefix Add `accent`; `group-member-picker` filters `chip`/`chipSelected`; the default ZCA filter tabs `segment`/`segmentSelected`.
- `chat-row-parts.tsx` exports the cell tones: `NEUTRAL_TONE` (= `secondary`), `POSITIVE_TONE` (= `positiveSoft`, granted access) and `REVOKE_TONE` (secondary resting colours, hover text rose) for the revoke button, shared by `ChatTableRow` and `ChatListRow`.
- Exceptions with their own colours: list rows (`data-press="none"`), the amber "Interaction access" KPI card and the pending/granted/admin filter tabs (amber/emerald/purple encode status), the blue × inside a trigger-prefix chip, and underlined Retry/notice buttons inside alerts (they take the alert colour). See [web-ui-direction](../../global/web-ui-direction.md#button-interaction-states).

## Corner radius

- Buttons, inputs, cards/panels and dialog panels in this module use `rounded-[3px]` (max `rounded`, 4px); no `rounded-lg/xl/2xl`. `rounded-full` only for avatars, status dots, switches, spinners and progress fills. See [web-ui-direction](../../global/web-ui-direction.md).
- ZCA page header on phones (<= 640px): "Updated at …" label + Refresh + Logout stay in ONE non-wrapping row. Label is `min-w-0 flex-1 truncate` 11px; Refresh is icon-only 40×40 (`aria-label` `zca.refreshDirectory`, text kept as `sr-only`); Logout shows the short `common.logout` label, 40px, no wrap. Logged out: only Refresh shows (QR login lives in `MobileActionBar`). Desktop unchanged.

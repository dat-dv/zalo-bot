# ZCA (Zalo Client Account) Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/zca/README.md)

## Purpose

`apps/api/src/zca` and `apps/web/src/modules/zca` manage personal Zalo account integrations via `zca-js` WebSocket client, event orchestration (messages, group events, reactions), channel-level bot configuration, and channel-scoped Google Drive storage bindings.

## Backend Architecture & Services

- **WebSocket Connection & Session Management (`ZcaService`)**:
  - Initializes `zca-js` client, coordinates QR login (`/zlogin`, `/zca-login`).
  - Persists session credentials to Redis (`zca:session:...`) with fallback to persistent disk storage to survive process restarts.
  - Intercepts WebSocket message echos and reaction events to automatically cache `msgId <-> cliMsgId` into memory and Redis (`zca:msg:cli:*`) with 24h TTL.
  - Exposes `undo(payload, threadId)` to recall messages for everyone in the chat, automatically resolving `ThreadType` and retrieving true `cliMsgId` to prevent Zalo `"Lỗi không xác định"` errors.
  - Exposes `deleteMessage(dest, onlyMe)` with `onlyMe: true` fallback support if undo is rejected by server.
- **Message & Reaction Handler (`ZcaBotFeatureService`)**:
  - Listens to incoming messages across group and 1-1 chats.
  - Enforces trigger prefixes (default `@bot`) and respects thread configuration rules (`requireMention`).
  - Processes reaction events: extracts `cMsgID` (`cliMsgId`) from `rMsg` payloads, increments heart counts (❤️) towards threshold confirmations, and triggers cancellation upon angry reactions (😡).
- **Per-Thread Configuration (`ThreadConfigService` & `ThreadConfigEntity`)**:
  - Persists channel settings in the `thread_configs` table:
    - `isListened`: Listening state toggle.
    - `directInteraction`: Bot toggle, `requireMention` (defaults to true for 1-1 chats), trigger prefix.
    - `mediaBackup`: Configurable upload flags (`uploadImages`, `uploadVideos`, `uploadFiles`, `uploadAudios`) and thread notification toggle (`notifyInThread`).
    - `confirmationRules`: Reaction toggle, required hearts threshold, timeout minutes.
    - `driveFolderId`, `driveFolderUrl`, `driveFolderPath`: Channel-specific Google Drive partition (`zalobot/<channelId>`).

## Message Flows (`ZcaBotFeatureService.onMessage`)

Shared gates first: self-message rules (`allowSelf`, `isBotSentMessage`) and `isListened`. Responsibility split: **Users module = WHO may interact; thread config = HOW the bot behaves in a thread.**

| Flow | Trigger | User access check | Behavior |
|---|---|---|---|
| Pending fast-path | `yes/cancel/edit <code>`, pending image replies | `yes`/`cancel`/reactions: collective (any member). `edit`: pending owner, bot account or granted user only; others ignored silently **before** the card is recalled/deleted (`handleCommand(..., canEdit)`) | `edit` re-issues only the tool of `pending.actionType`; non-tool action types (`create`, `delete`, `BAN_USER`…) cannot be edited (reply: cancel and recreate) |
| L3 passive media | image/video/file/voice without mention, `mediaBackup` + type flag on | None — group storage, every member is backed up | Auto upload to Drive/Photos; no OCR, no LLM |
| L1 direct | `@bot`, mention entity, `triggerPrefix`, or `directInteraction.enabled && !requireMention` | `InitialAdminBootstrapGuard` + `GrantAccessGuard` (replies with denial, `registerPendingUser`) + cooldown with reply | Full tool set; free chat per `allowAiChat` |
| L2 passive text | text without mention, `expenseTracking` and/or `calendarExtraction` on | Silent: owner bypass, else `isGrantAccess` must be true; cooldown (2s, in-memory) drops silently. Never replies, never registers pending users | LLM sees only the allowlist; empty allowlist → no LLM call; tools outside allowlist are skipped; never free chat |

- Passive allowlist (`text-tool.definitions.ts`): `expenseTracking` → `PASSIVE_EXPENSE_TOOLS` (`RECORD_TRANSACTION`, `MANAGE_DEBT`); `calendarExtraction` → `PASSIVE_CALENDAR_TOOLS` (`CREATE_CALENDAR_EVENT`, `SET_REMINDER`). Passed as `AgentInput.allowedTools` with `passiveOnly: true`.
- Passive LLM call uses a dedicated system instruction listing only allowlisted tools and no typing indicator (`withChatAction`), so un-mentioned chat leaves no visible trace.
- Known trade-off: L2 shares `UsersService.checkCooldown` with L1, so two expense lines within 2s lose the second one, and a passive message right before `@bot` makes L1 reply "too fast".

## Group vs User Channel Detection

- ZCA group ids are plain numbers (same shape as user UIDs); only legacy Bot API ids carry `g-` / `group_`.
- `ThreadConfigService.isGroupThread(id)`: stored `threadType` from memory → Redis → DB (never creates a config); fallback `hasLegacyGroupPrefix(id)` only when nothing is stored.
- Drive folder persistence (`GET_STORAGE_LINKS`, `SHARE_DRIVE`, `google-resources.controller` share/folder-link): group → `ThreadConfigService.saveDriveFolderInfo` only; user → `UsersService.saveDriveFolderInfo` only.
- `createDefaultThreadConfig`, `saveDriveFolderInfo`/`savePhotosAlbumInfo` (new entity) and `ZcaService.resolveThreadType` use the same rule.

## Web UI (`ZcaScreen` & `ThreadConfigModal`)

- **Screen (`apps/web/src/modules/zca/view/zca-screen.tsx`)**:
  - Connection status card: Online/Offline indicator, connected profile (name, avatar, UID), session age, and QR modal trigger.
  - QR Login Modal: Displays dynamic base64 QR code with polling to automatically detect successful authentication.
  - Threads Table:
    - Avatar, thread name, type badge (group/user), thread ID with 1-click copy.
    - Listening switch (`toggleZcaListenedThread`).
    - Interaction badges (`@bot` required vs Direct) and media backup icons.
    - Direct Google Drive folder open button.
    - Settings button triggering `ThreadConfigModal`.
- **Config Modal (`ThreadConfigModal`)**:
  - Controls direct interaction rules, media backup toggles (images, videos, files, audios), confirmation rules, and displays channel Google Drive links.

## Integration Seams & Contracts

- Endpoints in `API_ROUTES`: `zcaStatus`, `zcaLoginQr`, `zcaThreads`, `zcaListenedThreads`, `zcaListenedThreadsToggle`, `zcaThreadConfigs`, `zcaThreadConfig(threadId)`.
- Contracts in `packages/contracts`: `ThreadBotConfig`, `UpdateThreadBotConfigDto`, `ThreadMediaBackupConfig`, `ThreadDirectInteractionConfig`, `ThreadConfirmationConfig`.

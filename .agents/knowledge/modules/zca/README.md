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

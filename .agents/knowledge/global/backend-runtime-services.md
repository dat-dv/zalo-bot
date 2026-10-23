---
metadata:
  agent-artifact:
    id: global-backend-runtime-services-knowledge
    type: documentation
    depends_on:
      - apps/api/src/main.ts
      - apps/api/src/health/health.controller.ts
      - apps/api/src/dashboard-auth/dashboard-user.ts
      - apps/api/src/redis/redis.service.ts
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/google/channel-storage.util.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/reminders/reminder-scheduler.service.ts
      - apps/api/src/reminders/reminder.processor.ts
      - apps/api/src/reminders/reminders.service.ts
      - apps/api/src/tasks/task-reminder.processor.ts
      - apps/api/src/queue/queue.module.ts
      - apps/api/src/queue/queue.constants.ts
      - apps/api/src/queue/reminder-job.ts
      - apps/api/src/queue/reminder-queue.ts
      - apps/api/src/audit/audit.service.ts
      - apps/api/src/audit/audit-context.ts
      - apps/api/src/common/middleware/audit-context.middleware.ts
      - apps/api/src/database/audit-log.subscriber.ts
---

# Backend Runtime Services

Owner: Core Engineering Team · Status: active

Human guide: [Backend Runtime Services](../../docs/global/backend-runtime-services.md).

Cross-cutting NestJS services in `apps/api/src` that are not feature CRUD.

## Health (`health/`)

- `GET /health` -> `{ status: 'ok', timestamp }` (load balancer / Coolify / Docker probe), public, excluded from the `/api` global prefix (`main.ts`), `@BypassTransform()`.
- There is no deploy notification: the deploy webhooks (`/health/deploy`, `/deploy/notify`, `/deploy/ping`, `DEPLOY_NOTIFY_TOKEN`) and the startup message to admins (`NOTIFY_ON_STARTUP`) were removed.

## Redis (`redis/`)

- `RedisModule` is `@Global`. `RedisService` (ioredis) connects to `redis.url` / `REDIS_URL` / `redis://localhost:6379`, `lazyConnect`, `maxRetriesPerRequest: 2`, retry up to 3 times.
- Fail-soft: when disconnected every op returns `null` / `false` / `[]` and logs a warning; callers keep in-memory fallbacks (e.g. pending confirmations).
- API: `get`, `set(key, value, ttlSeconds?)`, `del`, set ops (`sadd`, `srem`, `smembers`, `sismember`), list ops (`rpush`, `ltrim`, `lrange`), `expire`, `onReady(cb)`, `isReady`.
- Whitelist cache: `whitelist:user:<id>` = `1` (TTL 24 h) / `0` (TTL 10 min).
- Other key families documented elsewhere: `pending:tx:*` ([Zalo Response Layout](zalo-response-layout.md)), `zca:msg:cli:*`.

## OCR (`ocr/`)

- `OcrService.recognize(buffer) → { text, confidence }`: `sharp` pre-process (auto-rotate, grayscale, normalize; raw buffer on failure) then `tesseract.js` worker with languages `vie` + `eng`; worker terminated after each call. `confidence` is Tesseract's mean word confidence (0–100). Errors return `{ text: '', confidence: 0 }`. `extractTextFromBuffer(buffer)` returns only the text. Local only; images are never sent to an LLM.
- Background use: `ImageTextMemoryService` (`zca/memory/`) reads chat photos for chat memory through an in-process queue, one photo at a time, ≤ 20 waiting, lost on restart (see `modules/zca/chat-memory.md`). Not a BullMQ queue.

## Media storage (`receipt-storage/`)

- `MediaStorageService` uploads Zalo media to Google using `GoogleDriveService` and `GooglePhotosService` (each optional).
- Drive path: `zalobot/<channelId>/<category>` via `getChannelDriveFolderPath` (`channelId` sanitized to `[a-zA-Z0-9_-]`; empty -> `default_channel`); categories `bill`, `image`, `video`, `file`, `audio`. Uploads go into a `YYYY-MM` subfolder. `options.folderPath` overrides the computed path.
- `uploadBill` / `uploadImage` / `uploadVideo(senderId, buffer, target)`: Drive and Photos in parallel (`Promise.allSettled`) into the channel's storage target. Photos goes to the channel's one album in the shared account, found in `channel_storage_links` and created only when none is recorded (no default/global albums; see `modules/zca/channel-storage.md`). `uploadFile`: Drive only (`file`). Result `DualUploadResult { drive?, photos?, driveError?, photosError? }`; one side failing does not fail the other.
- `formatUploadSummary` builds the Zalo reply; permission errors hint the admin to run `/login`.
- Google client: the user's own OAuth client if linked, otherwise the shared (admin) client (`GoogleAuthService.getOAuth2Client`).
- Callers: `ZcaBotFeatureService` (media backup, bill images), pending-image strategies.

## Google resource links (`google/google-resources.controller.ts`, `/api` prefix)

| Route | Behavior |
| --- | --- |
| `POST /api/drive/share` | Body `ShareDriveDto { channelId, email, role? }` (role `reader`/`commenter`/`writer`, default `reader`). Shares `zalobot/<channelId>`; persists folder info to `ThreadConfigService` (group) or `UsersService` (user). |
| `GET /api/drive/folder-link?channelId&threadName` | Returns `{ data: { folderPath, webViewLink } }`. Priority: cached `driveFolderUrl`, then `driveFolderPath` / `mediaBackup.customFolder` / `zalobot/<threadName>` / `zalobot/<channelId>`; caches the resolved link. Fallback `https://drive.google.com`. |
| `GET /api/drive/open` | 302 redirect to the folder-link result. |
| `GET /api/photos/album-link?channelId&threadName` | `{ data: { albumTitle, webViewLink } }`. Title per channel `mediaBackup.photosAlbum` / `photosAlbumTitle` / `[Zalo] <threadName>` / `[Zalo] Nhóm <channelId>`; link = the channel's album of the current shared account from `channel_storage_links`. No channel, no recorded album or a lookup error → `https://photos.google.com` (no system-wide album). |
| `GET /api/photos/open` | 302 redirect to the album-link result. |

All five routes are **admin-only** (dashboard user must pass `UsersService.isAdmin`; 401 without a valid token, 403 for non-admins or when `UsersService` is absent). Rationale: there is no per-channel membership check, and `folder-link`/`open` call `ensureFolderPath`, so an open route would let anyone share or create another chat's Drive partition. `drive/share`, `drive/folder-link`, `photos/album-link` need the Bearer access token. `drive/open` and `photos/open` are opened as `<a href target=_blank>` and cannot send a header, so they also accept the dashboard refresh cookie `reports_refresh` (`getDashboardUserIdFromBrowser`). The only callers are the ZCA admin page; the chat command `@bot share` calls the Drive service directly, not HTTP.

## Background jobs (BullMQ, `queue/`)

All scheduled work runs on BullMQ (`bullmq` 5 + `@nestjs/bullmq` 10); `@nestjs/schedule` / `@Cron` is not used anywhere.

- `QueueModule` (`queue/queue.module.ts`, imported by `AppModule`): `BullModule.forRootAsync`, connection `{ url: redis.url || REDIS_URL || redis://localhost:6379, maxRetriesPerRequest: null }`, key prefix `zalobot`. Workers and queues open their own ioredis connections (not `RedisService`).
- **Redis is required for reminders.** `RedisService` tolerates a missing Redis, BullMQ does not: without Redis no scan runs. Reminder times stay in Postgres, so they go out (late) once Redis is back. Bootstrap never waits for Redis (scheduler upsert is fire-and-forget); queue/worker connection errors are logged at most once a minute (`throttledErrorLogger`).
- Queues: `task-reminders` (`tasks/`, see modules/tasks) and `reminders` (`reminders/`, see modules/reminders). Each has a `@Processor(<queue>, { concurrency: 1 })` (`TaskReminderProcessor`, `ReminderProcessor`) and two jobs (`REMINDER_JOBS`):
  - `scan`: repeating Job Scheduler `upsertJobScheduler('scan', { every: 30_000 })`, registered in `onApplicationBootstrap`; idempotent, one schedule across restarts and instances.
  - `deliver` `{ timeId, remindAt, nag? }`: queued by a scan for each claimed send (a time, or one of its reminders again; see reminders module "Repeat & remind again"); jobId ends with `-<ms>` and `-nag-<k>` so each send is one job. `REMINDER_DELIVERY_JOB_OPTIONS`: `attempts: 5`, exponential backoff from 30 s (~30 s, 1 m, 2 m, 4 m), `removeOnComplete`, failed jobs kept 7 days.
- `processReminderJob` (`queue/reminder-job.ts`) routes by job name: delivery result `failed` throws -> BullMQ retries; `sent` / `skipped` / `released` complete the job. A final failure (no attempt left) is logged as an error; that time stays marked sent (lost).
- Postgres stays the source of truth: scans re-read due rows each run, so no reminder state lives only in Redis and no migration is needed when switching.
- Delivery is at-least-once: a send Zalo accepted but reported failed is sent again on retry.
- Shutdown: `@nestjs/bullmq` closes workers and queues on `onApplicationShutdown` (`enableShutdownHooks()` in `main.ts`).

## Audit (`audit/`, `database/audit-log.subscriber.ts`)

- `AuditLogSubscriber` (TypeORM, registered in `DatabaseModule` and `data-source.ts`) writes an `audit_logs` row after every entity insert / update / remove, except on `audit_logs` and `zca_messages`.
- Row: `tableName`, `recordId` (primary key values joined by `:`), `action` (`insert`|`update`|`remove`), `actorId`, `actorSource` (`dashboard`|`zalo`|`system`), `channelId`, `beforeData`, `afterData`. Keys matching `/token|secret|password|authorization/i` are stored as `[REDACTED]`.
- **Actor = who caused the write**, read from `AuditContext` (AsyncLocalStorage, `audit/audit-context.ts`), never from the row's `userId`/`createdByUserId`. Dashboard: `AuditContextMiddleware` opens a context per request, `getDashboardUserId` sets the verified user. Zalo: `ZcaService.dispatchMessage`/`dispatchReaction` run plugins as the sender + chat; a confirmed pending action runs as its requester (`TransactionConfirmationService.executeConfirmed`). BullMQ reminder processors and the Google Calendar import run via `AuditContext.runAsSystem`. No context → `actorSource = 'system'`, `actorId = NULL`.
- Rows before migration `1724950000000-AddAuditLogActorSource` have `actorSource = NULL` (legacy): their `actorId` is the row creator, not necessarily who changed it. Not backfilled.
- `save`/`remove` give full data. Query-builder / repository `update()` reach the subscriber with only the written values (no `recordId` unless the id is among them, no before copy); `delete()` by criteria gives an empty row. Writes with `callListeners(false)` (calendar import) are not audited.
- Zalo writes also keep the sender's display name in `actor_name` (migration `1724970000000-AddAuditLogActorName`), because many group members are not in the ZCA directory.
- `AuditService.listRecent(userId, limit = 20)` reads by `actorId`, excluding `AUDIT_TECHNICAL_TABLES` (sign-in tokens, reminder bookkeeping); `GET /api/dashboard` shows the latest 10 as activity. The admin activity log (`GET /api/audit-logs`) is in [modules/audit](../modules/audit/README.md).

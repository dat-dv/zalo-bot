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
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/google/channel-storage.util.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/reminders/reminder-scheduler.service.ts
      - apps/api/src/reminders/reminders.service.ts
      - apps/api/src/audit/audit.service.ts
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

- `OcrService.extractTextFromBuffer(buffer)`: `sharp` pre-process (auto-rotate, grayscale, normalize; raw buffer on failure) then `tesseract.js` worker with languages `vie` + `eng`; worker terminated after each call. Errors return `''`. Local only; images are never sent to an LLM.

## Media storage (`receipt-storage/`)

- `MediaStorageService` uploads Zalo media to Google using `GoogleDriveService` and `GooglePhotosService` (each optional).
- Drive path: `zalobot/<channelId>/<category>` via `getChannelDriveFolderPath` (`channelId` sanitized to `[a-zA-Z0-9_-]`; empty -> `default_channel`); categories `bill`, `image`, `video`, `file`, `audio`. Uploads go into a `YYYY-MM` subfolder. `options.folderPath` overrides the computed path.
- `uploadBill` / `uploadImage` / `uploadVideo`: Drive and Photos in parallel (`Promise.allSettled`); default albums `ZaloBot - Hóa đơn`, `ZaloBot - Hình ảnh`, `ZaloBot - Video`, overridable by `photosAlbumTitle` / `photosAlbumId`. `uploadFile`: Drive only (`file`). Result `DualUploadResult { drive?, photos?, driveError?, photosError? }`; one side failing does not fail the other.
- `formatUploadSummary` builds the Zalo reply; permission errors hint the admin to run `/login`.
- Google client: the user's own OAuth client if linked, otherwise the shared (admin) client (`GoogleAuthService.getOAuth2Client`).
- Callers: `ZcaBotFeatureService` (media backup, bill images), pending-image strategies.

## Google resource links (`google/google-resources.controller.ts`, `/api` prefix)

| Route | Behavior |
| --- | --- |
| `POST /api/drive/share` | Body `ShareDriveDto { channelId, email, role? }` (role `reader`/`commenter`/`writer`, default `reader`). Shares `zalobot/<channelId>`; persists folder info to `ThreadConfigService` (group) or `UsersService` (user). |
| `GET /api/drive/folder-link?channelId&threadName` | Returns `{ data: { folderPath, webViewLink } }`. Priority: cached `driveFolderUrl`, then `driveFolderPath` / `mediaBackup.customFolder` / `zalobot/<threadName>` / `zalobot/<channelId>`; caches the resolved link. Fallback `https://drive.google.com`. |
| `GET /api/drive/open` | 302 redirect to the folder-link result. |
| `GET /api/photos/album-link?channelId&threadName` | `{ data: { albumTitle, webViewLink } }`. Default album `ZaloBot - Hình ảnh`; per channel `photosAlbumTitle` / `mediaBackup.photosAlbum` / `[Zalo] <threadName>` / `[Zalo] Nhóm <channelId>`; caches `photosAlbumUrl`. Fallback `https://photos.google.com`. |
| `GET /api/photos/open` | 302 redirect to the album-link result. |

All five routes are **admin-only** (dashboard user must pass `UsersService.isAdmin`; 401 without a valid token, 403 for non-admins or when `UsersService` is absent). Rationale: there is no per-channel membership check, and `folder-link`/`open` call `ensureFolderPath`, so an open route would let anyone share or create another chat's Drive partition. `drive/share`, `drive/folder-link`, `photos/album-link` need the Bearer access token. `drive/open` and `photos/open` are opened as `<a href target=_blank>` and cannot send a header, so they also accept the dashboard refresh cookie `reports_refresh` (`getDashboardUserIdFromBrowser`). The only callers are the ZCA admin page; the chat command `@bot share` calls the Drive service directly, not HTTP.

## Reminder scheduler (`reminders/reminder-scheduler.service.ts`)

- `@Cron(CronExpression.EVERY_30_SECONDS)` (`ScheduleModule.forRoot()` in `AppModule`).
- `RemindersService.getDueReminders`: `remindAt <= now` and `isTriggered = false` (all users).
- For each: format time in the user's preferred locale (Asia/Ho_Chi_Minh), send `reminder.header.text` + title + time to `reminder.userId` via `ZcaMessengerService.sendMessage`, then `markTriggered`: `daily` -> +24 h, `weekly` -> +7 d (stay `pending`); else `isTriggered = true`, `status = completed`, `completedAt = now`.
- Errors are logged; the loop is not retried within the tick.

## Audit (`audit/`, `database/audit-log.subscriber.ts`)

- `AuditLogSubscriber` (TypeORM, registered in `DatabaseModule` and `data-source.ts`) writes an `audit_logs` row after every entity insert / update / remove, except on `audit_logs` itself.
- Row: `tableName`, `recordId` (primary key values joined by `:`), `action` (`insert`|`update`|`remove`), `actorId` (= entity `userId` when it is a string), `beforeData`, `afterData`. Keys matching `/token|secret|password|authorization/i` are stored as `[REDACTED]`.
- Only repository `save`/`remove` trigger it; query-builder / `delete()` bulk writes are not audited.
- `AuditService.listRecent(userId, limit = 20)` reads by `actorId`; `GET /api/dashboard` shows the latest 10 as activity.

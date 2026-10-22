---
metadata:
  agent-artifact:
    id: zca-channel-storage-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/storage/channel-storage-link.service.ts
      - apps/api/src/zca/storage/channel-storage-links.mapper.ts
      - apps/api/src/zca/storage/channel-storage-link.module.ts
      - apps/api/src/database/entities/channel-storage-link.entity.ts
      - apps/api/src/database/entities/user-token.entity.ts
      - apps/api/src/database/migrations/1724830000000-CreateChannelStorageLinks.ts
      - apps/api/src/database/migrations/1724840000000-AddDisplayNameToChannelStorageLinks.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/google/channel-storage.util.ts
      - apps/api/src/google/google-auth.service.ts
      - apps/api/src/google/google-drive.service.ts
      - apps/api/src/google/google-photos.service.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zca/zca.controller.ts
      - apps/api/src/finance/receipt-source.ts
      - packages/contracts/src/index.ts
      - apps/web/src/modules/zca/presentation/components/thread-storage-links-dialog.tsx
      - apps/web/src/modules/zca/presentation/components/chat-table-row.tsx
      - apps/web/src/modules/zca/view/thread-config-modal.tsx
---

# ZCA Channel Storage (Drive/Photos history)

Owner: Core Engineering Team · Status: active

Human guide: [Lưu trữ media theo kênh](../../../docs/modules/zca/channel-storage.md). Design record: `.agents/artifacts/channel-storage-link-history/`.

## Purpose

- Channel media (images, videos, files, bills) is stored on Google Drive + Google Photos. When the shared Google account changes, older media stays in the old account; the dashboard must still list where it lives.
- Every channel upload must land in the channel's own Drive root and Photos album (it used to fall back to global albums/folders and to flip Google accounts).

## Shared storage account

- All channel media is uploaded with the **shared Google account** (`GoogleAuthService.getSharedOAuth2Client()`), never a member's own token. Calendar/Tasks still use per-user tokens.
- The shared account is pinned by `user_tokens.is_shared` (one row). Only an explicit login (`exchangeCodeForTokens` → `saveTokensForUser(id, tokens, { shared: true })`) sets it and unmarks the others. Token refreshes (`client.on('tokens')`) never move it.
  - Why: before, every saved token (incl. hourly refreshes of any admin, e.g. one person with a webhook id and a ZCA uid) re-pointed the shared account, so media went to different Google accounts and album ids were overwritten across accounts.
  - Fallback: no pinned token → first token with credentials.
- A login always builds a **new OAuth client**. Caches are keyed by client object (`WeakMap`): account email (`getAccountEmail(userId?)`), Drive folder ids (`GoogleDriveService`), Photos album ids/urls (`GooglePhotosService`). So switching accounts never reuses ids of the old account.
- Migration `1724830000000-CreateChannelStorageLinks` marks the most recently updated token as shared.

## Storage target (`ChannelStorageTarget`, `google/channel-storage.util.ts`)

- Built by `buildChannelStorageTarget(channelId, { customFolder, photosAlbum, photosAlbumTitle, threadName, fileSuffix })`; for ZCA threads `getThreadStorageTarget(config)` / `ThreadConfigService.getStorageTarget(threadId)` (default target when no stored config). Official-bot chats use the default target.
- `driveRoot`: `customFolder` (normalized) else `zalobot/<sanitized channelId>`. `splitByCategory`: true for the default root.
- Upload folder (`getChannelUploadFolder`): `<root>/<bill|image|video|file>` or the custom folder itself; the Drive service appends `/<YYYY-MM>`. Audio uses `file`.
- `photosAlbumTitle`: `photosAlbum` override → stored `photosAlbumTitle` → `[Zalo] <threadName>` → `[Zalo] Nhóm <channelId>`. **One album per channel per account**: bills, images and videos all go to it. The global defaults (`ZaloBot - Hóa đơn/Hình ảnh/Video`) remain only in `GooglePhotosService` wrappers when no title is passed.
- `MediaStorageService.uploadBill|uploadImage|uploadVideo|uploadFile(senderId, buffer, target, options?)` require a target (type-enforced), so no upload path can skip the channel storage. `senderId` only names files.

## Album lookup

- `GooglePhotosService.findAppAlbum` scans every `albums.list` page (`pageSize=50`, `nextPageToken`, max 50 pages). Before, only page 1 was read, so albums beyond 50 were invisible and duplicates with the same title were created.
- `getOrCreateAlbumInfo(title)` → `{ id, url }` (find or create); `findAlbumInfo(title)` → existing only; `getAlbumLink` uses it.
- Uploads first reuse the album recorded in history for the current account (`ChannelStorageLinkService.findAlbum(threadId, email, title)`); the legacy `zca_thread_configs.photos_album_id` is no longer passed to uploads.

## Storage history (`channel_storage_links`)

| Column | Meaning |
| --- | --- |
| `thread_id`, `kind` (`drive` \| `photos`) | Channel and storage kind |
| `google_email` | Account the resource belongs to; NULL for backfilled rows |
| `resource_id` | Drive root folder id / album id (URL for legacy rows without id) |
| `url`, `label` | Link and Drive path / album title (rewritten by every upload) |
| `display_name` | Admin-chosen name shown instead of `label`; uploads never touch it (migration `1724840000000`) |
| `first_used_at`, `last_used_at` | Usage range |

- Unique `(thread_id, kind, resource_id)`. `record()` upserts: updates `url`, `label`, `last_used_at = GREATEST(...)`, adopts `google_email` only when NULL.
- Written after each successful upload (`MediaStorageService`: Drive root id via `ensureFolderPath(driveRoot)`, album id + url) and by `syncCurrentStorage(target)`. Recording is best effort: failures are logged, the upload result is kept.
- Backfill: one Drive row and one Photos row per thread config that had a cached URL.
- Legacy `driveFolder*` / `photosAlbum*` columns on `zca_thread_configs` stay (still written by existing flows) but are not the source of the dashboard list.

## API

- `GET /api/zca/threads/:threadId/storage-links` (`API_ROUTES.zcaThreadStorageLinks`, admin-only) → `ChannelStorageLinksResponse { threadId, drive: ChannelStorageLink[], photos: ChannelStorageLink[] }`.
  - First `syncCurrentStorage(target)`: when the shared account is connected with storage scopes, ensures the Drive root (may create folders) and finds (never creates) the album, records both, marks them `isCurrent`.
  - `toChannelStorageLinksResponse` (pure, `storage/channel-storage-links.mapper.ts`): merges rows with the same URL (backfilled + real id), current first, then `lastUsedAt` desc. Each link carries `id` (representative row) and `displayName`.
- `PATCH /api/zca/threads/:threadId/storage-links/:linkId` (`API_ROUTES.zcaThreadStorageLink`, body `UpdateChannelStorageLinkDto { displayName?, url?, googleEmail? }`) and `DELETE` on the same path; admin-only; both return the fresh `ChannelStorageLinksResponse`.
  - Scope: every row of the thread with the same `kind + url` as `linkId` (`ChannelStorageLinkService.findLinkGroup`, = one dialog item). Unknown id / other thread → 404.
  - Validation `validateChannelStorageLinkUpdate(kind, dto)` (contracts, shared with the web form): trim; empty name/email → `null`; email lower-cased; name ≤ `CHANNEL_STORAGE_LINK_LIMITS.DISPLAY_NAME_MAX_LENGTH` (120); URL https on `CHANNEL_STORAGE_LINK_HOSTS[kind]` (Drive `drive.google.com`; Photos `photos.google.com`, `photos.app.goo.gl`). Errors → 400.
  - Link in use (`isCurrentStorageRow`, same rule as the `isCurrent` badge, from `syncCurrentStorage`): DELETE → 400 (it is recorded again on the next upload/open); URL change → 400 (uploads rewrite it). Name and email stay editable.
  - Writes go through `repository.save` / `remove` (not raw SQL), so `AuditLogSubscriber` logs before/after. DELETE removes history rows only; the Drive folder / Photos album on Google is untouched.

## Receipt proxy

- `GET /api/transactions/:id/receipt` Drive receipts: `downloadDriveReceipt` (`finance/receipt-source.ts`) tries shared token → creator token → public link `drive.google.com/uc?export=download&id=` (`GoogleDriveService.downloadPublicFile`, files are uploaded "anyone with the link: reader"). `drive.file` only reads files created by the same account, so old receipts stay viewable after an account change. Fails if the old account was deleted or the Workspace blocks public sharing.

## Web UI

- `/zca` table, row "⋯" menu items open Drive / open Photos open `ThreadStorageLinksDialog` (shared `Modal`, bottom sheet on mobile). `ThreadConfigModal` "Mở Google Drive / Photos" buttons open the same dialog.
- The dialog is rendered with `createPortal(…, document.body)`: it is opened from a table cell (`whitespace-nowrap text-right`), and a top-layer `<dialog>` still inherits those styles, which kept the description on one line and broke the layout. Any dialog opened from a table row must portal out of the cell.
- Dialog: query `useThreadStorageLinksQuery(threadId, enabled)` (key `zcaQueryKeys.storageLinks`, `staleTime: 0`, fetched on open). Rows: title = `displayName` or label (link, new tab; label shown below when renamed), account email or "previous account", used range, `In use` badge on the current row, buttons Edit (inline form: display name, URL — disabled on the row in use, email; client-side validation with the shared validator, field errors, Save/Cancel) and Delete (`window.confirm`; disabled with a tooltip on the row in use). Mutations `useUpdateThreadStorageLinkMutation` / `useDeleteThreadStorageLinkMutation` replace the query cache with the returned list. A Drive link opens the channel root showing `bill`, `image`, `video` (+ `file`). States: skeleton, error + retry, empty, list. Strings `zca.storageLinks.*` (vi/en).

# ZCA Channel History Media Backup to Google Drive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users from the Web Dashboard (and optionally via ZCA API) to trigger a historical scan of a channel/group's chat history, extract media resources (photos, videos, files), and upload them directly to the channel's Google Drive partition (`zalobot/<channelId>/<category>`) with guaranteed zero duplication based on Zalo message IDs (`msgId`).

**Architecture:**
- **Deduplication Engine:** Use Redis Sets (`zca:synced_media:${threadId}`) and embed `msgId` in file names (`image_${ts}_${senderId}_${msgId}${suffix}.${ext}`) and Google Drive metadata. When messages are backed up in real-time or via history scan, check `isMediaSynced(threadId, msgId)` before downloading/uploading. If already present, skip immediately with 0 network overhead. Mark `markMediaSynced(threadId, msgId)` upon successful upload.
- **Backend History Sync Service:** Add `ZcaService.getGroupChatHistory(groupId, count)` wrapping `api.getGroupChatHistory` from `zca-js`. In `ZcaBotFeatureService`, add `syncThreadMediaHistory(threadId, options)` which iterates through messages, filters by media types (`chat.photo`, `chat.video.msg`, `sharefile`, `chat.voice`), skips duplicates, fetches buffer with safe delay, and uploads via `MediaStorageService`.
- **REST Controller & Contracts:**
  - Route: `POST /api/zca/threads/:threadId/sync-media`
  - DTO: `SyncThreadMediaDto { limit?: number; mediaTypes?: ('image' | 'video' | 'file' | 'audio')[] }`
  - Response: `SyncThreadMediaResponse { threadId, scannedCount, foundCount, syncedCount, skippedCount, failedCount, message }`
- **Frontend Dashboard Integration:**
  - In `ThreadConfigModal` (`apps/web/src/modules/zca/view/thread-config-modal.tsx`), add a dedicated "Sao lưu media cũ từ lịch sử trò chuyện" (Historical Media Backup) panel with message count selector (50, 100, 200), media type checkboxes, loading state with spinner, and informative completion summary showing new vs skipped (deduped) counts.
  - In `apps/web/src/modules/zca/api/`, add `syncThreadMediaApi` and `useSyncThreadMediaMutation` React Query hook.

**Tech Stack:** NestJS, TypeScript, `zca-js`, Google Drive API v3 (`googleapis`), Redis (`ioredis`), Next.js 14, React Query (`@tanstack/react-query`), Tailwind CSS, Node.js test runner (`node:test`).

**Spec:** User requested a frontend button to trigger backing up resources (images, videos, etc.) by scanning the channel's history and uploading them to Drive without duplicate files.

---

## Global Constraints

- Never duplicate media files on Google Drive: verify `msgId` against Redis set `zca:synced_media:${threadId}` before downloading or uploading.
- Support both real-time listener deduplication and historical scan deduplication.
- Pure immutable channel Drive path: `zalobot/<channelId>/<category>` (`image`, `video`, `file`, `audio`).
- Group vs Direct chat: Historical scanning relies on `getGroupChatHistory` for groups (`threadType === 'group'`). Gracefully inform user if attempted on non-group threads.
- Safe rate limiting: Introduce a 300ms pause between successive media downloads from Zalo CDN to avoid rate limiting or checkpoints.
- All existing tests and new unit tests must pass (`npm test`).

## Review Focus

1. **Deduplication accuracy:** Calling sync twice on the same group must report `skippedCount` for all previously uploaded media and 0 new uploads on the second run.
2. **Real-time & Historical coexistence:** If an image was already uploaded by the real-time message listener, the history scan must recognize its `msgId` and skip it.
3. **Zalo CDN error tolerance:** If an old photo's URL has expired or fails to download, the scan must not crash the entire batch; it must log the failure, increment `failedCount`, and continue processing remaining items.
4. **Group eligibility check:** Non-group chats must receive an explanatory message rather than throwing an unhandled exception.
5. **Frontend UX:** The scan button must display active loading state while the request is in progress and render a clear badge/banner of results (synced, skipped, failed).

---

### Task 1: Contracts & DTOs for Media Sync

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json` (if build needed)

**Interfaces:**
- Add `API_ROUTES.zcaSyncThreadMedia: (threadId: string) => '/api/zca/threads/' + threadId + '/sync-media'`
- Add types:
  ```ts
  export interface SyncThreadMediaDto {
    limit?: number;
    mediaTypes?: ('image' | 'video' | 'file' | 'audio')[];
  }

  export interface SyncThreadMediaResponse {
    threadId: string;
    scannedCount: number;
    foundCount: number;
    syncedCount: number;
    skippedCount: number;
    failedCount: number;
    message: string;
  }
  ```

**Steps:**
- [ ] Add route and DTO interfaces to `packages/contracts/src/index.ts`.
- [ ] Build contracts package (`npm run build --workspace=@zalobot/contracts`).
- [ ] Run test suite to verify no regressions.

---

### Task 2: Deduplication Helper & Google Drive File Naming

**Files:**
- Modify: `apps/api/src/google/google-drive.service.ts`
- Modify: `apps/api/src/receipt-storage/media-storage.service.ts`
- Modify: `apps/api/src/receipt-storage/media-storage.service.spec.ts`

**Implementation Details:**
- Update `UploadFileOptions` and `uploadImage` / `uploadVideo` / `uploadFile` in `GoogleDriveService` to accept optional `msgId?: string`.
- When `msgId` is provided, incorporate it into the filename: `image_${ts}_${senderId}_${msgId}${suffix}.${ext}` and add `(Zalo MsgId: ${msgId})` into the file description.
- Pass `msgId` through `MediaStorageService` options to `GoogleDriveService`.

**Steps:**
- [ ] Add `msgId?: string` to `MediaStorageService` and `GoogleDriveService` upload options.
- [ ] Ensure filename formatting embeds `msgId` cleanly.
- [ ] Add unit test verifying that `msgId` is included in upload options and filename.

---

### Task 3: Backend History Sync & Real-Time Deduplication in ZCA Services

**Files:**
- Modify: `apps/api/src/zca/zca.service.ts`
- Modify: `apps/api/src/zca/zca-bot-feature.service.ts`
- Modify: `apps/api/src/zca/zca.controller.ts`
- Modify: `apps/api/src/zca/zca-bot-feature.service.spec.ts`
- Modify: `apps/api/src/zca/zca.controller.spec.ts`

**Implementation Details:**
- In `ZcaService`: Add `getGroupChatHistory(groupId: string, count?: number)`.
- In `ZcaBotFeatureService`:
  - Inject `RedisService` to manage `isMediaSynced(threadId, msgId)` and `markMediaSynced(threadId, msgId)`.
  - In `onMessage`: Check `isMediaSynced` before uploading real-time media; call `markMediaSynced` after successful upload.
  - Implement `syncThreadMediaHistory(threadId: string, options?: SyncThreadMediaDto): Promise<SyncThreadMediaResponse>`.
  - Check thread existence and group type.
  - Call `getGroupChatHistory` with requested count (default 50, capped at 200).
  - Loop through `groupMsgs`, filter by requested media types, skip already synced messages via `isMediaSynced`.
  - Fetch buffer with `fetchImageBuffer`, upload via `mediaStorageService`, mark synced, pause 300ms between uploads.
- In `ZcaController`:
  - Add `POST /api/zca/threads/:threadId/sync-media` handler.

**Steps:**
- [ ] Add `getGroupChatHistory` to `ZcaService`.
- [ ] Add deduplication methods (`isMediaSynced`, `markMediaSynced`) and `syncThreadMediaHistory` to `ZcaBotFeatureService`.
- [ ] Update `onMessage` to deduplicate real-time incoming media.
- [ ] Add `POST /threads/:threadId/sync-media` endpoint in `ZcaController`.
- [ ] Write unit tests for `syncThreadMediaHistory` verifying duplicate skipping, error recovery, and proper counters.
- [ ] Run `npm test` to verify backend tests pass.

---

### Task 4: Frontend API Layer & React Query Mutation

**Files:**
- Modify: `apps/web/src/modules/zca/api/zca-api.ts`
- Modify: `apps/web/src/modules/zca/api/zca-query.ts`

**Implementation Details:**
- In `zca-api.ts`:
  - Add `syncThreadMediaApi(threadId: string, data?: SyncThreadMediaDto): Promise<SyncThreadMediaResponse>`.
- In `zca-query.ts`:
  - Add `useSyncThreadMediaMutation()` using `useMutation`.

**Steps:**
- [ ] Implement `syncThreadMediaApi` calling `POST /api/zca/threads/${threadId}/sync-media`.
- [ ] Implement `useSyncThreadMediaMutation` hook in `zca-query.ts`.
- [ ] Write unit test for `syncThreadMediaApi`.

---

### Task 5: Frontend UI in Thread Config Modal

**Files:**
- Modify: `apps/web/src/modules/zca/view/thread-config-modal.tsx`
- Modify: `apps/web/src/modules/zca/view/thread-config-modal.spec.tsx` (or spec)

**Implementation Details:**
- In `ThreadConfigModal`:
  - Add a dedicated section under "Lưu trữ đa phương tiện" (Media Backup): **"Sao lưu lịch sử tin nhắn (Scan & Backup History)"**.
  - Provide controls:
    - Message limit select: `50`, `100`, `200` tin nhắn gần nhất.
    - Media type checkboxes: Ảnh (`chat.photo`), Video (`chat.video.msg`), Tệp tin (`sharefile`).
    - Action button: **"Quét & Sao lưu media cũ"**.
  - Show loading state while mutation is pending (`isPending` with disabled button and animated spinner).
  - Display result banner on success:
    - Total messages scanned.
    - Media found.
    - Newly uploaded files.
    - Skipped duplicates (e.g. "Bỏ qua X tệp đã tồn tại").
    - Failed files if any.
  - Link directly to the Google Drive folder if available.

**Steps:**
- [ ] Add History Media Backup UI component to `ThreadConfigModal`.
- [ ] Handle mutation triggers, loading state, and result messaging.
- [ ] Run full test suite (`npm test`) and lint checks.

---

### Task 6: End-to-End Verification

**Steps:**
- [ ] Run `npm run build` across apps to verify TypeScript compilation.
- [ ] Run `npm test` across all workspaces to verify 100% test passing.
- [ ] Review implementation against all spec requirements.

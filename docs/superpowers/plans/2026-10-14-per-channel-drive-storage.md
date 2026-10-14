# Per-Channel Google Drive Storage & Automated Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organize Google Drive storage strictly by immutable `channelId` (`zalobot/<channelId>/bill`, `image`, `video`), persist Drive folder links/IDs in `UserEntity` and `ZcaThreadConfigEntity`, update `@bot /drive` with access guidance, and implement `@bot share <gmail>` command plus REST API to grant Google Drive folder permissions per channel.

**Architecture:**
- **Database Mapping Persistence:** Add `drive_folder_id`, `drive_folder_url`, and `drive_folder_path` columns to `UserEntity` (table `users` for direct chats) and `ZcaThreadConfigEntity` (table `zca_thread_configs` for group channels). When folders are created/resolved, save this mapping into PostgreSQL so we always know which user/channel owns which Google Drive folder, even if names change later.
- **Strictly Immutable Channel Folder Identity:** Build folder paths using ONLY `channelId` (e.g. `zalobot/<channelId>/bill`) without appending group names, guaranteeing that renaming groups on Zalo never changes the folder path or creates duplicate folders.
- **Drive Permission Sharing Service:** Implement `GoogleDriveService.shareFolderWithUser(folderId, email, role)` calling Google Drive v3 `drive.permissions.create({ role: 'reader', type: 'user', emailAddress })`.
- **Zalo Command `@bot share <email>`:** Strategy `ShareDriveToolStrategy` checks current `chatId`, validates Gmail, ensures the channel's folder exists, calls the share service, and replies with confirmation.
- **Enhanced `@bot /drive`:** Strategy `GetStorageLinksToolStrategy` outputs links for the specific channel's folders (`zalobot/<channelId>/...`), caches the folder URL/ID into DB, and appends an access request prompt: `@bot share <gmail của bạn>`.
- **REST API Endpoint:** `POST /api/drive/share` with `{ channelId, email, role? }`.
- **Upload Routing:** Route bills, images, and videos into `zalobot/<channelId>/<category>/YYYY-MM`.

**Tech Stack:** NestJS, TypeScript, TypeORM, PostgreSQL, Google Drive API v3 (`googleapis`), Node.js Test Runner (`node:test`, `node:assert`).

**Spec:** User requested per-channel folder structure with pure `channelId`, storing drive folder paths/links in the user/channel table for permanent traceability, adding access request prompt in `@bot /drive`, and automated sharing API & command.

## Global Constraints

- Do NOT append channel names to Drive folder paths; paths MUST be strictly `zalobot/<channelId>` and `zalobot/<channelId>/<category>`.
- Do NOT persist ZCA login session cookies into PostgreSQL (user explicitly requested to skip session cookies in DB).
- Store drive folder info (`driveFolderId`, `driveFolderUrl`, `driveFolderPath`) into `UserEntity` and `ZcaThreadConfigEntity` for permanent tracking.
- Validate email addresses strictly before invoking Google Drive API.
- Scope share requests strictly to the channel from which the command was invoked.
- All existing and new tests must pass (`npm test`).

## Review Focus

1. **Database folder persistence:** When folder is created or resolved, verify `drive_folder_id`, `drive_folder_url`, and `drive_folder_path` are saved in `UserEntity` (for user chat) or `ZcaThreadConfigEntity` (for group chat).
2. **Pure channelId pathing:** Confirm folder path is exactly `zalobot/<channelId>/<category>` without any name prefix/suffix.
3. **Email format validation:** Invalid emails (e.g. `@bot share not-an-email`) must be rejected with a user-friendly error message before calling Google APIs.
4. **Channel boundary enforcement:** The `@bot share` command executed in Channel A must only share Channel A's folder, never root or other channels.
5. **Clear messaging:** If Google Drive is not connected or storage scopes are missing, provide clear admin instructions.

---

### Task 1: Database Entity & Service Updates for Drive Folder Tracking

**Files:**
- Modify: `apps/api/src/database/entities/user.entity.ts`
- Modify: `apps/api/src/database/entities/zca-thread-config.entity.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/zca/thread-config.service.ts`
- Modify: `apps/api/src/users/users.service.spec.ts` (or create if needed)

**Interfaces:**
- Produces:
  In `UserEntity`:
  ```ts
  @Column({ name: 'drive_folder_id', type: 'varchar', nullable: true })
  driveFolderId?: string;

  @Column({ name: 'drive_folder_url', type: 'varchar', nullable: true })
  driveFolderUrl?: string;

  @Column({ name: 'drive_folder_path', type: 'varchar', nullable: true })
  driveFolderPath?: string;
  ```
  In `ZcaThreadConfigEntity`:
  ```ts
  @Column({ name: 'drive_folder_id', type: 'varchar', nullable: true })
  driveFolderId?: string;

  @Column({ name: 'drive_folder_url', type: 'varchar', nullable: true })
  driveFolderUrl?: string;

  @Column({ name: 'drive_folder_path', type: 'varchar', nullable: true })
  driveFolderPath?: string;
  ```
  In `UsersService`:
  ```ts
  public async saveDriveFolderInfo(userId: string, folderInfo: { folderId?: string; folderUrl?: string; folderPath?: string }): Promise<void>;
  ```
  In `ThreadConfigService`:
  ```ts
  public async saveDriveFolderInfo(threadId: string, folderInfo: { folderId?: string; folderUrl?: string; folderPath?: string }): Promise<void>;
  ```

- [ ] **Step 1: Write test for saving drive folder info in UsersService & ThreadConfigService**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update `user.entity.ts`, `zca-thread-config.entity.ts`, `users.service.ts`, and `thread-config.service.ts`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/entities/user.entity.ts apps/api/src/database/entities/zca-thread-config.entity.ts apps/api/src/users/users.service.ts apps/api/src/zca/thread-config.service.ts
git commit -m "feat: persist Google Drive folder links and IDs in user and thread config entities"
```

---

### Task 2: Channel Storage Path Utility (Pure Channel ID)

**Files:**
- Create: `apps/api/src/google/channel-storage.util.ts`
- Create: `apps/api/src/google/channel-storage.util.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export function buildChannelFolder(channelId: string): string;
  export function getChannelDriveFolderPath(
    channelId: string,
    category?: 'bill' | 'image' | 'video',
  ): string;
  export function isValidEmail(email: string): boolean;
  ```

- [ ] **Step 1: Write unit tests for utility functions**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `apps/api/src/google/channel-storage.util.ts`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google/channel-storage.util.ts apps/api/src/google/channel-storage.util.spec.ts
git commit -m "feat: add channel storage path utility using pure channelId"
```

---

### Task 3: Google Drive Service Share Folder Method

**Files:**
- Modify: `apps/api/src/google/google-drive.service.ts`
- Modify: `apps/api/src/google/google-drive.service.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  public async shareFolderWithUser(
    folderPathOrId: string,
    emailAddress: string,
    role?: 'reader' | 'commenter' | 'writer',
    userId?: number | string,
  ): Promise<{ fileId: string; permissionId: string; emailAddress: string; role: string }>;
  ```

- [ ] **Step 1: Write test for `shareFolderWithUser` in `google-drive.service.spec.ts`**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `shareFolderWithUser` in `apps/api/src/google/google-drive.service.ts`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google/google-drive.service.ts apps/api/src/google/google-drive.service.spec.ts
git commit -m "feat: add shareFolderWithUser method in GoogleDriveService"
```

---

### Task 4: Channel-Aware Uploads in MediaStorageService

**Files:**
- Modify: `apps/api/src/receipt-storage/media-storage.service.ts`
- Modify: `apps/api/src/receipt-storage/media-storage.service.spec.ts`

**Interfaces:**
- Consumes: `getChannelDriveFolderPath` from Task 2.
- Allows `options.channelId` in `uploadBill`, `uploadImage`, and `uploadVideo`.

- [ ] **Step 1: Write test in `media-storage.service.spec.ts`**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update `apps/api/src/receipt-storage/media-storage.service.ts`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/receipt-storage/media-storage.service.ts apps/api/src/receipt-storage/media-storage.service.spec.ts
git commit -m "feat: automatically route uploads to zalobot/<channelId>/<category>"
```

---

### Task 5: Update `@bot /drive` with Channel Links, DB Persistence & Sharing Prompt

**Files:**
- Modify: `apps/api/src/zalo/text/strategies/get-storage-links-tool.strategy.ts`
- Create: `apps/api/src/zalo/text/strategies/get-storage-links-tool.strategy.spec.ts`

**Interfaces:**
- Consumes: `getChannelDriveFolderPath`, `buildChannelFolder`, `UsersService`, `ThreadConfigService`.

- [ ] **Step 1: Write unit test in `get-storage-links-tool.strategy.spec.ts`**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update `GetStorageLinksToolStrategy`**
  - Retrieve webViewLink for channel folders (`zalobot/<channelId>`).
  - Persist `driveFolderUrl`, `driveFolderId`, `driveFolderPath` via `ThreadConfigService` (if group) or `UsersService` (if user).
  - Output links and access sharing prompt: `@bot share <gmail của bạn>`.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/zalo/text/strategies/get-storage-links-tool.strategy.ts apps/api/src/zalo/text/strategies/get-storage-links-tool.strategy.spec.ts
git commit -m "feat: display channel-specific links, save to DB, and add share prompt in /drive"
```

---

### Task 6: Implement `@bot share <gmail>` Command Strategy (`ShareDriveToolStrategy`)

**Files:**
- Create: `apps/api/src/zalo/text/strategies/share-drive-tool.strategy.ts`
- Create: `apps/api/src/zalo/text/strategies/share-drive-tool.strategy.spec.ts`
- Modify: `apps/api/src/zalo/text/text-tool.enum.ts`
- Modify: `apps/api/src/zalo/text/text-tool.factory.ts`
- Modify: `apps/api/src/zalo/zalo.module.ts`

**Interfaces:**
- Produces: `TextToolType.SHARE_DRIVE` strategy.
- Matches: `@bot share <email>`, `/share-drive <email>`, `/sharedrive <email>`, `/share <email>`.

- [ ] **Step 1: Write test for `ShareDriveToolStrategy`**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `ShareDriveToolStrategy` and wire into `TextToolFactory` & `ZaloModule`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/zalo/text/text-tool.enum.ts apps/api/src/zalo/text/strategies/share-drive-tool.strategy.ts apps/api/src/zalo/text/strategies/share-drive-tool.strategy.spec.ts apps/api/src/zalo/text/text-tool.factory.ts apps/api/src/zalo/zalo.module.ts
git commit -m "feat: add @bot share command strategy to grant Google Drive folder access"
```

---

### Task 7: REST API Endpoint `POST /api/drive/share`

**Files:**
- Create: `apps/api/src/google/dto/share-drive.dto.ts`
- Modify: `apps/api/src/google/google-resources.controller.ts`
- Modify: `apps/api/src/google/google-resources.controller.spec.ts`

**Interfaces:**
- Produces: `POST /api/drive/share`

- [ ] **Step 1: Write test for `POST /api/drive/share` in `google-resources.controller.spec.ts`**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement endpoint in `GoogleResourcesController`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google/dto/share-drive.dto.ts apps/api/src/google/google-resources.controller.ts apps/api/src/google/google-resources.controller.spec.ts
git commit -m "feat: add REST API endpoint POST /api/drive/share"
```

---

### Task 8: Pass Channel Context in All Media Upload Callers

**Files:**
- Modify: `apps/api/src/zalo/pending-image/strategies/create-bill-pending-image.strategy.ts`
- Modify: `apps/api/src/zalo/pending-image/strategies/storage-upload-pending-image.strategy.ts`
- Modify: `apps/api/src/zalo/input-processor.service.ts`
- Modify: `apps/api/src/zca/zca-bot-feature.service.ts`

- [ ] **Step 1: Wire channelId into upload calls**

- [ ] **Step 2: Run test suite to verify no regressions**

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/zalo/pending-image/strategies/create-bill-pending-image.strategy.ts apps/api/src/zalo/pending-image/strategies/storage-upload-pending-image.strategy.ts apps/api/src/zalo/input-processor.service.ts apps/api/src/zca/zca-bot-feature.service.ts
git commit -m "feat: attach channelId to all media upload workflows"
```

---

### Task 9: Full Verification, Documentation & Linting

**Files:**
- Modify: `docs/google-integration.md`

- [ ] **Step 1: Run linter, typecheck, and full test suite**

- [ ] **Step 2: Update documentation in `docs/google-integration.md`**

- [ ] **Step 3: Commit**

```bash
git add docs/google-integration.md
git commit -m "docs: document channel-specific Google Drive organization and sharing feature"
```

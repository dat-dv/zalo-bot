# Strict Whitelist & Database Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ cơ chế lắng nghe ZCA sang Strict Whitelist (Default Deny), đồng bộ trạng thái bật/tắt chính xác với PostgreSQL & Redis (không còn lỗi resurrection khi gỡ thread), tắt tự động gửi Welcome Message khi chưa bật cờ cấu hình, và loại bỏ hoàn toàn việc đọc/ghi fallback vào các file JSON tĩnh.

**Architecture:** Sử dụng `ThreadConfigService` (PostgreSQL + Redis Set `zca:listened_threads`) làm Single Source of Truth duy nhất. `ZcaService` áp dụng nguyên tắc Default Deny: chỉ cho phép nhận tin nhắn và sự kiện nhóm khi thread ID nằm trong Whitelist đã kích hoạt. Bổ sung cờ cấu hình `enableWelcome` cho `WelcomeGroupEventStrategy` để không tự ý gửi tin nhắn chào mừng. Loại bỏ hàm ghi đè `saveLegacyFiles()` và các tham chiếu file JSON.

**Tech Stack:** NestJS, TypeScript, PostgreSQL (TypeORM), Redis (ioredis), node:test.

**Spec:** Yêu cầu từ user: ngăn chặn triệt để rò rỉ tin nhắn chào mừng đến các group chưa được listen; loại bỏ việc dựa vào file JSON phẳng vì hệ thống đã chuyển sang Database.

## Global Constraints

- Tuân thủ nguyên tắc **Strict Whitelist (Default Deny)**: nếu danh sách lắng nghe rỗng (`size === 0`), KHÔNG xử lý tin nhắn và sự kiện của bất kỳ nhóm/cuộc trò chuyện nào.
- Single Source of Truth là `ThreadConfigService` (PostgreSQL `ZcaThreadConfigEntity` & Redis `zca:listened_threads`).
- Không phá vỡ các hợp đồng `@zalobot/contracts` (`ThreadBotConfig`, `UpdateThreadBotConfigDto`).
- Tất cả unit tests trong `apps/api` phải pass 100%.

## Review Focus

1. **Empty Whitelist Boundary:** Khi khởi động mà chưa cấu hình bất kỳ thread nào (`listenedThreadIds.size === 0`), `group_event` và `message` từ mọi thread đều phải bị bỏ qua ngay lập tức.
2. **Unlistening Sync:** Khi gọi `setListenedThreadIds(['A'])` sau khi trước đó đang listen `['A', 'B']`, thread `B` phải được cập nhật `isListened = false` trong DB và Redis.
3. **Welcome Message Opt-in:** Nếu chưa cấu hình `ZCA_ENABLE_WELCOME=true` hoặc `zca.enableWelcome=true`, `WelcomeGroupEventStrategy` không được gửi tin nhắn chào mừng.
4. **No JSON file writes:** Các thao tác cấu hình (`saveConfigs`, `updateConfig`, `setListenedThreadIds`, `toggleListenedThread`) không được sinh ra hay ghi đè các file `.zca-listened-threads.json` hoặc `.zca-thread-configs.json`.
5. **Direct Interaction Safety:** Kiểm tra `isListened` phải nhất quán giữa `ZcaService` và `ZcaBotFeatureService`.

---

### Task 1: Áp dụng Strict Whitelist (Default Deny) và sửa lỗi đồng bộ khi gỡ thread trong `ZcaService`

**Files:**
- Modify: `apps/api/src/zca/zca.service.ts`

**Interfaces:**
- `ZcaService.setListenedThreadIds(ids: string[]): Promise<void>`
- `ZcaService.startListener(): void`

- [ ] **Step 1: Sửa logic lọc tin nhắn và sự kiện nhóm sang Default Deny**
      - Trong `listener.on('message')`:
        Đổi `const isListened = this.listenedThreadIds.size === 0 || this.listenedThreadIds.has(threadId);`
        thành `const isListened = this.listenedThreadIds.has(threadId);`.
      - Trong `listener.on('group_event')`:
        Đổi `if (this.listenedThreadIds.size > 0 && !this.listenedThreadIds.has(event.threadId))`
        thành `if (!this.listenedThreadIds.has(event.threadId)) { this.logger.debug(...); return; }`.

- [ ] **Step 2: Sửa `setListenedThreadIds` để đồng bộ hủy kích hoạt (unlisten) các thread bị loại bỏ**
      - So sánh `previousListenedIds` với `newListenedIds`.
      - Duyệt qua các `removedId` và gọi `await this.threadConfigService.setListened(removedId, false)`.
      - Duyệt qua các `addedId` và gọi `await this.threadConfigService.setListened(addedId, true)`.

- [ ] **Step 3: Loại bỏ việc đọc/ghi file `.zca-listened-threads.json` trong `ZcaService`**
      - Bỏ `this.whitelistFilePath`.
      - Trong `loadListenedThreads()`: chỉ nạp từ `this.threadConfigService.getListenedThreadIds()`, không fallback đọc từ file `.zca-listened-threads.json`.
      - Trong `saveListenedThreads()`: không ghi file JSON ra đĩa.

---

### Task 2: Thêm cờ cấu hình `enableWelcome` cho `WelcomeGroupEventStrategy`

**Files:**
- Modify: `apps/api/src/zca/strategies/welcome-group-event.strategy.ts`
- Modify: `apps/api/src/config/configuration.ts`

**Interfaces:**
- `WelcomeStrategyOptions.enabled?: boolean`
- `WelcomeGroupEventStrategy.canHandle(event: GroupEvent): boolean`

- [ ] **Step 1: Cập nhật `configuration.ts`**
      - Thêm `enableWelcome: process.env.ZCA_ENABLE_WELCOME === 'true'` vào namespace `zca`.

- [ ] **Step 2: Cập nhật `WelcomeGroupEventStrategy`**
      - Thêm kiểm tra trong `canHandle(event: GroupEvent)`:
        Nếu không bật cờ (`this.options?.enabled !== true && this.configService?.get<boolean>('zca.enableWelcome') !== true`), trả về `false` để không xử lý gửi tin nhắn chào mừng.

---

### Task 3: Loại bỏ hàm fallback ghi file JSON trong `ThreadConfigService`

**Files:**
- Modify: `apps/api/src/zca/thread-config.service.ts`

**Interfaces:**
- `ThreadConfigService.saveConfigs(): Promise<void>`
- `ThreadConfigService.updateConfig(...): Promise<ThreadBotConfig>`

- [ ] **Step 1: Bỏ gọi `saveLegacyFiles()` trong `ThreadConfigService`**
      - Xóa các lời gọi `await this.saveLegacyFiles()` trong `loadConfigs()`, `saveConfigs()`, `getConfig()`, `updateConfig()`.
      - Xóa phương thức `saveLegacyFiles()`.

---

### Task 4: Bổ sung và cập nhật Unit Tests kiểm thử Strict Whitelist & Welcome Toggle

**Files:**
- Modify: `apps/api/src/zca/zca.service.spec.ts`
- Create/Modify: `apps/api/src/zca/strategies/welcome-group-event.strategy.spec.ts`

- [ ] **Step 1: Cập nhật `zca.service.spec.ts`**
      - Thêm test case: khi `listenedThreadIds` rỗng, tin nhắn từ bất kỳ thread nào đều bị bỏ qua (`isListened = false`).
      - Thêm test case: khi `listenedThreadIds` rỗng, `group_event` bị bỏ qua và không gọi `dispatchGroupEvent`.
      - Thêm test case: khi `setListenedThreadIds` đổi danh sách, các thread bị bỏ ra phải được gọi `setListened(removedId, false)`.

- [ ] **Step 2: Viết test case cho `WelcomeGroupEventStrategy`**
      - Kiểm tra `canHandle` trả về `false` khi `enableWelcome` không được bật.
      - Kiểm tra `canHandle` trả về `true` khi `enableWelcome` được bật và có sự kiện `JOIN`.

- [ ] **Step 3: Chạy test suite và kiểm tra typecheck**
      - Chạy: `npm test --workspace @zalobot/api`
      - Chạy: `npm run typecheck --workspace @zalobot/api`

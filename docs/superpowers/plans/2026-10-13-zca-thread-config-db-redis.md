# ZCA Thread Config Database & Redis Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi lưu trữ cấu hình ZCA threads và Whitelist từ file JSON phẳng sang PostgreSQL (TypeORM Entity & Migration) kết hợp Redis caching, đồng thời loại bỏ hoàn toàn dummy data `thread-123`.

**Architecture:** Tạo TypeORM entity `ZcaThreadConfigEntity` và migration tạo bảng `zca_thread_configs` trong PostgreSQL. Refactor `ThreadConfigService` để sử dụng PostgreSQL làm persistent storage và Redis (`RedisService`) làm fast-lookup cache layer (cache-aside) cho cả thread configs và whitelist set. Dọn dẹp các file JSON tĩnh và loại bỏ dummy `thread-123`.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Redis (ioredis), TypeScript.

**Spec:** Yêu cầu từ user: loại bỏ example `thread-123`, tạo bảng PostgreSQL lưu trữ cấu hình cuộc trò chuyện và đưa lên Redis để tối ưu hóa hiệu năng tra cứu whitelist khi nhận tin nhắn realtime.

## Global Constraints

- Không làm gián đoạn interface của `@zalobot/contracts` (`ThreadBotConfig`, `UpdateThreadBotConfigDto`).
- `RedisService` đã tồn tại trong `apps/api/src/redis/redis.service.ts` và được cung cấp bởi `@Global()` `RedisModule`.
- Khi whitelist rỗng (không có thread nào được bật `isListened`), hệ thống giữ nguyên logic cho phép nhận tin từ tất cả các thread, hoặc chỉ lọc khi danh sách có phần tử.
- Không để sót dummy `thread-123` trong persistent storage hoặc cache.

## Review Focus

1. **Redis connection failure fallback:** Nếu Redis bị down/chưa sẵn sàng, `ThreadConfigService` vẫn hoạt động trơn tru dựa trên Database & in-memory cache mà không ném lỗi ra ZCA listener.
2. **Real-time Whitelist Check Latency:** Kiểm tra whitelist `isThreadListened(threadId)` phải đạt O(1) qua in-memory/Redis set để không làm trễ event loop khi tin nhắn ZCA dồn dập.
3. **Database Concurrency & Idempotency:** Thao tác `getConfig` hoặc `updateConfig` cho thread mới phải an toàn, tránh lỗi unique constraint violation khi nhận nhiều event cùng lúc.
4. **Data Migration:** Nếu tồn tại dữ liệu cũ trong `.zca-thread-configs.json` (ví dụ thread thực `8053596736283554635`), tự động migrate sang PostgreSQL và bỏ qua `thread-123`.
5. **Dọn dẹp triệt để `thread-123`:** Đảm bảo file JSON và DB không còn `thread-123` làm bot chặn tin nhắn của thread thật `5854445174804412080`.

---

### Task 1: Dọn dẹp dữ liệu mẫu `thread-123` và bổ sung phương thức Redis Set trong RedisService

**Files:**

- Modify: `apps/api/src/redis/redis.service.ts`
- Modify: `apps/api/.zca-listened-threads.json`
- Modify: `apps/api/.zca-thread-configs.json`

**Interfaces:**

- `RedisService.sadd(key: string, ...members: string[]): Promise<boolean>`
- `RedisService.srem(key: string, ...members: string[]): Promise<boolean>`
- `RedisService.smembers(key: string): Promise<string[]>`
- `RedisService.sismember(key: string, member: string): Promise<boolean>`

- [x] **Step 1: Thêm các method thao tác Set cho RedisService**
      Thêm `sadd`, `srem`, `smembers`, `sismember` vào `RedisService` có try/catch an toàn không làm crash server nếu Redis gặp sự cố.

- [x] **Step 2: Dọn dẹp `thread-123` khỏi `.zca-listened-threads.json` và `.zca-thread-configs.json`**
      Xóa `thread-123` khỏi `.zca-listened-threads.json` (đưa về `[]`) và `.zca-thread-configs.json`.

- [x] **Step 3: Chạy test hiện tại để kiểm tra độ tương thích**
      Chạy: `npm test` trong `apps/api`.

---

### Task 2: Tạo TypeORM Entity và Migration cho `zca_thread_configs`

**Files:**

- Create: `apps/api/src/database/entities/zca-thread-config.entity.ts`
- Create: `apps/api/src/database/migrations/1724740000000-CreateZcaThreadConfigs.ts`
- Modify: `apps/api/src/database/data-source.ts`
- Modify: `apps/api/src/database/database.module.ts`
- Modify: `apps/api/src/zca/zca.module.ts`

**Interfaces:**

- `ZcaThreadConfigEntity` mapping bảng `zca_thread_configs`
  - `threadId`: Primary key (varchar)
  - `threadName`: varchar, nullable
  - `threadType`: varchar ('user' | 'group')
  - `isListened`: boolean, indexed
  - `mediaBackup`: jsonb
  - `expenseTracking`: jsonb
  - `calendarExtraction`: jsonb
  - `confirmationRules`: jsonb
  - `createdAt`: timestamptz
  - `updatedAt`: timestamptz

- [x] **Step 1: Tạo Entity `ZcaThreadConfigEntity`**
      Tạo file `apps/api/src/database/entities/zca-thread-config.entity.ts`.

- [x] **Step 2: Tạo Migration `1724740000000-CreateZcaThreadConfigs.ts`**
      Tạo file `apps/api/src/database/migrations/1724740000000-CreateZcaThreadConfigs.ts` tạo bảng và index `is_listened`.

- [x] **Step 3: Đăng ký Entity & Migration vào `data-source.ts` và `database.module.ts`**
      Thêm `ZcaThreadConfigEntity` và `CreateZcaThreadConfigs1724740000000` vào cả hai file.

- [x] **Step 4: Đăng ký TypeOrmModule.forFeature([ZcaThreadConfigEntity]) vào `zca.module.ts`**
      Import `TypeOrmModule.forFeature([ZcaThreadConfigEntity])` trong imports của `ZcaModule`.

- [x] **Step 5: Kiểm tra TypeScript build**
      Chạy: `npm run typecheck` trong `apps/api`.

---

### Task 3: Refactor `ThreadConfigService` dùng PostgreSQL + Redis Caching

**Files:**

- Modify: `apps/api/src/zca/thread-config.service.ts`
- Modify: `apps/api/src/zca/thread-config.service.spec.ts`

**Interfaces:**

- `ThreadConfigService.getConfig(threadId: string, meta?: ...): Promise<ThreadBotConfig>`
- `ThreadConfigService.getAllConfigs(): Promise<ThreadBotConfig[]>` (hoặc đồng bộ sync với in-memory cache)
- `ThreadConfigService.getListenedThreadIds(): string[]`
- `ThreadConfigService.isThreadListened(threadId: string): boolean`
- `ThreadConfigService.updateConfig(threadId: string, update: UpdateThreadBotConfigDto, meta?: ...): Promise<ThreadBotConfig>`
- `ThreadConfigService.setListened(threadId: string, isListened: boolean): Promise<ThreadBotConfig>`
- `ThreadConfigService.toggleListened(threadId: string): Promise<boolean>`

- [x] **Step 1: Cập nhật `ThreadConfigService`**
      Inject `Repository<ZcaThreadConfigEntity>` và `RedisService`.
      Trong `onModuleInit()`:

1. Đọc tất cả records từ bảng `zca_thread_configs`.
2. Nếu bảng rỗng và file legacy `.zca-thread-configs.json` có dữ liệu (bỏ qua `thread-123`), lưu vào DB.
3. Sync vào Redis: key `zca:listened_threads` (Redis Set) và `zca:thread_config:${threadId}` (JSON string).
4. Lưu vào in-memory `configsMap` và `listenedThreadIds` để phục vụ đọc siêu tốc tức thì.

- [x] **Step 2: Cập nhật các phương thức CRUD**
      Đảm bảo khi `updateConfig`, `setListened`, `toggleListened`:
- Cập nhật Database.
- Cập nhật Redis Set và Redis Key.
- Cập nhật in-memory cache.

- [x] **Step 3: Cập nhật Unit Tests trong `thread-config.service.spec.ts`**
      Mock `Repository<ZcaThreadConfigEntity>` và `RedisService` để kiểm tra các luồng:
- Đọc từ cache / DB.
- Cập nhật và lưu vào DB + Redis.
- Bỏ qua dữ liệu `thread-123`.

- [x] **Step 4: Chạy test xác nhận**
      Chạy: `npm test` trong `apps/api`.

---

### Task 4: Đồng bộ `ZcaService` và `ZcaController` với `ThreadConfigService` mới

**Files:**

- Modify: `apps/api/src/zca/zca.service.ts`
- Modify: `apps/api/src/zca/zca.controller.ts`
- Modify: `apps/api/src/zca/zca.service.spec.ts`

- [x] **Step 1: Tối ưu `ZcaService` khi kiểm tra whitelist**
      Sử dụng `this.threadConfigService.getListenedThreadIds()` kết hợp in-memory cache, không còn phụ thuộc vào file JSON local `.zca-listened-threads.json`.

- [x] **Step 2: Kiểm tra và cập nhật `ZcaController`**
      Đảm bảo endpoint `GET /api/zca/thread-configs`, `PUT /api/zca/thread-configs/:threadId`, và `POST /api/zca/threads/toggle` gọi các method async của `ThreadConfigService` chính xác.

- [x] **Step 3: Cập nhật `zca.service.spec.ts`**
      Đảm bảo test spec không còn phụ thuộc vào file JSON hay hardcode `thread-123`.

- [x] **Step 4: Chạy toàn bộ test suite và build**
      Chạy: `npm test && npm run typecheck` trong `apps/api`.

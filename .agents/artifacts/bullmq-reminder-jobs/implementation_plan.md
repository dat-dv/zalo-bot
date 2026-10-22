# Kế hoạch: Thay cron `@nestjs/schedule` bằng BullMQ cho nhắc việc và lời nhắc

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Mức rủi ro: **MEDIUM–HIGH** (thêm hạ tầng hàng đợi, Redis thành phụ thuộc bắt buộc của luồng nhắc, đổi cách gửi nhắc)
- Branch hiện tại: `chore/remove-telegram-leftovers` đang có nhiều thay đổi chưa commit của task khác. **Đề xuất làm trên branch riêng** `feat/bullmq-reminder-jobs` tách từ `main`, không đụng vào các file đang dở.

## 1. Hiện trạng

| Job | File | Cách chạy |
| --- | --- | --- |
| Nhắc việc | `apps/api/src/tasks/task-reminder-scheduler.service.ts` | `@Cron(EVERY_30_SECONDS)`, cờ `running` chống chồng tick |
| Lời nhắc | `apps/api/src/reminders/reminder-scheduler.service.ts` | `@Cron(EVERY_30_SECONDS)` |

- `ScheduleModule.forRoot()` ở `apps/api/src/app.module.ts`. Ngoài hai job này không còn chỗ nào dùng `@nestjs/schedule`.
- Mỗi tick làm 4 việc: quét DB (`getDueTaskReminders` / `getDueReminders`, mỗi lần 50 dòng) → giành quyền gửi bằng `UPDATE ... WHERE sent_at IS NULL` → refresh summary → gửi qua `ReminderTargetService.deliver()`.
- **Lỗ hổng:** giành quyền gửi xong thì lần nhắc đã bị đánh dấu là đã gửi. Nếu `deliver()` trả `'failed'`, lần nhắc mất luôn, không thử lại.
- `setTimeout`/`setInterval` khác (hạn của thao tác chờ duyệt, gom ảnh, nhịp "đang gõ") **không phải cron** → nằm ngoài phạm vi.

## 2. Thiết kế đích

Postgres vẫn là nguồn sự thật của lần nhắc. BullMQ thay `@nestjs/schedule` ở hai việc: **lịch quét** và **gửi có retry**.

```
BullMQ Job Scheduler (every 30s, 1 bản duy nhất dù chạy nhiều instance)
   └─ job "scan"  ──► quét DB các lần nhắc đến hạn
                      ├─ ZCA chưa đăng nhập → bỏ qua tick (giữ hành vi cũ)
                      ├─ giành quyền gửi bằng UPDATE có điều kiện (giữ nguyên)
                      ├─ refreshReminderSummary
                      └─ thêm job "deliver" { timeId, remindAt }, jobId cố định
   └─ job "deliver" ──► đọc lại dữ liệu mới nhất → gửi tới đích nhắc
                      ├─ 'sent' | 'skipped' → xong
                      └─ 'failed' → throw → BullMQ retry (backoff lũy thừa)
```

### Quyết định

1. **Thư viện:** `bullmq@^5.81.5` và `@nestjs/bullmq@^10.2.3`. Bản 10.x là bản hỗ trợ Nest 10 (dự án đang ở 10.4.22), và chỉ nhận peer `bullmq ^5`, nên không dùng bullmq 6.
2. **Bỏ `@nestjs/schedule`:** gỡ khỏi `apps/api/package.json` và bỏ `ScheduleModule.forRoot()`.
3. **Hai queue, mỗi module một queue:**
   - `task-reminders` (module tasks), có 2 job: `scan` và `deliver`.
   - `reminders` (module reminders), có 2 job: `scan` và `deliver`.
   - Tên queue và tên job là hằng `as const`, đặt trong file `*.queue.ts` của từng module.
4. **Lịch quét:** gọi `queue.upsertJobScheduler('scan', { every: 30_000 }, { name: 'scan' })` trong `onApplicationBootstrap` của processor. Lệnh này idempotent khi restart và chỉ có một scheduler cho dù chạy nhiều instance. Không `await` để chặn bootstrap: nếu Redis không lên thì chỉ log lỗi, API vẫn chạy.
5. **Vẫn giành quyền gửi trước rồi mới enqueue**, giữ đúng ngữ nghĩa hiện tại: lần nhắc nào đã giành được quyền gửi thì không bị scan khác lấy lại. Phần chưa an toàn chuyển sang job `deliver` có retry.
   - `jobId` của job deliver: nhắc việc dùng `task-time:<timeId>`; lời nhắc dùng `reminder-time:<timeId>:<remindAt ISO>`. Lời nhắc lặp dùng lại cùng một dòng time và chỉ dời `remindAt`, nên phải kèm mốc giờ vào jobId.
   - Payload là `{ timeId, remindAt }` (ISO string). Riêng lời nhắc cần đúng `remindAt` lúc nổ để in giờ trong tin, vì sau khi giành quyền gửi thì `remindAt` đã bị dời.
6. **Retry:** `attempts: 5`, `backoff: { type: 'exponential', delay: 30_000 }` (thử lại sau khoảng 30s, 1m, 2m, 4m, tổng khoảng 7,5 phút). Chỉ retry khi `deliver()` trả `'failed'` hoặc throw. Hết lượt thì log `error` và giữ job lỗi lại để tra (`removeOnFail: { age: 7 ngày }`). `removeOnComplete: true`.
7. **Job deliver đọc lại dữ liệu trước khi gửi:**
   - Nhắc việc: nếu việc đã xoá hoặc đã `completed` thì bỏ qua, không gửi. Hành vi này mới so với hiện tại nhưng đúng với CONTEXT.md: "Việc đã xong hoặc đã xoá thì không nhắc".
   - Lời nhắc: nếu lời nhắc đã bị xoá thì bỏ qua.
   - Đích nhắc (chat, người được nhắc, cách nhắc) lấy từ dữ liệu lúc gửi.
8. **Worker:** `concurrency: 1` cho mỗi queue, để không dồn tin sang Zalo và giữ thứ tự gửi từ cũ tới mới.
9. **Kết nối:** thêm `BullModule.forRootAsync` vào module mới `apps/api/src/queue/queue.module.ts`. Module này đọc `redis.url` (fallback `redis://localhost:6379` giống `RedisService`), đặt `prefix: 'zalobot'` và `maxRetriesPerRequest: null` (BullMQ bắt buộc). BullMQ dùng connection ioredis riêng, không dùng chung client của `RedisService`.
10. **Không cần migration và không cần env mới.** Lần nhắc đang chờ trong DB sẽ được scan đầu tiên lấy lên như bình thường.

### Đánh đổi cần anh biết

- **Redis thành phụ thuộc bắt buộc của luồng nhắc.** Redis chết thì không có tick nào chạy (hiện nay cron vẫn chạy được khi không có Redis). Khi Redis lên lại, lần nhắc chưa gửi vẫn nằm trong DB nên vẫn được gửi, chỉ bị trễ. Prod đã có Redis với `appendonly yes` trong `docker-compose.yml`.
- **Có một khe nhỏ có thể mất nhắc:** đã giành quyền gửi trong DB nhưng `queue.add` thất bại vì Redis rớt đúng lúc đó. Xử lý: nếu `add` throw thì trả quyền gửi lại bằng cách đặt `sent_at = NULL` (với lời nhắc lặp thì khôi phục `remindAt` cũ), để tick sau lấy lại.
- **Retry có thể gửi trùng:** nếu Zalo đã nhận tin nhưng `deliver()` vẫn báo lỗi, lần thử lại sẽ gửi thêm. Đây là ngữ nghĩa at-least-once, đổi lại không còn mất nhắc âm thầm. Riêng chế độ nhắn riêng nhiều người, nếu chỉ một vài người lỗi thì `deliver()` hiện đã tag bù trong nhóm và trả `'sent'`, nên không retry.

## 3. Thay đổi theo file

### Hạ tầng
| File | Thay đổi |
| --- | --- |
| `apps/api/package.json`, `package-lock.json` | + `bullmq@^5.81.5`, `@nestjs/bullmq@^10.2.3`; − `@nestjs/schedule` |
| `apps/api/src/queue/queue.module.ts` (mới) | `BullModule.forRootAsync` (connection từ `ConfigService`, prefix, `maxRetriesPerRequest: null`) |
| `apps/api/src/queue/queue-connection.ts` (mới) | Hàm thuần `buildQueueConnection(url)` → `ConnectionOptions`, có test |
| `apps/api/src/app.module.ts` | − `ScheduleModule.forRoot()`, + `QueueModule` |

### Module tasks
| File | Thay đổi |
| --- | --- |
| `tasks/task-reminder.queue.ts` (mới) | `TASK_REMINDERS_QUEUE`, `TASK_REMINDER_JOBS = { SCAN, DELIVER }`, kiểu payload, `taskReminderJobId(timeId)`, các tùy chọn job (attempts/backoff) |
| `tasks/task-reminder-scheduler.service.ts` | Bỏ `@Cron` và cờ `running`. Còn 2 method: `scanDueReminders(now)` (giành quyền gửi, refresh rồi enqueue; enqueue lỗi thì trả quyền gửi) và `deliverReminder(payload)` (đọc lại, gửi, trả kết quả). Inject `@InjectQueue(TASK_REMINDERS_QUEUE)` |
| `tasks/task-reminder.processor.ts` (mới) | `@Processor(TASK_REMINDERS_QUEUE, { concurrency: 1 })` kế thừa `WorkerHost`; `process(job)` rẽ theo `job.name`; `'failed'` thì throw để retry; `onApplicationBootstrap` gọi upsert scheduler; `@OnWorkerEvent('failed')` log khi hết lượt |
| `tasks/tasks.service.ts` | + `getTaskReminderTime(timeId)` (kèm task, kể cả task đã xoá, để biết mà bỏ qua); + `releaseTaskReminderTime(timeId)` (đặt lại `sent_at = NULL`) |
| `tasks/tasks.module.ts` | + `BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE })`, + `TaskReminderProcessor` |

### Module reminders
| File | Thay đổi |
| --- | --- |
| `reminders/reminder.queue.ts` (mới) | Tương tự: `REMINDERS_QUEUE`, `REMINDER_JOBS`, payload `{ timeId, remindAt }`, `reminderJobId(timeId, remindAt)` |
| `reminders/reminder-scheduler.service.ts` | Bỏ `@Cron`; tách thành `scanDueReminders(now)` và `deliverReminder(payload)`; giữ nguyên format tin; sửa `catch (err)` + `err as Error` thành `catch (err: unknown)` (theo strict-types) |
| `reminders/reminder.processor.ts` (mới) | Như processor của tasks |
| `reminders/reminders.service.ts` | + `getReminderTime(timeId)`; + `releaseReminderTime(time, claimedChange)` (trả quyền gửi cho lần một lần, hoặc khôi phục `remindAt` cũ cho lần lặp) |
| `reminders/reminders.module.ts` | + `registerQueue`, + `ReminderProcessor` |

### Kiểm thử
- `tasks/task-reminder-scheduler.service.spec.ts`: viết lại theo 2 bước, dùng queue giả (mảng job được thêm). Các case:
  - Scan giành quyền gửi rồi enqueue đúng jobId; chạy scan lần hai không enqueue thêm.
  - ZCA chưa đăng nhập thì không giành quyền gửi.
  - Enqueue lỗi thì trả quyền gửi lại.
  - Deliver gửi đúng chat, tag đúng người (giữ các assert cũ).
  - Deliver bỏ qua việc đã xong hoặc đã xoá.
  - Deliver trả `'failed'` khi gửi lỗi.
- `reminders/reminder-scheduler.service.spec.ts` (mới, hiện chưa có spec): các case tương ứng, thêm lời nhắc lặp (jobId kèm `remindAt`; enqueue lỗi thì khôi phục `remindAt`).
- `queue/queue-connection.spec.ts`: parse URL, có mật khẩu, có db index, fallback localhost.
- Processor chỉ rẽ nhánh mỏng nên không viết unit test riêng.

### Tài liệu (Hard Completion Gate)
| Knowledge (EN) | Docs (VI) |
| --- | --- |
| `knowledge/modules/tasks/README.md`: mục scheduler, `depends_on` thêm processor và queue | `docs/modules/tasks/README.md` |
| `knowledge/modules/reminders/README.md`: mục Scheduler, câu "fired by a backend cron" | `docs/modules/reminders/README.md` (kể cả hướng dẫn thử tay "chờ tối đa 30 giây") |
| `knowledge/global/backend-runtime-services.md`: mục Reminder scheduler đổi thành "Background jobs (BullMQ)", nêu queue, retry và yêu cầu Redis | `docs/global/backend-runtime-services.md` |
| `knowledge/global/README.md`: dòng mô tả | `docs/README.md` nếu index thay đổi |

Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 4. Kiểm chứng

1. `npm run typecheck --workspace @zalobot/api`
2. `npm run lint --workspace @zalobot/api`
3. `npm run test --workspace @zalobot/api`
4. `npm run build --workspace @zalobot/api`
5. Thử tay với Redis local (`docker-compose.local.yml`):
   - Chạy `npm run dev`, kiểm tra trong Redis có key scheduler `zalobot:task-reminders:repeat:*` và `zalobot:reminders:repeat:*`.
   - Tạo lời nhắc 1 phút nữa và nhận được tin.
   - Tắt ZCA rồi tạo nhắc: nhắc chưa gửi; đăng nhập lại thì nhắc được gửi.
   - Phần thử tay cần anh xác nhận có cho em chạy hay không, vì phải đăng nhập ZCA thật.
6. `node .claude/hooks/docs-drift-check.mjs`

## 5. Ngoài phạm vi

- Không đưa OCR, LLM hay upload Drive/Photos vào queue (có thể làm ở bước sau).
- Không thêm bull-board hay trang theo dõi job trên dashboard.
- Không đổi các `setTimeout`/`setInterval` khác.
- Không thêm rate limiter gửi Zalo, vì đã có `concurrency: 1`.

## 6. Câu hỏi cần anh chốt

1. Làm trên branch mới `feat/bullmq-reminder-jobs` tách từ `main` (em đề xuất), hay làm tiếp trên `chore/remove-telegram-leftovers`?
2. Retry 5 lần, backoff 30 giây lũy thừa (tổng khoảng 7,5 phút) có ổn không?
3. Chấp nhận Redis là phụ thuộc bắt buộc của luồng nhắc (mất Redis thì nhắc bị trễ, không mất)?

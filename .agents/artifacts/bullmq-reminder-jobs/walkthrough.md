# Walkthrough: Chuyển cron nhắc việc/lời nhắc sang BullMQ

Branch: `feat/bullmq-reminder-jobs`, merge vào `main`.

## Đã làm

- Gỡ `@nestjs/schedule`, thêm `bullmq@^5.81.5` và `@nestjs/bullmq@^10.2.3`.
- Thêm `apps/api/src/queue/`:
  - `QueueModule`: kết nối Redis theo `REDIS_URL`, prefix `zalobot`, `maxRetriesPerRequest: null`.
  - `queue.constants.ts`: chu kỳ quét 30 giây, tùy chọn retry của job deliver (5 lần, giãn cách tăng dần từ 30 giây).
  - `reminder-job.ts`: rẽ job theo tên, đăng ký scheduler, xác định khi nào là lỗi cuối.
  - `reminder-queue.ts`: kiểu payload, type guard, logger lỗi kết nối có giới hạn (tối đa 1 lần/phút).
- Hai queue `task-reminders` và `reminders`, mỗi queue có một processor (`concurrency: 1`) và hai job `scan` / `deliver`.
- `TasksService`: thêm `releaseTaskReminderTime` và `getTaskReminderTime`. `RemindersService`: thêm `releaseReminderTime` và `getReminderTime`.
- Viết lại spec nhắc việc, thêm spec lời nhắc và spec cho `reminder-job`.
- Cập nhật knowledge/docs: `global/backend-runtime-services`, `global/README`, `modules/tasks`, `modules/reminders`.

## Khác với plan

- Không viết `queue-connection.ts`, vì BullMQ nhận thẳng `url` trong connection options.
- Lúc tự rà phát hiện thêm một lỗi và đã sửa: nếu ZCA đăng xuất sau khi lần nhắc đã được giành quyền gửi, job deliver sẽ retry hết 5 lần rồi làm mất nhắc. Giờ job deliver trả lần nhắc về DB (kết quả `released`), và lần quét đầu tiên sau khi đăng nhập lại sẽ gửi tiếp.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/api`: pass
- `npm run lint --workspace @zalobot/api`: pass
- `npm run test --workspace @zalobot/api`: pass (thêm các test mới cho scheduler và `reminder-job`)
- `npm run build --workspace @zalobot/api`: pass
- Smoke test BullMQ trên một Redis tạm (container `redis:7-alpine`, cổng 6390, đã xoá sau khi chạy). Kết quả:
  - upsert scheduler 2 lần vẫn chỉ có 1 scheduler;
  - scan chạy ngay khi khởi động;
  - jobId hợp lệ, job thêm trùng bị bỏ qua;
  - retry chạy đúng, gửi thành công ở lần thử thứ 3, job được dọn sau khi xong.
- `node .claude/hooks/docs-drift-check.mjs`: PASS
- **Chưa thử** trên môi trường có ZCA thật. Không chạy cả API ở local để tránh đá phiên ZCA của prod.

## Rủi ro còn lại

- Redis là phụ thuộc bắt buộc của luồng nhắc. Redis chết thì nhắc bị trễ, không mất.
- Gửi theo kiểu at-least-once: khi retry có thể gửi trùng.
- Hết 5 lượt retry mà ZCA vẫn đang kết nối thì lần nhắc đó bị bỏ. Job lỗi được giữ 7 ngày để tra.

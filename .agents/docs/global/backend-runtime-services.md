---
metadata:
  agent-artifact:
    id: docs-global-backend-runtime-services
    type: documentation
    depends_on:
      - .agents/knowledge/global/backend-runtime-services.md
      - apps/api/src/health/health.controller.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/reminders/reminder-scheduler.service.ts
      - apps/api/src/reminders/reminder.processor.ts
      - apps/api/src/tasks/task-reminder.processor.ts
      - apps/api/src/queue/queue.module.ts
      - apps/api/src/queue/reminder-job.ts
---

# Dịch vụ nền của Backend

Tài liệu này ánh xạ với tri thức canonical [`backend-runtime-services.md`](../../knowledge/global/backend-runtime-services.md). Đây là các dịch vụ dùng chung trong `apps/api/src`, không thuộc một tính năng CRUD cụ thể nào.

## 1. Health check (`health/`)

**Mục đích:** cho hạ tầng (Coolify, Docker healthcheck, load balancer) kiểm tra API còn sống.

- `GET /health` trả `{ status: 'ok', timestamp }`, công khai, không có tiền tố `/api`.
- **Không còn thông báo deploy.** Trước đây có webhook `/health/deploy`, `/deploy/notify`, `/deploy/ping` (bảo vệ bằng `DEPLOY_NOTIFY_TOKEN`) và bot tự nhắn admin mỗi lần API khởi động (`NOTIFY_ON_STARTUP`). Cả hai đã bị bỏ: các route deploy giờ trả 404, hai biến môi trường trên không còn được đọc. Nếu Coolify/CI còn cấu hình gọi URL deploy thì gỡ đi.

## 2. Redis (`redis/`)

**Mục đích:** lưu trạng thái ngắn hạn (thẻ xác nhận chờ, phiên ZCA, cache whitelist) để không mất khi có nhiều tiến trình hoặc khởi động lại.

- Kết nối qua `REDIS_URL` (mặc định `redis://localhost:6379`).
- **Thiết kế "lỗi mềm":** nếu Redis không kết nối được, mọi thao tác trả về rỗng/false và chỉ ghi cảnh báo; bot vẫn chạy với bộ nhớ trong tiến trình. Vì vậy mất Redis không làm sập bot, nhưng thẻ chờ sẽ mất khi khởi động lại.
- Cache whitelist: `whitelist:user:<id>` — được phép lưu 24 giờ, bị từ chối lưu 10 phút để thay đổi quyền có hiệu lực nhanh.

## 3. OCR (`ocr/`)

`OcrService` đọc chữ trên ảnh hoá đơn **ngay trên máy chủ** bằng Tesseract (ngôn ngữ `vie` + `eng`), sau khi dùng `sharp` xoay đúng chiều, chuyển xám và tăng tương phản. Lỗi trả về chuỗi rỗng. Chỉ phần chữ trích xuất mới được gửi cho LLM, ảnh gốc thì không — phù hợp nguyên tắc ưu tiên xử lý cục bộ.

## 4. Lưu trữ media lên Google (`receipt-storage/`)

`MediaStorageService` đưa ảnh, video, tệp người dùng gửi lên Google Drive và Google Photos.

- **Phân vùng theo kênh:** mỗi cuộc trò chuyện có thư mục riêng `zalobot/<channelId>/<loại>` với loại là `bill`, `image`, `video`, `file`, `audio`; bên trong chia tiếp theo tháng `YYYY-MM`. Nhờ vậy dữ liệu các nhóm không lẫn vào nhau và có thể chia sẻ riêng từng nhóm.
- Hoá đơn, ảnh, video được tải song song lên Drive và Photos (album mặc định `ZaloBot - Hóa đơn`, `ZaloBot - Hình ảnh`, `ZaloBot - Video`). Một bên lỗi không ảnh hưởng bên còn lại. Tệp tài liệu chỉ lên Drive.
- Dùng tài khoản Google của chính người dùng nếu đã liên kết, nếu không dùng tài khoản Google dùng chung của admin. Khi thiếu quyền, tin nhắn tóm tắt nhắc admin gõ `/login`.

## 5. Link Drive/Photos (`google/google-resources.controller.ts`)

| Route | Ý nghĩa |
| --- | --- |
| `POST /api/drive/share` | Chia sẻ thư mục `zalobot/<channelId>` cho một email (`reader` mặc định) và lưu thông tin thư mục vào cấu hình kênh |
| `GET /api/drive/folder-link` | Trả link thư mục Drive của kênh (ưu tiên link đã cache) |
| `GET /api/drive/open` | Chuyển hướng thẳng tới thư mục Drive |
| `GET /api/photos/album-link` | Trả link album Photos của kênh (mặc định `ZaloBot - Hình ảnh`, theo kênh là `[Zalo] <tên nhóm>`) |
| `GET /api/photos/open` | Chuyển hướng thẳng tới album |

**Phân quyền:** cả năm route **chỉ dành cho admin dashboard** (401 khi thiếu hoặc sai token, 403 khi không phải admin).
- `drive/share`, `drive/folder-link`, `photos/album-link` cần Bearer access token.
- `drive/open`, `photos/open` được mở bằng `<a href>` nên chấp nhận thêm cookie `reports_refresh`.

Lý do: hệ thống không kiểm tra người gọi có thuộc kênh hay không. Ngoài ra, `folder-link`/`open` còn tự tạo thư mục Drive. Nếu để mở, người ngoài có thể chia sẻ thư mục của nhóm khác cho email bất kỳ, hoặc tạo thư mục rác trên Drive của bot. Lệnh chat `@bot share <email>` không bị ảnh hưởng vì gọi thẳng service Drive, không đi qua HTTP.

## 6. Job nền bằng BullMQ (`queue/`)

**Mục đích:** chạy các tác vụ định kỳ (hiện là nhắc việc và lời nhắc) qua hàng đợi BullMQ trên Redis, thay cho cron `@nestjs/schedule` trước đây. Lý do đổi: lần gửi thất bại giờ được thử lại thay vì mất luôn, và dù chạy nhiều instance thì lịch quét vẫn chỉ có một.

- `QueueModule` kết nối Redis theo `REDIS_URL` (mặc định `redis://localhost:6379`), mọi key có tiền tố `zalobot`. Không cần biến môi trường mới.
- Mỗi tính năng có một queue riêng: `task-reminders` (nhắc việc) và `reminders` (lời nhắc). Mỗi queue có hai job:
  - **`scan`**: chạy 30 giây một lần bằng Job Scheduler của BullMQ. Job này đọc các lần nhắc đến hạn trong Postgres, giành quyền gửi (như trước), rồi đẩy một job `deliver` cho mỗi lần.
  - **`deliver`**: gửi tin. Mỗi lần gửi (một giờ nhắc, hoặc một lần nhắc lại của giờ đó) là một job riêng. Gửi lỗi thì BullMQ tự thử lại tối đa 5 lần, giãn cách tăng dần từ 30 giây (tổng khoảng 7,5 phút). Hết lượt thì ghi log lỗi, job lỗi được giữ 7 ngày để tra.
- Mỗi worker xử lý một job một lúc (`concurrency: 1`), nên tin gửi đi đúng thứ tự và không dồn sang Zalo.
- **Postgres vẫn là nguồn sự thật**: trạng thái lần nhắc nằm trong DB, Redis chỉ giữ việc đang chờ gửi. Vì vậy khi chuyển sang BullMQ không cần migration.
- **Redis bắt buộc cho luồng nhắc.** Redis chết thì API vẫn khởi động và chạy, nhưng không có lần quét nào; nhắc sẽ đi trễ khi Redis lên lại chứ không mất. Lỗi kết nối chỉ được ghi log tối đa một lần mỗi phút.
- Retry có thể làm gửi trùng (Zalo đã nhận tin nhưng báo lỗi): hệ thống chọn "gửi ít nhất một lần" thay vì mất nhắc âm thầm.

**Kiểm tra trên server:** trong Redis có các key `zalobot:task-reminders:*` và `zalobot:reminders:*`; job lỗi nằm ở tập `failed` của từng queue.

## 7. Nhật ký kiểm toán (`audit/`)

- `AuditLogSubscriber` tự ghi bảng `audit_logs` sau mỗi lần thêm/sửa/xoá entity qua TypeORM: tên bảng, ID bản ghi, hành động, người thực hiện (`userId` của bản ghi), dữ liệu trước/sau. Trường có tên chứa `token`, `secret`, `password`, `authorization` được che thành `[REDACTED]`.
- Chỉ các thao tác `save`/`remove` theo entity được ghi; câu lệnh xoá/cập nhật hàng loạt (`delete()`, query builder) không được ghi.
- Dashboard (`GET /api/dashboard`) hiển thị 10 hoạt động gần nhất của người dùng.

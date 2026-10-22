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

## 6. Bộ lập lịch nhắc nhở (`reminders/reminder-scheduler.service.ts`)

- Chạy mỗi **30 giây**. Lấy mọi lời nhắc đã đến giờ và chưa kích hoạt, gửi tin qua Zalo cho chủ lời nhắc.
- Lời nhắc lặp `daily` dời sang hôm sau, `weekly` dời 7 ngày; lời nhắc một lần được đánh dấu `completed`.
- Một lần chạy lỗi chỉ ghi log; lần chạy kế tiếp sẽ thử lại các lời nhắc chưa được đánh dấu.

## 7. Nhật ký kiểm toán (`audit/`)

- `AuditLogSubscriber` tự ghi bảng `audit_logs` sau mỗi lần thêm/sửa/xoá entity qua TypeORM: tên bảng, ID bản ghi, hành động, người thực hiện (`userId` của bản ghi), dữ liệu trước/sau. Trường có tên chứa `token`, `secret`, `password`, `authorization` được che thành `[REDACTED]`.
- Chỉ các thao tác `save`/`remove` theo entity được ghi; câu lệnh xoá/cập nhật hàng loạt (`delete()`, query builder) không được ghi.
- Dashboard (`GET /api/dashboard`) hiển thị 10 hoạt động gần nhất của người dùng.

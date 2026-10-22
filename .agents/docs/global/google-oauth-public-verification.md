---
metadata:
  agent-artifact:
    id: docs-global-google-oauth-public-verification
    type: documentation
    depends_on:
      - .agents/knowledge/global/google-oauth-public-verification.md
      - apps/api/src/google/google-auth.service.ts
      - apps/web/app/privacy/page.tsx
---

# Công khai web và xác minh Google OAuth

Tài liệu canonical tương ứng: [`google-oauth-public-verification.md`](../../knowledge/global/google-oauth-public-verification.md).

Zalobot công khai các trang phục vụ Google review:

- `/about`: giới thiệu sản phẩm.
- `/privacy`: chính sách quyền riêng tư và cam kết Google API Services User Data Policy / Limited Use.
- `/terms`: điều khoản sử dụng.

## Scope đang yêu cầu và lý do nghiệp vụ

Danh sách nằm trong `GOOGLE_SCOPES` (`apps/api/src/google/google-auth.service.ts`):

| Scope | Dùng cho |
| --- | --- |
| `openid`, `userinfo.email`, `userinfo.profile` | Nhận diện tài khoản Google đã kết nối |
| `calendar` | Tạo/đọc/xóa sự kiện theo lệnh người dùng |
| `tasks` | Tạo/xem/hoàn thành việc cần làm |
| `drive.file` | Tạo thư mục lưu trữ theo kênh `zalobot/<channelId>/<loại>` và chia sẻ thư mục (`@bot share <email>`) |
| `photoslibrary.appendonly` | Tạo album và tải ảnh/video/hóa đơn lên Google Photos |

Nguyên tắc: mỗi scope phải gắn với một tính năng thật đang chạy. Không thêm Gmail, Sheets, Docs hoặc Contacts chỉ để dành cho tương lai. Khi cần scope mới, phải cập nhật tính năng, trang privacy, tài liệu này và nộp lại cho Google trước khi phát hành.

**Việc còn thiếu**: trang `/privacy` hiện chỉ liệt kê quyền hồ sơ, Calendar và Tasks (các key `public.privacy.profileScope`, `calendarScope`, `tasksScope`). Cần bổ sung mô tả Drive và Photos trước khi nộp xác minh.

## Checklist phát hành

1. Triển khai domain HTTPS production và bảo đảm `/about`, `/privacy`, `/terms` truy cập công khai được.
2. Trong Google Cloud Console, khai báo homepage, privacy policy, terms trỏ về ba trang trên của domain production.
3. Xác minh ownership domain trong Google Search Console.
4. Khai báo Authorized redirect URI đúng tuyệt đối `APP_URL + /api/oauth2callback`. Nginx chuyển `/api/*` sang NestJS, nơi `GoogleAuthController` xử lý callback.
5. Bật Google Calendar API, Google Drive API và Google Photos Library API (không còn dùng Google Tasks API); kiểm tra Data Access chỉ hiển thị các scope đang sử dụng.
6. Trong Verification Center, giải thích từng scope theo bảng trên và đính kèm video: người dùng mở Zalo, gõ `/login`, cấp quyền, tạo/đọc Calendar hoặc Tasks, lưu ảnh lên Drive/Photos, và nêu cách gửi yêu cầu xóa dữ liệu.
7. Người dùng đã kết nối trước khi có scope Drive/Photos phải gõ `/login` để kết nối lại; các tính năng lưu trữ kiểm tra `hasStorageScopes()` và sẽ nhắc kết nối lại nếu thiếu.

## Xóa dữ liệu

Người dùng gửi yêu cầu thu hồi OAuth và xóa token/dữ liệu liên quan đến `datdoan.dev@gmail.com` (key `public.supportEmail`). Không hứa hẹn tự xóa trong UI khi chưa có luồng self-service tương ứng.

---
metadata:
  agent-artifact:
    id: docs-global-google-oauth-public-verification
    type: documentation
    depends_on:
      - .agents/knowledge/global/google-oauth-public-verification.md
---

# Công khai web và xác minh Google OAuth

zalobot công khai các trang phục vụ Google review tại:

- `/about`: giới thiệu sản phẩm.
- `/privacy`: chính sách quyền riêng tư và cam kết Google API Services User Data Policy / Limited Use.
- `/terms`: điều khoản sử dụng.

## Scope được phép yêu cầu

OAuth chỉ yêu cầu thông tin định danh cơ bản, Google Calendar và Google Tasks. Không thêm Gmail, Drive, Sheets, Docs hoặc Contacts chỉ để dành cho tính năng tương lai. Nếu phát triển một tính năng mới cần scope khác, phải cập nhật tính năng thực tế, chính sách quyền riêng tư, tài liệu này và nộp lại scope đó cho Google trước khi phát hành.

## Checklist phát hành

1. Triển khai domain HTTPS production và bảo đảm `/about`, `/privacy`, `/terms` truy cập công khai được.
2. Trong Google Cloud Console, khai báo homepage là `https://zalobot.datintech.site/about`, privacy policy là `https://zalobot.datintech.site/privacy`, terms là `https://zalobot.datintech.site/terms`.
3. Xác minh ownership domain trong Google Search Console.
4. Khai báo Authorized redirect URI đúng tuyệt đối: `APP_URL + /api/oauth2callback`. Với cấu hình Nginx hiện tại, endpoint này được chuyển tiếp vào NestJS.
5. Bật Google Calendar API và Google Tasks API; kiểm tra Data Access chỉ hiển thị các scope đang sử dụng.
6. Trong Verification Center, giải thích từng scope theo chức năng tương ứng và đính kèm video: người dùng mở zalo, chọn kết nối Google, cấp quyền, tạo/đọc Calendar hoặc Tasks, và nêu cách gửi yêu cầu xóa dữ liệu.
7. Sau khi Google duyệt, yêu cầu người dùng cũ kết nối lại nếu cần token chỉ chứa scope mới.

## Xóa dữ liệu

Người dùng gửi yêu cầu thu hồi OAuth và xóa token/dữ liệu liên quan đến `datdoan.dev@gmail.com`. Không được hứa hẹn tự xóa ngay trong UI khi hệ thống chưa có luồng self-service tương ứng.

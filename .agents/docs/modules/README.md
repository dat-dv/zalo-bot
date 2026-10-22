---
metadata:
  agent-artifact:
    id: docs-modules
    type: documentation
    depends_on:
      - .agents/knowledge/modules/README.md
---

# Feature Modules Operational Guides

This directory contains developer & operating guides organized by feature modules, mirroring [`.agents/knowledge/modules/`](../../knowledge/modules/README.md). Mỗi thư mục ứng với một module web `apps/web/src/modules/<name>/`; nghiệp vụ thu chi backend (`apps/api/src/finance`) nằm ở [`global/finance-domain.md`](../global/finance-domain.md).

## Danh Mục Modules
- [Xác thực](auth/README.md): Lưu và quản lý phiên truy cập dashboard.
- [Lịch biểu](calendar/README.md): Quản lý, cập nhật và xóa sự kiện lịch Google Calendar.
- [Danh bạ](contacts/README.md): Tải và hiển thị danh bạ công nợ.
- [Công nợ](debts/README.md): Theo dõi các khoản cần thu và cần trả đang mở.
- [Dashboard](dashboard/README.md): Tổng quan, thống kê và các bảng dữ liệu cá nhân.
- [Khoản chi](expenses/README.md): Hiển thị lịch sử các giao dịch chi.
- [Lời nhắc](reminders/README.md): Quản lý lời nhắc hẹn giờ và cập nhật trạng thái.
- [Cài đặt](settings/README.md): Quản lý danh mục thu chi và cấu hình hệ thống cá nhân.
- [Công việc](tasks/README.md): Danh sách việc cần làm dùng chung, chỉ lưu trong zalobot.
- [Người dùng](users/README.md): Quản lý danh sách người dùng, vai trò Admin/User và phân quyền truy cập bot.
- [Tài khoản ZCA](zca/README.md): Kết nối tài khoản Zalo cá nhân, cấu hình tương tác kênh và sao lưu Google Drive.



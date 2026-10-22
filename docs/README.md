# 📚 Zalo Bot Developer Documentation Hub

Chào mừng bạn đến với trung tâm tài liệu phát triển của dự án **NestJS Zalo AI Assistant**.

Hệ thống tài liệu được thiết kế theo dạng module độc lập (Modular Documentation) nhằm giúp lập trình viên và AI nắm bắt nhanh kiến trúc, quy chuẩn phát triển, cách thêm công cụ AI mới và quy trình vận hành hệ thống.

---

## 🗺️ Bản Đồ Tài Liệu (Documentation Map)

```text
docs/
├── README.md                 # [Bản đồ tài liệu] - Mục lục & Lộ trình tìm hiểu
├── quick-setup-runbook.md    # [⚡ Checklist 3 Phút] - Hướng dẫn triển khai lại từ A-Z không cần mò mẫm
├── architecture.md           # [Kiến trúc] - Sơ đồ hệ thống, PostgreSQL Database & nguyên lý thiết kế
├── google-integration.md     # [Google Workspace] - Full Scopes, OAuth2, Calendar, Tasks & lưu Token PostgreSQL
├── zalo-bot.md               # [Zalo Bot] - ZCA Module, QR login, đăng nhập Dashboard, Slash Commands & AI Calling
├── deployment.md             # [DevOps & Deploy] - Zero-File-Mount, Docker, Coolify CI/CD, PM2 & Secrets
└── development-workflow.md   # [Quy chuẩn code] - TypeScript, ESLint/Prettier, Testing & Git
```

---

## 📑 Hướng Dẫn Nhanh Theo Nhu Cầu

| Bạn muốn... | Tài liệu cần đọc | Nội dung chính |
| :--- | :--- | :--- |
| **⚡ Triển khai nhanh lại từ đầu trong 3 phút** | [quick-setup-runbook.md](quick-setup-runbook.md) | Checklist các bước, cấu hình biến môi trường, Deploy Coolify. |
| **Hiểu tổng quan kiến trúc & PostgreSQL** | [architecture.md](architecture.md) | Sơ đồ tuần tự, PostgreSQL, cô lập Token đa người dùng. |
| **Tích hợp thêm API Google (Gmail, Drive...)** | [google-integration.md](google-integration.md) | Trọn bộ Scopes Google Workspace đã cấp quyền, quản lý Token trong PostgreSQL, Calendar / Tasks API. |
| **Thêm Slash Command hoặc tùy biến giao diện Bot** | [zalo-bot.md](zalo-bot.md) | Chạy bot qua ZCA (QR trên `/zca`), xử lý tin nhắn và lệnh, đăng nhập dashboard bằng `/dashboard` hoặc `DASHBOARD_LOGIN_CODE`. |
| **Deploy lên VPS hoặc cấu hình Docker / Coolify** | [deployment.md](deployment.md) | Mô hình Zero-File-Mount trên Coolify (chỉ cần 1 volume `/app/data`), chạy Docker, PM2. |
| **Bắt đầu đóng góp code / Kiểm thử** | [development-workflow.md](development-workflow.md) | Coding conventions, TypeScript types, Husky pre-commit, kiểm thử lint/build. |

---

## ⚡ Lộ Trình Cho Developer Mới (Quick Onboarding)

1. **Bước 1**: Đọc [Cẩm nang 3 phút](quick-setup-runbook.md) để nắm nhanh các bước chuẩn bị và chạy bot ngay.
2. **Bước 2**: Đọc [Kiến trúc hệ thống](architecture.md) để hiểu sâu hơn về các tầng module.

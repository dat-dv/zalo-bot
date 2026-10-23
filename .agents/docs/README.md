---
metadata:
  agent-artifact:
    id: docs-index
    type: documentation
    depends_on:
      - .agents/knowledge/README.md
      - .agents/knowledge/project-overview.md
      - .agents/knowledge/global/README.md
      - .agents/knowledge/modules/README.md
---

# Hướng Dẫn Vận Hành & Bảo Trì Dành Cho Lập Trình Viên (Human Developer Guides)

Thư mục này chứa toàn bộ tài liệu hướng dẫn dành cho lập trình viên con người. Để giúp đội ngũ phát triển dễ đọc và vận hành nhất, TẤT CẢ tài liệu dưới `.agents/docs/` được viết bằng **Tiếng Việt** và ánh xạ 1-1 với thư mục module web trong mã nguồn (`apps/web/src/modules/<module-name>/`); các khu vực backend (`apps/api/src/<area>`) được mô tả trong `global/` hoặc trong module mà chúng phục vụ.

## Cấu Trúc Ánh Xạ Thư Mục

| Phạm vi               | Tài liệu Hướng dẫn (`.agents/docs/` - Tiếng Việt) | Tri thức AI Agent (`.agents/knowledge/` - English)             | Mô tả nội dung                                                                                                                |
| --------------------- | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Tổng quan dự án**   | [`README.md`](README.md)                          | [`project-overview.md`](../knowledge/project-overview.md)      | Tổng quan mục tiêu, phạm vi ứng dụng và định hướng kinh doanh                                                                 |
| **Quy định Hệ thống** | `global/README.md`                                | [`global/README.md`](../knowledge/global/README.md)            | Quy định chung, kiến trúc tổng thể và hạ tầng hệ thống                                                                        |
| **Feature Modules**   | `modules/<module>/README.md`                      | [`modules/<module>/README.md`](../knowledge/modules/README.md) | Ánh xạ trực tiếp mã nguồn (`apps/web/src/modules/auth/` -> `modules/auth/`): Hướng dẫn sử dụng, các bước chạy test, và khắc phục sự cố |

## Quy Chuẩn Viết Tài Liệu Dành Cho Lập Trình Viên

1. **Ngôn ngữ**: Viết bằng **Tiếng Việt** dễ hiểu, rõ ràng.
2. **Ánh xạ Tên Module Trực Tiếp**: Tên thư mục dưới `.agents/docs/modules/<module-name>/` phải trùng khớp 100% với tên module trong mã nguồn. Không tự đặt tên khác.
3. **Nội dung bắt buộc trong Module Doc**:
   - **Tổng quan & Cách dùng**: Giải thích ngắn gọn mục đích sử dụng module cho lập trình viên mới (onboarding).
   - **Quy trình Chạy & Kiểm thử**: Các lệnh chạy thử, test cases chính cần chú ý.
   - **Xử lý Sự cố (Troubleshooting)**: Các lỗi thường gặp và cách khắc phục nhanh.
4. **Cấu hình môi trường & UX dashboard**: Hợp đồng ENV fail-fast được duy trì trong `global/environment-guard.md`, còn quy tắc URL dashboard trong `global/monorepo-architecture.md`; riêng UX, trạng thái, giao diện sáng/tối và cấu hình API của dashboard nằm ở `modules/dashboard/README.md`, bao gồm quy ước không hiển thị nhãn trạng thái kết nối Google cố định.
5. **Hard Completion Gate**: Một nhiệm vụ `implement` chỉ hoàn thành khi đã cập nhật song song cả **Tri thức AI Agent (`.agents/knowledge/`)** và **Hướng dẫn Lập trình viên (`.agents/docs/`)**.
6. **CRUD backend**: Danh sách endpoint nằm ở `global/backend-crud-api.md`, nghiệp vụ thu chi ở `global/finance-domain.md`, reminders/users/zca ở `modules/<module>/README.md`; mọi endpoint ghi dữ liệu phải dùng dashboard access token và kiểm tra phân quyền tương ứng. Dữ liệu tài chính là một kho chung (không lọc theo người dùng), xem `global/finance-domain.md` mục 1a.
7. **Đa ngôn ngữ**: Chuẩn locale dùng chung, cách lưu ngôn ngữ người dùng và cookie dashboard nằm ở `global/i18n.md`.
8. **Google OAuth public**: Scope được xin phải đúng tính năng đã phát hành; các URL `/about`, `/privacy` và `/terms` cùng checklist Google review nằm ở `global/google-oauth-public-verification.md`.
9. **Bảng dữ liệu dùng chung**: Quy ước cột `STT` và `ID` bắt buộc, cấu hình ẩn/hiện cột và đổi độ rộng nằm ở `global/web-ui-direction.md`; file này cũng mô tả state giao diện dùng chung (theme, ẩn/hiện số tiền) đặt trong store Zustand ở `apps/web/src/shared/store/`.
10. **Dữ liệu nơi chốn thu chi**: Hợp đồng tạo/sửa/xóa nơi chốn riêng, liên kết `placeId` của phát sinh và cách vận hành dashboard nằm ở `global/finance-domain.md` và `modules/dashboard/README.md`.
11. **Ảnh bill & media**: Luồng OCR local (Tesseract) và gửi văn bản cho `LlmService` nằm ở `global/receipt-image-analysis.md`; lưu media lên Google Drive/Photos theo phân vùng kênh nằm ở `global/backend-runtime-services.md`.
12. **LLM**: Cách chọn provider (Gemini/OpenAI/Qwen) và danh sách tool Zalo nằm ở `global/llm-providers.md`.
13. **PWA (cài app trên điện thoại)**: Manifest, service worker, cập nhật phiên bản và trang offline nằm ở `global/pwa.md`; đăng nhập bằng mã trong app đã cài nằm ở `global/dashboard-session.md` và `modules/auth/README.md`.
13. **Trí nhớ hội thoại**: Lưu tin của kênh ZCA đang listen, tìm lại chuyện cũ theo kênh và cửa sổ ngữ cảnh ngắn hạn nằm ở `modules/zca/chat-memory.md` (tri thức: `knowledge/modules/zca/chat-memory.md`).
14. **Quyền tương tác theo kênh**: Cấp quyền gọi bot trong riêng một nhóm ZCA (mọi thành viên hoặc thành viên được chọn), cộng thêm vào quyền toàn cục, strategy theo loại kênh và danh sách thành viên trên trang cấu hình kênh nằm ở `modules/zca/member-access.md` (tri thức: `knowledge/modules/zca/member-access.md`).
15. **Lưu trữ media theo kênh**: Tài khoản Google dùng chung cố định, mỗi kênh một thư mục Drive gốc và một album Photos cho mỗi tài khoản, lịch sử link khi đổi tài khoản và hộp thoại danh sách link trên `/zca` nằm ở `modules/zca/channel-storage.md` (tri thức: `knowledge/modules/zca/channel-storage.md`).
16. **Cache danh bạ Zalo**: Danh bạ nhóm/bạn bè ZCA lưu ở Redis `zca:directory:<ownId>` 7 ngày, quá hạn vẫn trả bản cũ rồi làm mới ngầm, chỉ nút Làm mới/Đồng bộ mới gọi Zalo, nằm ở `modules/zca/directory-cache.md` (tri thức: `knowledge/modules/zca/directory-cache.md`).
17. **Lịch chung**: Sự kiện lịch lưu trong bảng `calendar_events` (đổi tài khoản Google không mất lịch), Google Calendar chỉ giữ bản sao, cách nhập từ Google, đồng bộ lại và giao diện trang Lịch nằm ở `modules/calendar/README.md` (tri thức: `knowledge/modules/calendar/README.md`).
18. **Việc cần làm dùng chung**: Task chỉ lưu trong bảng `tasks` của zalobot (không đồng bộ Google Tasks), lý do bỏ đồng bộ, **nhắc việc** (giờ nhắc + đích nhắc) và trang `/tasks` nằm ở `modules/tasks/README.md`; lệnh chat ở `global/google-tasks.md` (tri thức: `knowledge/modules/tasks/README.md`). **Đích nhắc** dùng chung cho nhắc việc và lời nhắc (kênh, người được nhắc, tag trong nhóm hay nhắn riêng) nằm ở `modules/reminders/README.md` mục 2.
19. **Nhật ký hoạt động**: Cách ghi đúng người thực hiện (dashboard, người nhắn Zalo, người yêu cầu thao tác chờ duyệt, hệ thống), dữ liệu cũ, API `GET /api/audit-logs` và trang `/activity` chỉ dành cho admin nằm ở `modules/audit/README.md` (tri thức: `knowledge/modules/audit/README.md`).

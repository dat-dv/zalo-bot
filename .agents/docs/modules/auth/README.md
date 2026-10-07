---
metadata:
  agent-artifact:
    id: docs-module-auth
    type: documentation
    depends_on:
      - .agents/knowledge/modules/auth/README.md
---

# Module xác thực dashboard

`apps/web/src/modules/auth` quản lý access token ngắn hạn của dashboard sau khi người dùng mở link từ zalo.

- `captureDashboardToken` đọc `dashboard_token` trong URL fragment, lưu vào localStorage rồi xóa fragment khỏi thanh địa chỉ.
- `clearAccessToken` được gọi khi đăng xuất hoặc khi refresh phiên thất bại.
- `SessionStateScreen` (`apps/web/src/modules/auth/presentation/components/session-state-screen.tsx`, re-exported qua `view/session-state-screen.tsx`): Hiển thị trạng thái phiên kết thúc sau khi đăng xuất (`status=logged_out`) hoặc khi hết hạn phiên (`401 Unauthorized`). Hỗ trợ nút mở zalo Bot, nút Xóa phiên & Thử lại, nút Đóng cửa sổ zalo Mini App và link về trang Giới thiệu.
- `handleLogout` trong `WorkspaceHeader`: Gọi `POST /api/logout`, xóa token, xóa cache query và chuyển hướng về `/?status=logged_out`.
- Không để view dashboard tự đọc/ghi token; HTTP client dùng module này để gắn Authorization header.

Khi lỗi 401, kiểm tra endpoint refresh phiên và luồng mở link từ zalo trước khi kiểm tra UI.

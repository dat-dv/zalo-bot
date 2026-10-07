# 💬 Giao Diện zalo Bot & Hệ Thống Đa Người Dùng (Multi-User & UX)

Tài liệu này giải thích chi tiết tầng giao tiếp zalo (`zaloModule`, `zaloUpdate`), hệ thống xác thực mời người dùng qua Deep Link, các Slash Commands tiện ích, chống spam và tối ưu trải nghiệm (UX).

---

## 1. Tầng zalo Bot (`zaloModule`)

Dự án sử dụng thư viện `nestjs-zalograf` kết hợp với `UsersModule` (PostgreSQL) và `GoogleModule` để cung cấp môi trường trợ lý đa người dùng độc lập:

- Module: `src/zalo/zalo.module.ts`
- Handler & Controller: `src/zalo/zalo.update.ts`
- Guard: `src/zalo/guards/auth.guard.ts`

---

## 2. Quy Trình Mời Người Dùng & Kích Hoạt (Deep Link Invitation)

Để cho phép bạn bè/người thân sử dụng bot mà không cần sửa file `.env` hay restart server:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản trị viên (Admin)
    actor User as Bạn bè (Khách mời)
    participant Bot as zalo Bot
    participant Store as UsersService (PostgreSQL)
    participant Auth as GoogleAuthService

    Admin->>Bot: /invite
    Bot->>Store: createInvite(adminId)
    Bot-->>Admin: Link mời: t.me/Bot?start=invite_xyz123 (Hạn 24h)
    Admin->>User: Gửi link qua Zalo/zalo
    User->>Bot: Bấm link và nhấn START
    Bot->>Store: consumeInvite(code, user)
    Bot->>Auth: generateAuthUrl(userId)
    Bot-->>User: Chào mừng + Nút "🔗 Đăng nhập Google"
    User->>Bot: /code <mã_xác_thực> (sau khi cấp quyền Gmail)
    Bot->>Auth: exchangeCodeForTokens(userId, code)
    Bot-->>User: 🎉 Kết nối thành công! Trợ lý cá nhân sẵn sàng.
```

---

## 3. Hệ Thống Slash Commands Đầy Đủ

### 👥 Dành Cho Mọi Người Dùng:

| Lệnh                   | Handler                       | Chức Năng                                                                                                      |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/start`               | `@Start()`                    | Khởi động bot, xử lý link kích hoạt mời (`/start invite_...`) hoặc kết nối Google tự động 1-click.             |
| `/login`, `/auth`      | `@Command('login')`           | Gửi link OAuth cá nhân kèm nút bấm Inline để đổi hoặc kết nối lại tài khoản Google.                            |
| `/status`              | `@Command('status')`          | Kiểm tra thông tin tài khoản, vai trò và tình trạng kết nối Google Workspace.                                  |
| `/today`               | `@Command('today')`           | Kích hoạt AI tổng hợp toàn bộ lịch hẹn & to-do trong ngày hôm nay của người gửi.                               |
| `/week`                | `@Command('week')`            | Kích hoạt AI tổng hợp lịch trình và việc cần làm 7 ngày tới của người gửi.                                     |
| `/calendar <nội dung>` | `@Command('calendar')`        | Lên lịch hẹn nhanh vào Calendar riêng của người gửi.                                                           |
| `/task <nội dung>`     | `@Command('task')`            | Tạo to-do nhanh vào Tasks riêng của người gửi.                                                                 |
| `/help`                | `@Help()`, `@Command('help')` | Xem hướng dẫn tương tác chi tiết và cùng menu inline với `/start`; nút **Xem báo cáo** mở Dashboard trực tiếp. |

### 👑 Dành Riêng Cho Quản Trị Viên (Admin):

| Lệnh             | Handler              | Chức Năng                                                                              |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `/invite`        | `@Command('invite')` | Sinh link mời 1 lần (dùng trong 24h) để gửi cho bạn bè/đồng nghiệp (hoặc nhắn cho AI). |
| `/users`         | `@Command('users')`  | Xem danh sách toàn bộ người dùng trong hệ thống và trạng thái kết nối Google.          |
| `/ban <zalo_id>` | `@Command('ban')`    | Thu hồi quyền sử dụng ngay lập tức và hủy toàn bộ Token Google của một zalo ID.        |

---

## 4. Bảo Vệ Truy Cập & Chống Spam (`AuthGuard`)

Tất cả tin nhắn gửi đến bot đều được kiểm soát bởi `AuthGuard`:

1. **Kiểm tra Whitelist**: Chỉ những ai đã nằm trong danh sách hoặc kích hoạt bằng link mời mới được phép nhắn tin.
2. **Chống Spam (Cooldown 2s)**: Ngăn chặn người dùng xả tin nhắn liên tục (dưới 2 giây).
3. **Callback an toàn**: Các nút làm thay đổi dữ liệu như hoàn thành task hoặc cập nhật/xóa nhắc việc chỉ tạo yêu cầu xác nhận. Thao tác chỉ được thực thi sau khi chính người dùng bấm nút xác nhận.

---

## 5. Tối Ưu Trải Nghiệm Người Dùng (UX)

### 1. Trạng thái "Đang soạn tin..." liên tục (`withTyping`)

zalo tự động tắt trạng thái `typing` sau 5 giây. Hàm `withTyping` tự động gửi action `typing` lặp lại mỗi **4 giây** bằng `setInterval` cho đến khi toàn bộ tác vụ của Gemini và Google hoàn tất.

### 2. Gửi phản hồi an toàn & Chia nhỏ tin nhắn (`sendSafeReply`)

- Tự động chia nhỏ tin nhắn dài vượt quá giới hạn 4000 ký tự của zalo.
- Chuẩn hóa Markdown do AI tạo trước khi gửi: giải mã HTML entity và bỏ escape thừa trong URL, nên chuỗi như không hiển thị nguyên văn trong chat.
- Tự động fallback về plain-text nếu cú pháp Markdown vẫn bị lỗi ký tự đặc biệt.

### 3. Voice-to-text cục bộ

Voice zalo được chuyển thành text bởi `whisper.cpp` trong container, không dùng API key. Bot luôn hiển thị transcript với nút **Xác nhận**, **Sửa bằng text** và **Hủy** trước khi gửi nội dung sang Gemini. Xem cấu hình và cách xử lý sự cố tại [hướng dẫn voice](../.agents/docs/global/voice-transcription.md).

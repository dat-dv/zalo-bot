# 📅 Tích Hợp Google Workspace & Quản Lý Token Trong PostgreSQL (OAuth2)

Tài liệu này mô tả cách xác thực Google OAuth 2.0 theo từng người dùng độc lập, các scope đang được dùng thực tế, cấu hình Client Credentials qua biến môi trường và lưu trữ Token trong **PostgreSQL** (`user_tokens`).

---

## 1. Vòng Đời Google OAuth 2.0 & Quản Lý Trong PostgreSQL

Hệ thống sử dụng cơ chế **Zero-File-Mount**:

```mermaid
graph TD
    A[Google Cloud Console] -->|Client ID & Secret| B[.env: GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET]

    subgraph Multi-Tenant Database Storage
        B -->|Đăng nhập qua /login & /code| DB[(PostgreSQL)]
        DB -->|Bảng user_tokens| T1[Token Admin]
        DB -->|Bảng user_tokens| T2[Token Bạn bè 1]
        DB -->|Bảng user_tokens| T3[Token Bạn bè 2]
    end

    DB -->|Khởi tạo OAuth2Client riêng cho từng userId| G[GoogleCalendarService / GoogleTasksService]
    G -->|Tự động cập nhật Token vào PostgreSQL khi refresh| H[Google Calendar & Tasks API]
```

### Các Biến Môi Trường Cấu Hình:

- `GOOGLE_CLIENT_ID`: Client ID lấy từ Google Cloud Console (OAuth Client ID - Desktop App).
- `GOOGLE_CLIENT_SECRET`: Client Secret tương ứng.

---

## 2. Quyền Google Workspace đang dùng

Hệ thống chỉ yêu cầu các quyền khớp với tính năng đã phát hành trong `src/google/google-auth.service.ts`:

```typescript
export const GOOGLE_SCOPES = [
  // 1. Thông tin cơ bản người dùng (User Profile & Email)
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',

  // 2. Google Calendar
  'https://www.googleapis.com/auth/calendar',

  // 3. Google Tasks
  'https://www.googleapis.com/auth/tasks',
];
```

> [!IMPORTANT]
> Không xin scope cho tính năng chưa có. Khi thêm Gmail, Drive, Sheets, Docs hoặc Contacts trong tương lai, phải triển khai tính năng tương ứng, cập nhật Privacy Policy và nộp scope mới cho Google trước khi public.

## 2.1 Chuẩn bị Google OAuth verification

Sau khi deploy HTTPS domain, dùng các URL public `/about`, `/privacy` và `/terms` trên domain đó để khai báo OAuth consent screen. Authorized redirect URI phải khớp chính xác với `${APP_URL}/api/oauth2callback`. Trong Google Cloud Console, chỉ bật Calendar API và Tasks API cho phạm vi hiện tại, xác minh domain, sau đó nộp Verification Center kèm video demo luồng kết nối và sử dụng Calendar/Tasks.

---

## 3. Luồng Đăng Nhập Cho Người Dùng Mới (`/login` & `/code`)

1. Người dùng gõ `/login` hoặc bấm nút **"🔗 Đăng nhập Google"** trên zalo (hoặc AI tự gọi tool `login_google`).
2. `GoogleAuthService.generateAuthUrl(userId)` sinh URL xác thực Google với tham số `state: userId`.
3. Người dùng đăng nhập Gmail (đã nằm trong danh sách **Test Users**) và bấm **Cho phép (Allow)**.
4. Trình duyệt hiển thị mã xác thực (Authorization Code).
5. Người dùng gửi mã cho bot:
   ```text
   /code 4/0AQ...
   ```
6. Bot tự động trao đổi mã lấy `access_token` & `refresh_token`, lưu an toàn vào bảng **`user_tokens`** trong PostgreSQL.

---

## 4. Dịch Vụ Google Calendar (`GoogleCalendarService`)

File vị trí: [`src/google/google-calendar.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/src/google/google-calendar.service.ts).

### Các Phương Thức Nhận `userId`:

- `listEvents(options, userId?)`: Liệt kê sự kiện trong Calendar của đúng người gửi.
- `createEvent(options, userId?)`: Tạo sự kiện mới kèm 4 mốc chuông `[60p, 30p, 10p, 0p]` vào đúng Calendar của người gửi.
- `deleteEvent(eventId, userId?)`: Xóa sự kiện.
- `getEvent(eventId, userId?)`: Lấy chi tiết sự kiện.

---

## 5. Dịch Vụ Google Tasks (`GoogleTasksService`)

File vị trí: [`src/google/google-tasks.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/src/google/google-tasks.service.ts).

### Các Phương Thức Nhận `userId`:

- `listTasks(options, userId?)`: Lấy danh sách việc cần làm từ `@default` tasklist của đúng người gửi.
- `createTask(options, userId?)`: Tạo to-do mới có deadline vào Tasks của đúng người gửi.
- `completeTask(taskId, taskListId?, userId?)`: Đánh dấu hoàn thành task.
- `deleteTask(taskId, taskListId?, userId?)`: Xóa task.

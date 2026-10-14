# 📅 Tích Hợp Google Workspace & Quản Lý Token Trong PostgreSQL (OAuth2)

Tài liệu này mô tả cách xác thực Google OAuth 2.0 theo từng người dùng độc lập, các scope đang được dùng thực tế, cấu hình Client Credentials qua biến môi trường và lưu trữ Token trong **PostgreSQL** (`user_tokens`).

---

## 1. Vòng Đời Google OAuth 2.0 & Quản Lý Trong PostgreSQL

Hệ thống sử dụng cơ chế **Zero-File-Mount**:

```mermaid
graph TD
    A[Google Cloud Console] -->|Client ID & Secret| B[.env: GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET]

    subgraph Multi-Tenant Database Storage
        B -->|Đăng nhập qua /login & OAuth Callback| DB[(PostgreSQL)]
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

## 3. Luồng Đăng Nhập Tài Khoản Google (`/login`)

1. Quản trị viên gõ `/login` hoặc bấm nút **"🔗 Đăng nhập Google"** trên Zalo (hoặc AI tự gọi tool `LOGIN_GOOGLE`).
2. `GoogleAuthService.generateAuthUrl(userId)` sinh URL xác thực Google với tham số `state: userId`.
3. Quản trị viên mở link, đăng nhập Gmail và bấm **Cho phép (Allow)** các quyền.
4. Trình duyệt tự động chuyển hướng về endpoint OAuth Callback của hệ thống (`/oauth2callback`).
5. Hệ thống tự động nhận Authorization Code, trao đổi lấy `access_token` & `refresh_token`, lưu an toàn vào PostgreSQL và gửi thông báo xác nhận thành công tới Zalo!

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

---

## 6. Lưu Trữ Google Drive & Google Photos Phân Vùng Theo Channel (`GoogleDriveService`)

Hệ thống phân tách không gian lưu trữ độc lập cho từng nhóm / người dùng (channel) trên Google Drive:

### 6.1 Cấu Trúc Thư Mục Chuẩn Hóa
Thư mục được quản lý tự động dựa trên **`channelId` nguyên bản** (ví dụ `g-123456789` hoặc `u-userId`), không ghép nối tên nhóm để đảm bảo đường dẫn bất biến ngay cả khi nhóm đổi tên trên Zalo:
- **Thư mục gốc của channel**: `zalobot/<channelId>`
- **Hóa đơn**: `zalobot/<channelId>/bill`
- **Hình ảnh**: `zalobot/<channelId>/image`
- **Video**: `zalobot/<channelId>/video`

### 6.2 Lưu Vết Thư Mục Trong PostgreSQL
Khi thư mục được tạo hoặc truy vấn, đường dẫn và Google Drive web link được lưu vết vào cơ sở dữ liệu để tra cứu và truy cập nhanh:
- **Nhóm ZCA**: Lưu vào bảng `zca_thread_configs` (`drive_folder_id`, `drive_folder_url`, `drive_folder_path`).
- **Người dùng cá nhân**: Lưu vào bảng `users` (`drive_folder_id`, `drive_folder_url`, `drive_folder_path`).

### 6.3 Lệnh Tra Cứu Kho Lưu Trữ Trên Zalo
- Gõ `@bot /drive` hoặc `@bot /kho` (hoặc `/storage`):
  - Bot sẽ phản hồi các đường link Drive của riêng channel đó.
  - Kèm hướng dẫn: Nếu chưa có quyền truy cập, thành viên chỉ cần nhắn `@bot share <gmail của bạn>` để được cấp quyền tự động.

### 6.4 Phân Quyền Truy Cập (Sharing)

#### 1. Lệnh chat trên Zalo:
```
@bot share user@gmail.com
```
Bot tự động gọi Google Drive API (`permissions.create`) để cấp quyền Reader trên thư mục `zalobot/<channelId>` của nhóm đó cho email được cung cấp.

#### 2. REST API:
- **Endpoint**: `POST /api/drive/share`
- **Body**:
  ```json
  {
    "channelId": "g-123456789",
    "email": "user@gmail.com",
    "role": "reader"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "folderPath": "zalobot/g-123456789",
    "email": "user@gmail.com",
    "role": "reader",
    "webViewLink": "https://drive.google.com/drive/folders/...",
    "permissionId": "..."
  }
  ```


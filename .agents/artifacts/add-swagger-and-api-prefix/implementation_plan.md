# Kế hoạch Tích hợp Swagger & Chuẩn hóa Tiền tố `/api/`

## 1. Mục tiêu & Bối cảnh

- **Swagger (OpenAPI UI)**: Tích hợp thư viện `@nestjs/swagger` và `swagger-ui-express` vào NestJS API, cung cấp giao diện tài liệu trực quan tại đường dẫn `/api/docs` (và `/docs`).
- **Chuẩn hóa Tiền tố `/api/` cho OAuth & Endpoints**:
  - Loại bỏ các ngoại lệ (exclude) trong `setGlobalPrefix('api')` để toàn bộ endpoint (bao gồm Google OAuth callback) đều đồng nhất có tiền tố `/api/` (khớp chính xác với cấu hình Google Cloud Console `http://localhost:3000/api/oauth2callback` và `https://zalobot.datintech.site/api/oauth2callback`).
  - Cập nhật `GoogleAuthService`, `main.ts`, `scripts/auth.ts`, `packages/contracts`, và tài liệu hướng dẫn liên quan.

---

## 2. Các thay đổi dự kiến

### Component: Backend Dependencies (`apps/api`)

#### [MODIFY] [package.json](file:///Users/datdoan/Documents/projects/zalobot/apps/api/package.json)

- Bổ sung các dependency:
  - `@nestjs/swagger`: `^7.4.2` (tương thích NestJS v10)
  - `swagger-ui-express`: `^5.0.1`
  - `@types/swagger-ui-express`: `^4.1.8` (devDependencies)

---

### Component: NestJS Bootstrap & Swagger Configuration (`apps/api/src/main.ts`)

#### [MODIFY] [main.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/main.ts)

- Bỏ cấu hình `exclude` trong `app.setGlobalPrefix('api')` để tất cả các route đều kế thừa tiền tố `/api/`.
- Cấu hình `DocumentBuilder` & `SwaggerModule`:
  - Tiêu đề: **zalobot Assistant API**
  - Mô tả: Hệ thống API và Webhook trợ lý cá nhân zalo kết hợp AI & Google Workspace.
  - Endpoint Swagger: `/api/docs`
  - Hỗ trợ Bearer Token Authentication cho các endpoint dashboard/private.
- Cập nhật thông báo log khởi động: `Public OAuth Callback URL: ${appUrl}/api/oauth2callback` và `Swagger Docs: ${appUrl}/api/docs`.

---

### Component: Google Auth Service & Callback Alignment

#### [MODIFY] [google-auth.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-auth.service.ts)

- Cập nhật hàm `getClientKeys()` để URL callback mặc định là:
  `${appUrl.replace(/\/+$/, '')}/api/oauth2callback`

#### [MODIFY] [scripts/auth.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/scripts/auth.ts)

- Cập nhật script auth độc lập sử dụng `http://localhost:3000/api/oauth2callback` và bắt route `/api/oauth2callback`.

---

### Component: Controller Swagger Annotations & Tags

#### [MODIFY] [google-auth.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-auth.controller.ts)

- Bổ sung `@ApiTags('Google Auth')` và `@ApiOperation()`.

#### [MODIFY] [finance.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)

- Bổ sung `@ApiTags('Finance & Transactions')`, `@ApiBearerAuth()`, và `@ApiOperation()`.

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Bổ sung `@ApiTags('Reports & Dashboard Access')`, `@ApiBearerAuth()`, và `@ApiOperation()`.

#### [MODIFY] [google-resources.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-resources.controller.ts)

- Bổ sung `@ApiTags('Google Workspace')`, `@ApiBearerAuth()`, và `@ApiOperation()`.

#### [MODIFY] [reminders.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reminders/reminders.controller.ts)

- Bổ sung `@ApiTags('Reminders')`, `@ApiBearerAuth()`, và `@ApiOperation()`.

#### [MODIFY] [users.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/users/users.controller.ts)

- Bổ sung `@ApiTags('Users & Invites')`, `@ApiBearerAuth()`, và `@ApiOperation()`.

---

### Component: Shared Contracts & Documentation

#### [MODIFY] [packages/contracts/src/index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung hằng `googleAuthCallback: '/api/oauth2callback'` vào `API_ROUTES`.

#### [MODIFY] Canonical Knowledge & Docs

- Cập nhật `.agents/knowledge/` và `.agents/docs/` liên quan đến endpoint Swagger và OAuth callback.

---

## 3. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### Automated Verification

- Chạy typecheck và lint toàn bộ monorepo:
  ```bash
  npm run typecheck
  npm run lint
  npm run build:api
  ```

### Manual Verification

- Khởi động backend API (`npm run dev:api`).
- Truy cập `http://localhost:3000/api/docs` để kiểm tra giao diện Swagger UI hiển thị đầy đủ các Tags, Controllers và Endpoints.
- Kiểm tra link đăng nhập Google OAuth sinh ra URL có `redirect_uri=http://localhost:3000/api/oauth2callback` (hoặc `https://zalobot.datintech.site/api/oauth2callback`), khớp 100% với Google Cloud Console.

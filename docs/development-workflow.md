# 🛠️ Quy Chuẩn Phát Triển & Kiểm Thử (Development Workflow)

Tài liệu này quy định các tiêu chuẩn về mã nguồn (Coding Standards), quy tắc đặt tên, cấu hình công cụ kiểm tra tự động (ESLint, Prettier, Husky) và chiến lược kiểm thử cho dự án **NestJS zalo AI Assistant**.

---

## 1. Quy Chuẩn Mã Nguồn (Coding Standards)

Dự án sử dụng **TypeScript** ở chế độ strict với kiến trúc chuẩn của **NestJS**.

### 1.1 Nguyên tắc thiết kế (Design Principles)

- **Single Responsibility Principle (SRP)**: Mỗi class, service hoặc tool chỉ làm một nhiệm vụ duy nhất.
- **Dependency Injection (DI)**: Luôn đưa các service phụ thuộc vào `constructor` thông qua NestJS DI Container, tránh `new` trực tiếp instance.
- **Strict Typing**: Tránh sử dụng `any`. Định nghĩa rõ interface đầu vào (`Args`) và đầu ra (`Result`) cho mọi phương thức và Tool.
- **Error Handling**: Không để throw uncaught exceptions làm crash bot. Luôn log lỗi bằng `Logger` của NestJS kèm stack trace và trả về fallback message thân thiện.

### 1.2 Quy tắc đặt tên file & thư mục

| Loại Thành Phần                | Quy Tắc Đặt Tên                    | Ví Dụ                                             |
| ------------------------------ | ---------------------------------- | ------------------------------------------------- |
| **Module**                   | `*.module.ts`                      | `google.module.ts`, `zalo.module.ts`        |
| **Service**                  | `*.service.ts`                     | `google-calendar.service.ts`, `users.service.ts` |
| **Zalo Controller / Service**| `*.controller.ts` / `*.service.ts` | `zalo.controller.ts`, `zalo.service.ts`     |
| **Guard**                    | `*.guard.ts`                       | `auth.guard.ts`                             |
| **Interface / Type**         | `*.interface.ts` hoặc `*.types.ts` | `zalo-webhook.dto.ts`                       |

---

## 2. Công Cụ Đảm Bảo Chất Lượng Code (ESLint, Prettier, Husky)

Dự án tích hợp sẵn hệ thống tự động định dạng và bắt lỗi cú pháp trước mỗi commit.

### 2.1 Các lệnh kiểm tra code

```bash
# 1. Kiểm tra linting toàn monorepo (không tự sửa file)
npm run lint

# 2. Kiểm tra format (không tự sửa file)
npm run format:check

# 3. Tự sửa format/lint khi cần
npm run format
npm run lint:fix

# 4. Kiểm tra type cho mọi workspace
npm run typecheck

# 5. Kiểm tra tính toàn vẹn của build
npm run build

# 6. Chạy toàn bộ unit test của API, bao gồm test trong các thư mục con
npm run test --workspace @zalobot/api

# Chạy riêng từng ứng dụng
npm run dev:api
npm run dev:web
```

### 2.2 Git Hooks với Husky & Lint-Staged

Hệ thống cấu hình **Husky (`.husky/pre-commit`)** và **lint-staged**:

- Mỗi khi bạn chạy `git commit`, Husky sẽ tự động kích hoạt `lint-staged`.
- Chỉ những file `.ts` đang staged mới được chạy `eslint --fix` và `prettier --write`.
- Nếu có lỗi cú pháp không thể tự sửa, commit sẽ bị hủy để bảo vệ chất lượng repo.

---

## 3. Quy Ước Commit (Conventional Commits)

Để lịch sử Git rõ ràng và hỗ trợ tạo Changelog tự động, mọi commit nên tuân theo định dạng:

```
<type>(<scope>): <mô tả ngắn gọn>
```

### Các tiền tố (`type`) thông dụng:

- `feat`: Tính năng mới (ví dụ: `feat(zalo): add new slash command`)
- `fix`: Sửa lỗi (ví dụ: `fix(calendar): fix timezone offset calculation`)
- `docs`: Cập nhật tài liệu (ví dụ: `docs: add deployment guide`)
- `refactor`: Tái cấu trúc mã nguồn mà không đổi logic (ví dụ: `refactor(zalo): optimize webhook payload handling`)
- `chore`: Cập nhật cấu hình build, dependencies (ví dụ: `chore: update googleapis version`)
- `test`: Thêm hoặc sửa test

---

## 4. Chiến Lược Kiểm Thử (Testing Strategies)

### 4.1 Kiểm thử đơn vị (Unit Tests)

Khi viết unit test cho các Service:

- Mock các module bên thứ ba (`googleapis`).
- Đảm bảo logic tính toán ngày tháng và format chuỗi hoạt động đúng theo các trường hợp biên.

Ví dụ mẫu mock `GoogleCalendarService`:

```typescript
const mockCalendarService = {
  createEvent: jest.fn().mockResolvedValue({ id: 'event-123', summary: 'Test Event' }),
  listEvents: jest.fn().mockResolvedValue([]),
};
```

---

## 5. Checklist Khi Đóng Góp Tính Năng Mới

Trước khi tạo Pull Request hoặc push code lên `main`:

- [ ] Code tuân thủ TypeScript strict types (không dùng `any` bừa bãi).
- [ ] Chạy `npm run lint` không có cảnh báo hoặc lỗi.
- [ ] Chạy `npm run build` thành công, không có lỗi type.
- [ ] Chạy `npm run test --workspace @zalobot/api` thành công; không thay bằng lệnh chỉ match test ở thư mục gốc.
- [ ] Cập nhật tài liệu tương ứng trong thư mục `docs/` nếu có thay đổi kiến trúc hoặc biến môi trường.

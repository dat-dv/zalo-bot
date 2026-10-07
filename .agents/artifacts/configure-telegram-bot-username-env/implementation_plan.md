# Kế hoạch Cập nhật Biến Môi Trường zalo Bot Username

## Mô tả nhiệm vụ

Cập nhật biến môi trường `NEXT_PUBLIC_zalo_BOT_USERNAME` và `NEXT_PUBLIC_zalo_BOT_URL` tương ứng với bot `@datdoan_assistant_bot` vào toàn bộ các tệp cấu hình môi trường của hệ thống (`.env`, `.env.local`, `.env.example`, `apps/web/.env.local`, `apps/web/.env.local.example`).

---

## Thay đổi đề xuất (Proposed Changes)

### Cấu hình Môi Trường (Environment Configuration)

#### [MODIFY] [`.env`](file:///Users/datdoan/Documents/projects/zalobot/.env)

- Bổ sung cấu hình:
  ```env
  NEXT_PUBLIC_zalo_BOT_USERNAME=datdoan_assistant_bot
  NEXT_PUBLIC_zalo_BOT_URL=https://t.me/datdoan_assistant_bot
  ```

#### [MODIFY] [`.env.local`](file:///Users/datdoan/Documents/projects/zalobot/.env.local)

- Bổ sung cấu hình:
  ```env
  NEXT_PUBLIC_zalo_BOT_USERNAME=datdoan_assistant_bot
  NEXT_PUBLIC_zalo_BOT_URL=https://t.me/datdoan_assistant_bot
  ```

#### [MODIFY] [`.env.example`](file:///Users/datdoan/Documents/projects/zalobot/.env.example)

- Cập nhật mẫu giá trị tham khảo:
  ```env
  NEXT_PUBLIC_zalo_BOT_URL=https://t.me/datdoan_assistant_bot
  NEXT_PUBLIC_zalo_BOT_USERNAME=datdoan_assistant_bot
  ```

#### [MODIFY] [`apps/web/.env.local`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/.env.local)

- Bổ sung cấu hình:
  ```env
  NEXT_PUBLIC_zalo_BOT_USERNAME=datdoan_assistant_bot
  NEXT_PUBLIC_zalo_BOT_URL=https://t.me/datdoan_assistant_bot
  ```

#### [MODIFY] [`apps/web/.env.local.example`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/.env.local.example)

- Bổ sung mẫu cấu hình:
  ```env
  NEXT_PUBLIC_zalo_BOT_USERNAME=datdoan_assistant_bot
  NEXT_PUBLIC_zalo_BOT_URL=https://t.me/datdoan_assistant_bot
  ```

---

## Kế hoạch Kiểm tra (Verification Plan)

### Automated Verification

- Chạy validate toàn hệ thống:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Kiểm tra các file `.env*` đảm bảo biến được gán chính xác `datdoan_assistant_bot` và URL `https://t.me/datdoan_assistant_bot`.

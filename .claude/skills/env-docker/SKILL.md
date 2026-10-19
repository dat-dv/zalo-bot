---
name: env-docker
description: Quy chuẩn quản lý biến môi trường (.env.local cho Dev, .env.example cho Template, .env cho Prod) và nạp cấu hình vào Docker Compose, App Backend, Web Frontend (hỗ trợ Monorepo).
metadata:
  agent-artifact:
    id: env-docker-skill
    type: skill
    explanation: .agents/system-explain/plugins/env-docker/skills/README.md
    depends_on: []
---

> **zalo-bot adaptation** (vendored from Base Agents plugin `env-docker`; project conventions override generic defaults below)
>
> - Root env files here: `.env` (dev), `.env.example` (template), `.env.production`; API loads `.env` then `.env.local`. Follow `.agents/knowledge/global/environment-guard.md` (fail-fast, no fallbacks) over generic defaults.
> - No Turborepo / Vite runtime: Next.js static web (`NEXT_PUBLIC_*` only) + Nest API, Docker Compose + Coolify. Never print secret values.

# Plugin Quy chuẩn Quản lý Environment Variables & Docker Integration

Plugin này cung cấp quy chuẩn và quy trình quản lý biến môi trường (ENV) cùng tích hợp nạp cấu hình vào Docker Compose, ứng dụng Backend và Frontend Web/App (kể cả mô hình Monorepo nested).

---

## 1. Quy tắc Phân định 3 File ENV Tiêu chuẩn

Hệ thống quy ước sử dụng duy nhất 3 file ENV chính:

| File Name | Môi trường | Cam kết Git | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **`.env.local`** | **Development (Dev)** | ❌ **KHÔNG** commit | Dùng độc quyền trên máy dev local (đặt tại Root dự án/Monorepo). Chứa port/credentials local. |
| **`.env.example`** | **Template / Placeholder** | ✅ **CÓ** commit | File mẫu chứa toàn bộ danh sách key với giá trị placeholder. |
| **`.env`** | **Production (Prod)** | ❌ **KHÔNG** commit | Dùng cho môi trường Production thật (hoặc được inject tự động bởi CI/CD). |

> ⚠️ **Chú ý bảo mật**: Luôn khai báo `.env` và `.env.local` vào `.gitignore`.

---

## 2. Nạp Root `.env.local` vào Các Apps Trong Monorepo (`apps/web`, `apps/api`)

Khi ứng dụng nằm trong thư mục con lồng nhau (Nested Monorepo) nhưng hệ thống chỉ quản lý **duy nhất 1 file `.env.local` tại Root**, từng framework được quy ước cấu hình như sau để đọc được biến môi trường từ Root:

```text
monorepo-root/
├── .env.local              <-- ĐỊA CHỈ TẬP TRUNG DUY NHẤT CHO DEV
├── .env.example            <-- TEMPLATE PLACEHOLDER COMMIT GIT
├── apps/
│   ├── api/                <-- NestJS Backend App
│   └── web/                <-- Next.js / Vite Frontend App
└── docker-compose.yml
```

### A. NestJS Backend App (`apps/api`)
Cấu hình `@nestjs/config` truyền đường dẫn tương đối hoặc `path.resolve` lên thư mục Root Monorepo:

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '../../.env.local'), // Đọc root .env.local khi chạy dev trong Monorepo
        path.resolve(process.cwd(), '.env.local'),        // Fallback đọc tại thư mục app
      ],
    }),
  ],
})
export class AppModule {}
```

---

### B. Next.js Web App (`apps/web`)

* **Phương án 1: Sử dụng `@next/env` trong `next.config.js` (Khuyến nghị)**
  ```javascript
  // apps/web/next.config.js
  const { loadEnvConfig } = require('@next/env');
  const path = require('path');

  // Nạp biến môi trường từ Root Monorepo trước khi Next.js khởi tạo config
  loadEnvConfig(path.resolve(__dirname, '../../'));

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
  };

  module.exports = nextConfig;
  ```

* **Phương án 2: Dùng `dotenv-cli` trong `package.json`**
  ```json
  {
    "scripts": {
      "dev": "dotenv -e ../../.env.local -- next dev"
    }
  }
  ```

---

### C. Vite / React SPA (`apps/web-admin`)
Cấu hình `envDir` chỉ định trỏ ra thư mục gốc Monorepo trong `vite.config.ts`:

```typescript
// apps/web-admin/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Chỉ định Vite tìm .env.local ở thư mục Root Monorepo
  envDir: path.resolve(__dirname, '../../'),
});
```

---

### D. Cấu hình Turborepo / Nx Monorepo (`turbo.json`)
Để Turborepo nhận diện các biến từ Root `.env.local` mà không bị hỏng cache hash giữa các lệnh build/dev:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "PORT",
    "NODE_ENV",
    "DATABASE_URL",
    "JWT_SECRET",
    "NEXT_PUBLIC_API_URL",
    "VITE_API_URL"
  ]
}
```

---

## 3. Quy chuẩn Nạp ENV cho Docker & Docker Compose

#### 1. Cấu hình `docker-compose.yml` tại Root Monorepo
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file:
      - ${ENV_FILE:-.env.local}
    ports:
      - "${PORT:-3000}:3000"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    env_file:
      - ${ENV_FILE:-.env.local}
    ports:
      - "${WEB_PORT:-3001}:3001"
```

#### 2. Lệnh thực thi Docker Compose
* **Local Dev**:
  ```bash
  ENV_FILE=.env.local docker compose up -d
  # Hoặc dùng flag trực tiếp:
  docker compose --env-file .env.local up -d
  ```

* **Production**:
  ```bash
  ENV_FILE=.env docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  # Hoặc dùng flag trực tiếp:
  docker compose --env-file .env up -d --build
  ```

---

## 4. Phân vùng An toàn Biến Môi trường (Security Scoping)

* **Frontend (Client Bundle)**: Chỉ expose biến có tiền tố public (`NEXT_PUBLIC_*`, `VITE_*`).
* **Backend (Server Only)**: Đọc các biến private nhạy cảm (`DB_PASS`, `JWT_SECRET`, `PRIVATE_KEY`). **Tuyệt đối không đưa tiền tố public vào biến nhạy cảm.**

---

## 5. Verification Checklist

- [ ] `.env.local` nằm duy nhất tại Root Monorepo và đã được ignore bởi Git (`.gitignore`).
- [ ] `.env.example` tại Root chứa toàn bộ danh sách key tiêu chuẩn của tất cả sub-apps.
- [ ] Sub-app NestJS cấu hình `ConfigModule` với `envFilePath` trỏ ra `../../.env.local`.
- [ ] Sub-app Next.js sử dụng `@next/env` hoặc `dotenv-cli` nạp root `.env.local`.
- [ ] Sub-app Vite cấu hình `envDir: path.resolve(__dirname, '../../')`.
- [ ] `turbo.json` khai báo `globalEnv` đầy đủ các biến môi trường dùng chung.

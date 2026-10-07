# Tổng kết triển khai: Chạy API và Web bằng một lệnh (`npm run dev`)

Đã hoàn thành cấu hình chạy đồng thời NestJS API (`@zalobot/api`) và React Web (`@zalobot/web`) chỉ với một lệnh `npm run dev` ở root workspace.

---

## Các thay đổi chính

1. **Root `package.json`**:
   - Bổ sung `concurrently` (^9.2.4) vào `devDependencies`.
   - Cấu hình script `dev`:
     ```json
     "dev": "concurrently --names api,web --prefix-colors blue,green \"npm run dev:api\" \"npm run dev:web\"",
     "dev:api": "npm run start:dev --workspace @zalobot/api",
     "dev:web": "npm run dev --workspace @zalobot/web"
     ```
2. **Environment Templates**:
   - `apps/web/.env.local.example`: Tạo mẫu cấu hình với `VITE_API_URL=http://localhost:3000`.
   - `.env.example` (root): Cập nhật đầy đủ các biến môi trường mẫu an toàn (`DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`, etc.).
3. **Tài liệu & Hướng dẫn**:
   - Cập nhật [`README.md`](file:///Users/datdoan/Documents/projects/zalobot/README.md).
   - Cập nhật [`.agents/knowledge/global/monorepo-architecture.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/monorepo-architecture.md).
   - Cập nhật [`.agents/docs/global/monorepo-architecture.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/monorepo-architecture.md).

---

## Kết quả kiểm tra chất lượng

- `npm run typecheck`: ✅ Thành công (API, Web, Contracts không có lỗi type).
- `npm run lint`: ✅ Thành công (ESLint pass toàn bộ workspaces).
- `npm run build`: ✅ Thành công (Build sạch `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`).

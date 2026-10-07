---
RequestFeedback: true
Task: monorepo-react-initialization
Risk: high
Status: awaiting-approval
---

# Kế hoạch chuyển sang monorepo và khởi tạo React

## Mục tiêu

Chuyển NestJS zalo bot hiện hữu thành monorepo npm workspaces, giữ nguyên hành vi backend, và tạo ứng dụng React + Vite + TypeScript tại `apps/web` làm nền tảng giao diện quản trị.

## Phát hiện hiện tại

- Repository hiện là một NestJS package duy nhất: mã nguồn ở `src/`, build ra `dist/`, Dockerfile và Compose đều giả định cấu trúc này.
- Backend phụ thuộc đường dẫn theo thư mục chạy cho `.env`, `data/` và thông tin OAuth; khi chuyển vào `apps/api` cần chuẩn hóa các đường dẫn này để vẫn đọc dữ liệu ở root monorepo.
- Chưa có API dashboard hoàn chỉnh; chỉ có `reports` controller. Vì vậy React sẽ được tạo thành shell có thể chạy/build, chưa gắn API hay cơ chế đăng nhập chưa được yêu cầu.
- Có thay đổi cục bộ chưa commit tại `.gitignore`, `.husky/pre-commit`, `package.json` và `.agents/`; các thay đổi này sẽ được bảo toàn.
- Kiểm tra `npm run agent-system:validate` chưa chạy được vì script không tồn tại. Không sửa lỗi này ngoài phạm vi đã yêu cầu.
- Tài liệu module hiện thiếu ánh xạ cho 10 module backend; đây là tồn tại sẵn có. Phần tài liệu của thay đổi kiến trúc monorepo sẽ được cập nhật trong `global/`, không mở rộng sang viết lại tài liệu của mọi module backend.

## Thiết kế đề xuất

```text
zalobot/
├── apps/
│   ├── api/                 # NestJS hiện tại (di chuyển bằng mv)
│   └── web/                 # React + Vite + TypeScript
├── packages/
│   └── contracts/           # TypeScript types/route constants dùng chung, sẵn sàng cho API sau này
├── package.json             # npm workspaces + lệnh điều phối root
├── package-lock.json
├── docker-compose.yml       # service api; web chỉ thêm khi có yêu cầu deploy
└── .env.example             # phân biệt biến server và VITE_API_URL công khai
```

Lựa chọn React SPA/Vite giúp khởi tạo frontend nhẹ, chạy tĩnh độc lập với NestJS và dùng `VITE_API_URL` khi bắt đầu tích hợp API. Backend tiếp tục là service riêng tại `apps/api`.

## Phạm vi thực hiện sau khi duyệt

1. Dùng `mv` để chuyển các tệp backend (`src`, `scripts`, cấu hình Nest/TypeScript, Dockerfile backend và cấu hình PM2) vào `apps/api`; điều chỉnh đường dẫn build, lệnh chạy và load `.env.local` root, đồng thời giữ `data/` ở root.
2. Chuyển root `package.json` thành npm workspace orchestrator; tách dependencies/scripts NestJS sang `apps/api/package.json`, thêm scripts root cho `dev`, `dev:api`, `dev:web`, `build`, `lint`, `typecheck` và workspace script tương ứng.
3. Khởi tạo `apps/web` với Vite, React, TypeScript, cấu hình `envDir` trỏ root, ESLint/Prettier phù hợp và trang shell quản trị tối giản, responsive theo định hướng Flat Enterprise của dự án.
4. Tạo `packages/contracts` với cấu hình TypeScript, export endpoint/route constants và kiểu API cơ bản để tránh trùng lặp hợp đồng khi frontend bắt đầu gọi backend.
5. Cập nhật Docker Compose/Dockerfile để build API từ root monorepo; không tự động triển khai web container vì chưa có yêu cầu về hosting frontend.
6. Cập nhật `.gitignore`, `.env.example`, README và tài liệu kiến trúc tương ứng trong `.agents/knowledge/global/` (English) và `.agents/docs/global/` (Vietnamese), cùng index `.agents/docs/README.md` nếu cần.
7. Chạy cài đặt dependency, build/lint/typecheck cho từng workspace và root, sau đó báo rõ các kiểm tra không thể chạy nếu có.

## Các thay đổi có ảnh hưởng

- Lệnh phát triển và deploy backend đổi từ root sang workspace (`npm run dev:api`, `npm run build --workspace @zalobot/api`).
- Docker build context vẫn là root để npm workspaces cài dependency đúng; volume SQLite tiếp tục là `./data:/app/data`.
- Biến bí mật chỉ thuộc backend; frontend chỉ nhận `VITE_API_URL` và không được đưa token Gemini/zalo/Google vào bundle.
- Không thay đổi database schema, zalo commands, Google OAuth flow hay nghiệp vụ bot.

## Rủi ro và cách giảm thiểu

- Di chuyển file có thể làm sai đường dẫn runtime: kiểm tra `process.cwd()` cho database, OAuth credential và `.env` trước/sau migration.
- Native dependency `better-sqlite3` cần cài lại trong workspace/Docker: dùng lockfile mới và build API trong container.
- Frontend chưa có API quản trị được xác định: chỉ tạo shell không giả định endpoint hay auth contract.

## Tiêu chí hoàn thành

- `apps/api` chạy và build được với cấu hình root `.env.local`/`data`.
- `apps/web` khởi động và build được bằng Vite.
- Root npm workspaces điều phối được hai ứng dụng và package contracts.
- Docker API tiếp tục build được từ root.
- Tài liệu kiến trúc và hướng dẫn chạy dự án được đồng bộ.

## Quyết định cần xác nhận

Kế hoạch này mặc định dùng **Vite React SPA** và tạo frontend shell, chưa xây dashboard/API/auth. Nếu anh muốn Next.js, hoặc muốn giao diện có chức năng cụ thể ngay từ đầu, hãy nêu rõ trước khi duyệt.

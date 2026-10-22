# Walkthrough: Trang riêng `/google-storage` cho tài khoản Google Drive

Plan được duyệt với Q1 = `/google-storage`, nhãn "Google Drive"; Q2 = bỏ hẳn thẻ khỏi `/zca`.

## Thay đổi

- **Contracts**: thêm `APP_ROUTES.googleStorage`, `nav.googleStorage`, `googleStorage.title|subtitle|forbidden|openRoot|howItWorks.*` (vi/en).
- **Điều hướng**: thêm mục "Google Drive" (icon đám mây) vào nhóm HỆ THỐNG, giữa Zalo & Người dùng và Cài đặt. Tiêu đề trên topbar khai báo trong `workspace-header.tsx`.
- **Trang**:
  - `app/(private)/google-storage/page.tsx` → `GoogleStorageScreen` (`modules/zca/view`).
  - `GoogleStorageAccountPanel`: đổi tên từ `GoogleStorageAccountCard` bằng `git mv`, chuyển sang bố cục trang. Bỏ trạng thái lỗi chung khi API trả 403, thay bằng thông báo "chỉ admin".
  - Thêm khối tĩnh `GoogleStorageHowItWorks`.
- **Model**: `model/google-storage-account.ts` (`isForbiddenError`, `storageLoginLabelKey`, `isStorageReady`) kèm spec. Query không retry khi gặp 403.
- **`/zca`**: gỡ thẻ; `zca-screen.tsx` trở về đúng như trước commit `d7f600b`.
- **Tài liệu**: `knowledge/modules/zca/channel-storage.md`, `docs/modules/zca/channel-storage.md`, `knowledge/project-overview.md`, `CONTEXT.md`.

## Kiểm tra

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run test`: api 558/558, web 97/97 (thêm 3 test mới).
- `npm run build --workspace @zalobot/web`: xuất `/google-storage` dạng trang tĩnh.
- `docs-drift-check`: PASS.
- **Chưa kiểm tra trên trình duyệt**: không có dev server zalobot nào đang chạy (cổng 3001 là dự án khác), preview bị `EPERM`, và API local chạy code cũ.

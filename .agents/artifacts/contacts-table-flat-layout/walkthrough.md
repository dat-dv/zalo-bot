# Walkthrough: Làm phẳng bảng `/contacts`

## Đã làm

- `contacts-screen.tsx`:
  - Tên, biệt danh, mô tả, ngân hàng, tài khoản liên kết: một dòng, cắt `…` theo `max-w` từng cột, `title` có giá trị đầy đủ. SĐT, số tài khoản và tài nguyên cũng `whitespace-nowrap`.
  - SĐT: bỏ chip vàng, thay bằng chữ vàng `· Zalo: <số>`.
  - Tài khoản liên kết: bỏ chip xanh và `👤`, hiện `Tên @username`.
  - Tài nguyên: bỏ 2 chip và `flex-wrap`, hiện `N nợ · N giao dịch`.
  - Nút Sửa/Lưu: bỏ emoji `✎`/`✓`.
- Tài liệu: `knowledge/modules/contacts/README.md`, `docs/modules/contacts/README.md`.

## Kiểm tra

- typecheck, lint của `@zalobot/web`: qua. Test: 36/36 qua.
- `docs-drift-check`: contacts không có lỗi. Lỗi duy nhất còn lại thuộc các file `zca` chưa commit của task `channel-storage-link-edit-delete`.
- **Chưa xem bằng mắt**: máy không chạy Postgres/Redis của dự án.

# Walkthrough: Làm phẳng bảng `/zca`

## Đã làm

- `chat-table-row.tsx`: bỏ mọi pill `rounded-full` và chip nền màu/emoji trong ô. Thay bằng chữ kèm chấm `●`/`○` và nút vuông `h-[22px] rounded-[2px]`. Mỗi ô một dòng, ô tên 2 dòng (`·` ngăn cách, cắt bớt khi dài). Thêm cột **Tính năng** (`@Bot`/`Chat riêng`, `Nhớ`, `Sao lưu media`). Quyền tương tác dồn về một dòng. Cột Thao tác chỉ còn **Cấu hình** và menu `⋯` (Drive, Photos, Sao lưu media lịch sử, rồi các thao tác người dùng). Avatar vuông `rounded-[3px]`.
- `chat-row-menu.tsx`: nút `⋯` cùng kích thước/góc với nút trong bảng.
- `zca-screen.tsx`: thêm header "Tính năng", đặt lại độ rộng cột, `colSpan` 6 → 7.
- `packages/contracts/src/index.ts`: bỏ emoji 🔗 trong `users.linkedContacts.badge` (vi/en), vì key này chỉ dùng ở bảng này.
- Tài liệu: `knowledge/modules/zca/{README,channel-storage,chat-memory}.md` và `docs/modules/zca/{README,channel-storage,chat-memory}.md`.

## Kiểm tra

- `npm run typecheck --workspace @zalobot/web`: qua.
- `npm run lint --workspace @zalobot/web`: qua.
- `npm run test --workspace @zalobot/web`: 36/36 qua.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- **Chưa xem bằng mắt**: máy không chạy Postgres/Redis của dự án nên không dựng được `/zca` cục bộ.

## Lưu ý

- Working tree đang có thay đổi của task khác (`channel-storage-link-edit-delete`: API, migration, `thread-storage-links-dialog.tsx`, và có thể cả `packages/contracts/src/index.ts`). Khi commit cần tách riêng.

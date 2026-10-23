# Walkthrough: Nút "Thêm link" trong hộp thoại Drive / Photos

Plan: [implementation_plan.md](implementation_plan.md). Anh đã duyệt phương án A, nhãn "Thêm link".

## Đã làm

- **Contracts** (`packages/contracts/src/index.ts`): thêm `CreateChannelStorageLinkDto`, `NormalizedChannelStorageLinkCreate`, mã lỗi `url_duplicate`, hàm `channelStorageResourceIdFromUrl` và `validateChannelStorageLinkCreate` (tái dùng validator Sửa); thêm chuỗi vi/en `zca.storageLinks.add*`, `displayNameAddPlaceholder`, `urlPlaceholderDrive|Photos`, `errors.urlDuplicate`.
- **API**:
  - `ChannelStorageLinkService.createLink` lưu qua `repository.save`, để nhật ký kiểm toán ghi được.
  - `POST /api/zca/threads/:threadId/storage-links` trong `ZcaController`: sai `kind` → 400, sai định dạng → 400, link trùng → 409.
  - Lỗi đụng unique key cũng thành 409, do global exception filter có sẵn xử lý.
- **Web**:
  - `createThreadStorageLink` và `useCreateThreadStorageLinkMutation`.
  - Form tách ra `thread-storage-link-form.tsx` (`StorageLinkForm`), dùng chung cho Sửa và Thêm.
  - `StorageLinkCreate` trong hộp thoại: nút ➕ Thêm link nét đứt, rộng hết hàng, mở ra form inline.
  - Đã chuyển comment của `deleteThreadStorageLink` về đúng chỗ.
- **Test**: `apps/api/src/zca/storage/channel-storage-link-create.spec.ts` (5 test: lấy id từ URL, validator, kiểm tra trùng, `createLink`).
- **Tài liệu**: knowledge + docs `modules/zca/channel-storage.md`, bảng API trong `knowledge/modules/zca/README.md`, thuật ngữ "Lịch sử nơi lưu trữ" trong `CONTEXT.md`.

## Kiểm tra đã chạy

- `npm run typecheck`, `npm run lint`, `npm run test` (API 689 pass, web 138 pass, 0 fail), `npm run build --workspace @zalobot/web`: đều exit 0.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm tra

- **Chưa xem giao diện trên trình duyệt.** Máy không có Postgres của zalobot (các container đang chạy là `logistics-dev`), và không được đọc `.env`. Chạy API bằng `.env` hiện tại có thể nối vào DB thật, nên em không chạy. Sau khi deploy, cần thử: thêm link hợp lệ, link trùng, link sai host, trên cả desktop và điện thoại.

## Hạn chế đã biết

- "Dùng từ … đến …" của dòng thêm tay bắt đầu từ ngày thêm.
- Form Sửa vẫn chưa chặn đổi URL thành một link đã có (giữ nguyên như trước, ngoài phạm vi).

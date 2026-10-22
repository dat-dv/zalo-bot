# Walkthrough: Lịch sử link Drive/Photos theo kênh + sửa lỗi lưu sai album

Plan đã duyệt: [implementation_plan.md](implementation_plan.md).

## Đã làm

### Backend (`apps/api`)
- **DB**: entity `ChannelStorageLinkEntity` (bảng `channel_storage_links`) và cột `user_tokens.is_shared`. Migration `1724830000000-CreateChannelStorageLinks` tạo bảng, backfill link từ `zca_thread_configs`, và đánh dấu token cập nhật gần nhất là tài khoản dùng chung.
- **Google layer**:
  - `GoogleAuthService`: tài khoản dùng chung được ghim bằng `is_shared`. Chỉ khi `exchangeCodeForTokens` chạy (tức admin login) thì tài khoản mới đổi; token refresh không làm đổi nữa. Mỗi lần login tạo OAuth client mới. Thêm `getAccountEmail()` (cache theo client).
  - `GoogleDriveService`: cache thư mục theo client; thêm `downloadPublicFile`.
  - `GooglePhotosService`: tìm album qua mọi trang (`nextPageToken`); cache album theo client; thêm `getOrCreateAlbumInfo` và `findAlbumInfo`.
- **Nơi lưu kênh**: `ChannelStorageTarget` cùng `buildChannelStorageTarget` / `getChannelUploadFolder` (`channel-storage.util.ts`), `getThreadStorageTarget` và `ThreadConfigService.getStorageTarget`.
- **`MediaStorageService`**: mọi upload bắt buộc nhận target. Album lấy từ lịch sử của tài khoản hiện tại. Sau khi upload thì ghi lịch sử (best effort). Thêm `syncCurrentStorage(target)`.
- **Call site**: sửa 5 chỗ trước đây rơi vào album mặc định (`zca-bot-feature` ảnh hoá đơn + video gửi thẳng, 2 pending-image strategy, `input-processor`), cộng thêm 3 chỗ vốn đã truyền config (lưu theo yêu cầu, auto backup, sync lịch sử).
- **`ChannelStorageLinkModule`** (`zca/storage/`): service `record/findAlbum/listForThread` và mapper `toChannelStorageLinksResponse`.
- **API**: `GET /api/zca/threads/:threadId/storage-links` (chỉ admin).
- **Proxy hoá đơn**: `downloadDriveReceipt` (`finance/receipt-source.ts`) thử lần lượt token chung → token người tạo → link công khai.

### Contracts
- `API_ROUTES.zcaThreadStorageLinks`, các type `ChannelStorageLink*` và chuỗi i18n `zca.storageLinks.*` (vi/en).

### Web (`apps/web/src/modules/zca`)
- `getThreadStorageLinks` + `useThreadStorageLinksQuery`.
- `ThreadStorageLinksDialog`, mở từ chip `📁 Drive` / `📸 Photos`, nút Drive ở cột thao tác, và nút "Mở Google Drive/Photos" trong `ThreadConfigModal`.

### Tài liệu
- Knowledge/docs mới: `modules/zca/channel-storage.md`. Cập nhật: README zca (EN/VI), `global/finance-domain.md`, `global/receipt-image-analysis.md` (EN/VI), `modules/dashboard/README.md`, `.agents/docs/README.md`, `CONTEXT.md`.

## Điểm khác so với plan

1. **Nguyên nhân B trong plan bị mô tả sai.** Upload không dùng token của người gửi (`senderId` chỉ dùng để đặt tên file). Nguyên nhân thật là `saveTokensForUser` gán `sharedUserId` cho **mọi** lần lưu token, kể cả refresh mỗi giờ. Vì vậy tài khoản dùng chung nhảy qua lại giữa các admin (hoặc giữa hai ID của cùng một người). Cách sửa đúng là ghim tài khoản bằng cột `user_tokens.is_shared`. Đây là thay đổi schema không có trong plan (nằm chung migration mới).
2. **Popover → Modal.** Dùng `Modal` dùng chung (tự thành bottom sheet trên mobile) thay vì popover riêng, cho đúng quy ước dialog của dự án.
3. Các endpoint `/api/drive/open` và `/api/photos/open` cũ **không** ghi lịch sử; việc này do endpoint `storage-links` mới đảm nhận khi mở hộp thoại.
4. `ThreadConfigModal` bỏ query `useGoogleDriveFolderLinkQuery`, vì nút giờ mở hộp thoại thay cho link.

## Kiểm chứng

- `npm run build --workspace @zalobot/contracts`: OK
- `npm run typecheck --workspace @zalobot/api|web`: OK
- `npm run lint --workspace @zalobot/api|web|contracts`: OK
- `npm run test --workspace @zalobot/api`: 465/465 pass (test mới: `google-auth.service.spec.ts`, `channel-storage-links.mapper.spec.ts`, `receipt-source.spec.ts`; bổ sung `google-photos`, `media-storage`, `zca.controller`)
- `npm run test --workspace @zalobot/web`: 36/36 pass
- `npm run build --workspace @zalobot/web`: OK
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS

## Chưa kiểm chứng

- **Migration chưa chạy trên Postgres thật**: máy không có Postgres đang chạy.
- **Chưa khởi động app thật**, nên chưa kiểm tra được Nest DI chạy thực tế.
- **Upload thật và đổi tài khoản thật** lên Google Drive/Photos.
- **Link tải công khai** `drive.google.com/uc?export=download` chưa thử với Google thật.
- **Giao diện hộp thoại** chưa xem trên trình duyệt.

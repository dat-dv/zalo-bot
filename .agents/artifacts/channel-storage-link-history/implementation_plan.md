# Kế hoạch: Lịch sử link Drive/Photos theo kênh + sửa lỗi lưu sai album

- Route: `implement` — Phase 1 (Planning) — Authority: `inspect-and-plan`
- Rủi ro: **HIGH** (thêm bảng DB + migration, API mới trong `@zalobot/contracts`, đổi tài khoản Google dùng để lưu media)
- Skills sẽ dùng ở Phase 2: `backend`, `backend-bridge-frontend`, `frontend-orchestration`, `tanstack-query`, `enterprise-ui`

## 1. Mục tiêu

1. Trang `/zca`, ở mỗi kênh đang lắng nghe:
   - Bấm **📁 Drive** → hiện danh sách link Drive của kênh (mỗi tài khoản Google / mỗi thư mục gốc từng dùng là một dòng). Link trỏ thẳng vào **thư mục gốc của kênh** (`zalobot/<channelId>` hoặc thư mục riêng), mở ra thấy `bill`, `image`, `video` (và `file`, `audio` nếu có).
   - Bấm **📸 Photos** → hiện danh sách album Photos của kênh qua các tài khoản.
   - Đổi tài khoản Google thì link cũ **vẫn còn** trong danh sách, link mới được thêm vào và đánh dấu "Đang dùng".
2. Sửa các lỗi khiến ảnh/video/hoá đơn **vào sai album** (và sai Drive).
3. Ảnh hoá đơn cũ vẫn xem được trên dashboard sau khi đổi tài khoản Google.

## 2. Nguyên nhân lưu sai album (đã đối chiếu code)

| # | Nguyên nhân | Bằng chứng |
| --- | --- | --- |
| A | **5 đường upload không truyền album của kênh** → rơi vào album mặc định dùng chung cho mọi kênh (`ZaloBot - Hóa đơn` / `ZaloBot - Hình ảnh` / `ZaloBot - Video`), đồng thời bỏ qua thư mục Drive riêng (`customFolder`) và hậu tố file. | `zca-bot-feature.service.ts:675` (ảnh hoá đơn gửi trực tiếp/quote), `:1207` (video gửi thẳng), `create-bill-pending-image.strategy.ts:87`, `storage-upload-pending-image.strategy.ts:62`, `zalo/input-processor.service.ts:184`; mặc định ở `google-photos.service.ts:306,332,358` |
| B | **Tài khoản lưu trữ phụ thuộc người gửi**, không phụ thuộc kênh: upload dùng token của `senderId`; nếu thành viên đó từng kết nối Google (ví dụ để dùng Calendar) thì media vào Drive/Photos **của người đó**. Album ID của kênh lưu từ tài khoản A, upload bằng tài khoản B → lỗi → tạo album mới bên B → `savePhotosAlbumInfo` ghi đè album ID của kênh → "nhảy" album qua lại. Trong khi link "mở album" lại luôn dùng tài khoản chung. | `google-auth.service.ts:117` (`getOAuth2Client(userId)` ưu tiên token riêng), `google-photos.service.ts:217-247`, `thread-config.service.ts:779`, `google-resources.controller.ts:240` (`getAlbumLink(albumTitle)` không truyền user) |
| C | **Tìm album chỉ đọc trang đầu 50 album**, không theo `nextPageToken`. Khi số album app tạo > 50 (nhiều kênh + album mặc định), album cũ không được tìm thấy → tạo **album trùng tên**; cache trong RAM mất sau khi restart nên lặp lại. | `google-photos.service.ts:96` (`pageSize=50`, không phân trang), tương tự `getAlbumLink` `:376` |
| D | **Cache thư mục/album gắn với `userId`, không gắn với tài khoản Google** → đổi tài khoản khi API đang chạy thì dùng ID thư mục/album của tài khoản cũ cho tới khi restart. | `google-drive.service.ts:117`, `google-photos.service.ts:88` |

## 3. Quyết định thiết kế (em chọn, anh duyệt)

1. **Media của kênh luôn lưu bằng tài khoản Google dùng chung (admin)**, không theo người gửi. Lý do: thông báo hiện tại đã ghi "Google Drive & Google Photos dùng chung"; tránh dữ liệu bị rải sang tài khoản cá nhân. Token riêng của từng người vẫn dùng cho Calendar/Tasks như cũ.
2. **Photos: mỗi kênh một album trên mỗi tài khoản** (`[Zalo] <tên kênh>` hoặc tên album riêng). Hoá đơn, ảnh, video của kênh đều vào album này (không còn album mặc định toàn cục cho kênh). Drive vẫn tách `bill/image/video/file/audio`.
3. Upload/thư mục/album đi qua **một hàm chung** lấy "nơi lưu của kênh" (thư mục gốc, hậu tố, tiêu đề album, album ID của đúng tài khoản) → không còn đường upload nào tự đoán.
4. **Không xoá** các cột `drive_folder_*`, `photos_album_*` cũ của `zca_thread_configs` (giữ tương thích), nhưng nguồn hiển thị chính là bảng lịch sử mới.

## 4. Thay đổi chi tiết

### 4.1 Database (`apps/api/src/database`)
- Entity mới `ChannelStorageLinkEntity` → bảng `channel_storage_links`:
  - `id` (uuid), `thread_id`, `kind` (`drive` | `photos`), `google_email` (nullable — dữ liệu cũ chưa biết tài khoản), `resource_id` (folder ID / album ID), `url`, `label` (đường dẫn thư mục / tên album), `first_used_at`, `last_used_at`.
  - Unique `(thread_id, kind, resource_id)`; index `(thread_id, kind, last_used_at)`.
- Migration mới (không sửa migration cũ): tạo bảng + **backfill** từ `zca_thread_configs.drive_folder_*` và `photos_album_*` hiện có (`google_email = NULL`).

### 4.2 Google layer (`apps/api/src/google`)
- `GoogleAuthService`: thêm `getStorageAccount()` trả `{ client, email }` của tài khoản dùng chung; email lấy qua `userinfo` (scope `userinfo.email` đã có) và cache theo instance client (đổi tài khoản → client mới → email mới).
- `GoogleDriveService` / `GooglePhotosService`: khoá cache theo **email tài khoản** thay vì `userId` (sửa D).
- `GooglePhotosService.getOrCreateAlbum` + `getAlbumLink`: duyệt hết trang `albums.list` theo `nextPageToken` (sửa C).
- `MediaStorageService`: `uploadBill/uploadImage/uploadVideo/uploadFile` nhận `channelId` bắt buộc cho media kênh, tự resolve nơi lưu của kênh và dùng tài khoản chung; trả thêm `googleEmail` trong kết quả.

### 4.3 Lịch sử link (`apps/api/src/zca`)
- `ChannelStorageLinkService` (mới): `recordDrive(threadId, email, folderId, url, path)`, `recordPhotos(threadId, email, albumId, url, title)` (upsert, cập nhật `last_used_at`), `listForThread(threadId)`, `getCurrentAlbumId(threadId, email, title)`.
- Ghi lịch sử mỗi khi upload thành công hoặc khi endpoint "mở Drive/Photos" resolve được link.
- `savePhotosAlbumInfo` chỉ ghi album khi trùng **tài khoản dùng chung hiện tại** (bỏ hiện tượng ghi đè chéo tài khoản — sửa B).
- Sửa 5 call site ở mục 2-A để truyền `channelId` và dùng resolver chung.

### 4.4 API + contracts
- `packages/contracts`: thêm `API_ROUTES.zcaThreadStorageLinks(threadId)` (`/api/zca/threads/:threadId/storage-links`) và types:
  - `IChannelStorageLink { kind; url; label; googleEmail: string | null; firstUsedAt; lastUsedAt; isCurrent }`
  - `IChannelStorageLinksResponse { drive: IChannelStorageLink[]; photos: IChannelStorageLink[] }`
- Endpoint GET (chỉ admin, giống các endpoint ZCA hiện có): trả danh sách, mới nhất trước; `isCurrent` = dòng thuộc tài khoản chung hiện tại + thư mục/album hiện tại. Nếu chưa có dòng nào cho tài khoản hiện tại thì resolve và ghi trước khi trả.

### 4.5 Dashboard (`apps/web/src/modules/zca`)
- `zca-api.ts` / `zca-query.ts`: hàm gọi API + query key `zcaKeys.storageLinks(threadId)` (chỉ fetch khi mở popover).
- Component mới `ThreadStorageLinksPopover` (Level 3): danh sách link, mỗi dòng gồm nhãn (đường dẫn/tên album), email tài khoản (hoặc "Tài khoản cũ"), khoảng thời gian dùng, badge "Đang dùng"; link mở tab mới. Đủ 4 trạng thái: loading / lỗi / trống / có dữ liệu. Responsive: popover trên desktop, sheet toàn chiều ngang trên mobile. Giữ bo góc nhỏ hiện tại (`rounded`).
- `chat-table-row.tsx`: chip `📁 Drive ↗` / `📸 Photos ↗` đổi thành nút mở popover tương ứng.
- `thread-config-modal.tsx`: hộp Drive/Photos dùng cùng danh sách (thay một nút "Mở" đơn lẻ).
- i18n: thêm chuỗi vào catalog trong `@zalobot/contracts`.

### 4.6 Ảnh hoá đơn cũ trên dashboard (`finance.controller.ts`)
- Proxy `GET transactions/:id/receipt`: nếu đọc Drive bằng token thất bại thì thử tải qua link công khai của file (file đã được đặt quyền "ai có link cũng xem"), vẫn giữ kiểm tra `image/*` và giới hạn dung lượng. Dùng tài khoản chung thay vì token người tạo (khớp quyết định 3.1), token người tạo chỉ là phương án thử thêm cho dữ liệu cũ.

## 5. Kiểm thử

- Unit (`apps/api`): resolver nơi lưu kênh (album riêng, `customFolder`, mặc định); `getOrCreateAlbum` phân trang (mock 2 trang); `ChannelStorageLinkService` upsert/list/`isCurrent`; `MediaStorageService` luôn dùng tài khoản chung; proxy hoá đơn fallback link công khai.
- Cập nhật spec hiện có: `zca-drive-link.spec.ts`, `zca-sync-media.spec.ts`, spec liên quan `media-storage`/`google-photos`/`thread-config` nếu bị ảnh hưởng.
- Web: test helper map dữ liệu link (sắp xếp, nhãn tài khoản cũ).
- Lệnh: `npm run typecheck`, `npm run lint`, `npm run test` (theo workspace `api`, `web`, `contracts`), `npm run build --workspace @zalobot/web`.
- **Không kiểm chứng được tự động**: upload thật lên Google Drive/Photos và hành vi khi đổi tài khoản thật — cần anh thử trên môi trường thật sau khi deploy.

## 6. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/` (EN): file mới `channel-storage.md` (tài khoản lưu chung, album theo kênh/tài khoản, bảng lịch sử link, API) + cập nhật `README.md`.
- `.agents/docs/modules/zca/` (VI): file tương ứng giải thích nghiệp vụ + cập nhật `.agents/docs/README.md`.
- Cập nhật `global/receipt-image-analysis.md` (EN/VI) cho phần proxy hoá đơn nếu bị ảnh hưởng; `CONTEXT.md` mục "Phân vùng lưu trữ Drive" thêm khái niệm **Lịch sử nơi lưu trữ**.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 7. Ngoài phạm vi

- Di chuyển/copy file giữa các tài khoản Google.
- Hỗ trợ nhiều tài khoản Google lưu trữ song song (phương án B trước đó).
- Xoá các cột cũ trong `zca_thread_configs`.

## 8. Rủi ro & rollback

- Đổi sang tài khoản chung: kênh nào trước đây "vô tình" lưu vào tài khoản cá nhân sẽ bắt đầu lưu vào tài khoản chung — link cũ vẫn hiện trong lịch sử nếu đã được ghi lại (dữ liệu trước khi có bảng chỉ backfill được link đang lưu trong cấu hình kênh).
- Workspace chặn chia sẻ công khai → fallback 4.6 không có tác dụng với file đó.
- Rollback: revert commit + chạy `migration:revert` (bảng mới độc lập, không đụng dữ liệu tài chính).

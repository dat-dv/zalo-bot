# Kế hoạch: lệnh xem kho trên Zalo và link album trên dashboard đọc album của kênh từ DB

- Route: implement · Phase 1 (inspect-and-plan) · Mức rủi ro: **MEDIUM**. Đổi nội dung tin nhắn trả lời trên Zalo và kết quả của 2 endpoint; không đổi schema DB, không đổi contracts/web, không xin thêm quyền Google.
- Tiếp nối: [google-photos-duplicate-albums](../google-photos-duplicate-albums/implementation_plan.md) (v1.0.184). Bản đó đã đưa `channel_storage_links` thành nguồn duy nhất của album, nhưng để lại 2 chỗ đọc link theo cách cũ.

## 1. Hiện trạng (đã kiểm tra trong code)

| Chỗ đọc | Đang làm | Hậu quả |
| --- | --- | --- |
| Lệnh Zalo `/drive`, `/kho`, `/album`… và câu hỏi "ảnh lưu ở đâu" (`GET_STORAGE_LINKS`, `get-storage-links-tool.strategy.ts`) | Với mỗi loại bill/image/video, hỏi Google album chung `ZaloBot - Hóa đơn/Hình ảnh/Video` qua `getAlbumLink` → `albums.list` | Luôn báo "⚠️ Chưa có (album chưa được tạo)": `albums.list` bị 403, và các album chung này không còn được dùng nữa |
| Như trên, phần Drive theo loại | Luôn lấy `zalobot/<id>/<loại>` qua `getFolderWebLink`, mà hàm này **tạo thư mục nếu chưa có** | Kênh dùng "thư mục Drive riêng" thì media không vào các thư mục này, nhưng lệnh vẫn tạo ra 3 thư mục rỗng và đưa link sai |
| `GET /api/photos/album-link` và `GET /api/photos/open` (web dùng ở `sync-media-modal`) | Dùng link cũ `zca_thread_configs.photos_album_url` nếu tiêu đề khớp (link này lưu theo kênh, không theo tài khoản), nếu không thì gọi `getAlbumLink` (403 → `null`). Không có `channelId` thì tìm album chung `ZaloBot - Hình ảnh` | Có thể mở album của tài khoản Google cũ, hoặc rơi về trang chủ Google Photos |
| `MediaStorageService.getVideoStorageLinks()` | Không còn ai gọi | Code chết |

Sau khi sửa 3 chỗ trên, `GooglePhotosService.findAppAlbum` / `findAlbumInfo` / `getAlbumLink` (những chỗ cuối cùng còn gọi `albums.list`) không còn ai dùng và sẽ được xoá.

## 2. Quy tắc sau khi sửa

- **Album của một kênh** = dòng `channel_storage_links` theo (kênh, email tài khoản Google dùng chung hiện tại, tên album của kênh), dòng dùng gần nhất. Cùng quy tắc với upload và với nhãn "Đang dùng" trên dashboard. Đọc DB, không gọi Google, không bao giờ tạo album.
- Chưa có dòng nào (kênh chưa có ảnh/video nào trên tài khoản này) → báo "chưa có, album được tạo khi gửi ảnh/hóa đơn/video đầu tiên" (trên Zalo), hoặc mở trang chủ Google Photos (trên web).
- Không còn album chung của cả hệ thống. Không có `channelId` → mở trang chủ Google Photos.
- Thư mục Drive theo loại chỉ hiện khi kênh dùng thư mục mặc định (`target.splitByCategory`). Kênh dùng thư mục riêng chỉ hiện đúng thư mục đó, vì media vào thẳng đó theo tháng.

## 3. Thay đổi theo file

### 3.1 `apps/api/src/zca/text/strategies/get-storage-links-tool.strategy.ts`

- Constructor: thay `@Optional() photosService?: GooglePhotosService` (vị trí thứ 4) bằng `@Optional() storageLinks?: ChannelStorageLinkService`. `ZcaModule` đã import `ChannelStorageLinkModule` nên không phải sửa module. Điều kiện "dịch vụ chưa sẵn sàng" đổi thành `!driveService && !storageLinks`.
- Lấy nơi lưu bằng `threadConfigService.getStorageTarget(chatId)` (không có thì `buildChannelStorageTarget(chatId)`), thay cho `findStoredConfig` + `getThreadDriveRoot`. Kết quả thư mục gốc giữ nguyên.
- Album: `email = googleAuthService.getSharedAccountEmail()`; có email và `storageLinks` thì `storageLinks.findAlbum(chatId, email, target.photosAlbumTitle)`.
- Tin nhắn mới (giữ phần mở đầu, 2 dòng Drive gốc, gợi ý `@bot share`, thu hồi sau 5 phút):
  ```
  📸 Google Photos (Album [<tên album kênh>]):
  👉 <link album>          | ⚠️ Chưa có (album được tạo khi gửi ảnh/hóa đơn/video đầu tiên)

  🧾 HÓA ĐƠN:              ← chỉ khi kênh dùng thư mục mặc định
  • 📁 Drive [zalobot/<id>/bill]:
    👉 <link>
  …
  ```
  - Thư mục theo loại lấy bằng `getChannelUploadFolder(target, loại)`, không dùng `getChannelDriveFolderPath`.
  - Tham số `type` (all/bill/image/video) của tool vẫn chọn loại Drive cần hiện; dòng Photos luôn hiện.
- Không hiện email tài khoản Google trong tin nhắn nhóm (giữ như hiện tại).
- Lưu link Drive vào cấu hình kênh/người dùng (`saveDriveFolderInfo`) giữ nguyên.

### 3.2 `apps/api/src/google/google-resources.controller.ts` + `google.module.ts`

- `GoogleModule` import thêm `ChannelStorageLinkModule`. Module này độc lập, không tạo vòng phụ thuộc; không dùng `MediaStorageService` ở đây để khỏi thêm vòng `GoogleModule ↔ ReceiptStorageModule`.
- Constructor: thay `@Optional() photosService?: GooglePhotosService` (vị trí thứ 4, sẽ không còn dùng) bằng `@Optional() storageLinks?: ChannelStorageLinkService`.
- `resolvePhotosAlbumLink(channelId?, threadName?)`:
  - Không có `channelId` → `{ albumTitle: '', webViewLink: 'https://photos.google.com' }`.
  - Có `channelId` → tên album như hiện tại (`getThreadPhotosAlbumTitle(config)` hoặc `resolveChannelPhotosAlbumTitle`), rồi `authService.getSharedAccountEmail()` + `storageLinks.findAlbum(...)`. Kết quả là `album.url`, không có thì `https://photos.google.com`.
  - **Bỏ** dùng link cũ `config.photosAlbumUrl`, vì có thể là album của tài khoản cũ. **Bỏ** ghi `savePhotosAlbumInfo` trong endpoint này; upload vẫn ghi như cũ.
  - Lỗi khi đọc DB hoặc lấy email → giữ cách xử lý cũ: rơi về `https://photos.google.com`.
- Hình dạng response `{ data: { albumTitle, webViewLink } }` và quyền admin của `photos/album-link` / `photos/open` giữ nguyên.

### 3.3 Dọn code không còn dùng

- `GooglePhotosService`: xoá `findAppAlbum`, `findAlbumInfo`, `getAlbumLink`, `albumCache`, `albumCacheFor`, hằng `ALBUM_PAGE_SIZE` / `MAX_ALBUM_PAGES` và interface `GooglePhotosAlbum` nếu không còn dùng. Từ đó app **không còn gọi `albums.list`** ở bất kỳ đâu.
- `MediaStorageService.getVideoStorageLinks()`: xoá (không có caller).

### 3.4 Không đổi

- DB, migration, `@zalobot/contracts` (route `photosAlbumLink` / `photosOpen` giữ nguyên), web.

## 4. Test

`get-storage-links-tool.strategy.spec.ts`:
- Có dòng album trong DB cho đúng kênh + email + tên → tin nhắn có `Album [[Zalo] …]` và link album, không có chữ `ZaloBot - `.
- Chưa có dòng album → "album được tạo khi gửi ảnh/hóa đơn/video đầu tiên".
- Kênh dùng thư mục Drive riêng → không có dòng `zalobot/<id>/bill|image|video`, và `getFolderWebLink` không được gọi với các đường dẫn đó.
- Giữ các test cũ (thư mục kênh, thu hồi sau 5 phút, lưu thư mục vào cấu hình nhóm), chỉ chỉnh mock theo constructor mới.

`google-resources.controller.spec.ts`:
- Viết lại test "follows the photosAlbum override…": override `Album mới` → `findAlbum(channel, email, 'Album mới')` → trả link mới; link cũ `photosAlbumUrl` bị bỏ qua.
- Có `channelId`, chưa có dòng album → `https://photos.google.com`.
- Không có `channelId` → `https://photos.google.com`, không đọc DB.
- `photos/open` chuyển hướng tới link album từ DB.
- Chỉnh các test khác nếu đang truyền `GooglePhotosService` ở vị trí thứ 4.

`google-photos.service.spec.ts`: xoá 2 test của `findAlbumInfo` (phân trang, cache theo tài khoản) cùng với code.

Chạy: `npm run test|typecheck|lint --workspace @zalobot/api`, `node .claude/hooks/docs-drift-check.mjs`.

## 5. Tài liệu

Cập nhật knowledge (EN) và docs (VI):

- `modules/zca/channel-storage.md`: bỏ dòng "Known gap" / "Còn tồn tại". Mô tả lệnh Zalo, `photos/album-link` và `photos/open` đọc album từ DB; ghi rõ app không còn gọi `albums.list`.
- `modules/zca/README.md`:
  - EN dòng 136: `/api/photos/*` không còn dùng link cũ, đọc từ lịch sử.
  - VI dòng 272: tương tự.
- `global/backend-runtime-services.md` (EN dòng 58, 70; VI dòng 45): bỏ các album mặc định `ZaloBot - …` và mô tả lại `photos/album-link`. Các dòng này đã lỗi thời từ v1.0.184 mà lần trước chưa sửa; bộ kiểm tra lệch tài liệu chỉ soát thư mục module web nên không bắt được.

## 6. Commit

Sau khi kiểm tra xong: commit vào `main` và push để deploy, như lần trước. Hook sẽ tự nâng version và tạo tag. Chỉ stage các file của việc này.

## 7. Ngoài phạm vi

- Web `getThreadPhotosLink` (`zca-api.ts`, dùng trong `sync-media-modal`) vẫn ưu tiên link cũ `config.photosAlbumUrl` trước khi gọi `/api/photos/open`. Link cũ được mỗi lần upload ghi lại, nên thường đúng, chỉ sai ngay sau khi đổi tài khoản Google cho tới lần upload kế tiếp. Có thể sửa sau, khi đó web luôn gọi `photos/open`.
- Các album trùng đã có trên Google Photos: vẫn phải gộp/xoá tay.

## 8. Rủi ro

- Người dùng quen thấy 3 dòng album theo loại trong tin nhắn trả lời; giờ chỉ còn 1 dòng album của kênh. Đây là thay đổi chủ ý, đúng với "1 album / kênh / tài khoản".
- Kênh chưa từng có media trên tài khoản hiện tại sẽ báo "chưa có" thay vì một link. Đúng sự thật, vì album chỉ được tạo khi có media.

# Kế hoạch: mỗi tài khoản Google có đúng 1 kho (Drive + album) cho mỗi kênh, lưu trong DB

- Route: implement · Phase 1 (inspect-and-plan) · Mức rủi ro: **MEDIUM** (đổi hành vi nhiều file backend, không đổi schema DB, không đổi API/contracts, không xin thêm scope)
- Chẩn đoán: [investigation.md](investigation.md)
- Yêu cầu của anh (2026-10-23): không xin thêm quyền Google. Tài khoản Google nào thì dùng kho của tài khoản đó. Mỗi kênh (nhóm hoặc chat riêng), khi lần đầu có media trên một tài khoản, sẽ có địa chỉ kho riêng và phải lưu vào DB.

## 1. Quy tắc nghiệp vụ sau khi sửa

1. **Khoá của kho** = (tài khoản Google dùng chung `google_email`, kênh `thread_id`, loại `drive|photos`, tên `label`).
   - Tên album của một kênh đã cố định sau lần upload đầu (`zca_thread_configs.photos_album_title`), nên trên thực tế mỗi kênh, mỗi tài khoản chỉ có **1 album**.
   - Admin đổi "Tên album" trong trang cấu hình kênh (`mediaBackup.photosAlbum`) là chủ ý dùng album khác: tạo **đúng 1** album mới mang tên đó. Hành vi này giữ như cũ.
2. **DB (`channel_storage_links`) là nguồn sự thật của album.** Hệ thống không bao giờ tìm album trên Google bằng `albums.list`, vì scope `photoslibrary.appendonly` không cho phép.
3. Album chỉ được tạo khi kênh chưa có dòng album cho tài khoản hiện tại. **Ghi DB ngay sau khi tạo**, trước khi thêm ảnh vào album, để dù thêm ảnh lỗi thì album vẫn được dùng lại ở lần sau.
4. **Không tạo album thay thế khi thêm ảnh lỗi vì lý do khác** (429, 5xx, file bị từ chối…). Khi đó chỉ báo lỗi phần Photos; Drive vẫn lưu.
5. Chỉ tạo album thay thế khi Google báo album không dùng được nữa (ví dụ album đã bị xoá trong Google Photos). Album thay thế cũng được ghi DB và từ đó trở thành album đang dùng.
6. Upload đồng thời (gửi nhiều ảnh một lúc) chờ chung **một** lần tạo album, và **một** lần tạo mỗi thư mục Drive.
7. Không xác định được email tài khoản dùng chung → bỏ phần Photos với lỗi rõ ràng, không tạo album "vô chủ". Drive vẫn lưu.
8. Drive giữ cách tìm theo tên như hiện tại (`drive.file` cho phép tìm thư mục app tạo) và vẫn ghi thư mục gốc vào DB. Chỉ thêm chống tạo trùng khi chạy đồng thời.

## 2. Thay đổi theo file

### 2.1 `apps/api/src/google/google-photos.service.ts`

- Thêm `createAlbum(title, userId?) → { id, url }`: chỉ `POST /albums`, không list, không cache.
- Thêm class lỗi `PhotosAlbumUnavailableError extends Error`. `createMediaItem` ném lỗi này khi `mediaItems:batchCreate` trả:
  - `404`, hoặc
  - `400` / `403` có nội dung lỗi nhắc tới `album` (không phân biệt hoa thường).

  Các lỗi khác vẫn là `Error` như cũ.
- `uploadPhoto(options)`: options đổi thành `{ buffer, filename, description, album: { id, title, url? }, replaceAlbum?: (failedAlbumId) => Promise<{ id, url? }> }`.
  - Upload bytes một lần, thêm ảnh vào `album.id`.
  - Nếu nhận `PhotosAlbumUnavailableError` và có `replaceAlbum` → lấy album thay thế, **thử lại đúng 1 lần** với cùng `uploadToken`.
  - Mọi lỗi khác → ném ra. **Bỏ** nhánh fallback `getOrCreateAlbumInfo` hiện tại.
- `uploadBillPhoto` / `uploadGeneralPhoto` / `uploadVideo`: options nhận `album` + `replaceAlbum` thay cho `albumTitle` / `albumId`. Bỏ tên album mặc định toàn cục (`ZaloBot - …`), vì mọi upload đều đi qua kho của kênh.
- Xoá `getOrCreateAlbum` / `getOrCreateAlbumInfo`. Giữ `findAlbumInfo` / `getAlbumLink` (chỉ đọc, không bao giờ tạo) cho các chỗ đọc link cũ; xem mục 4.

### 2.2 `apps/api/src/receipt-storage/media-storage.service.ts`

- Thêm `resolveChannelAlbum(target, email)` → `{ id, url, title }`:
  1. Single-flight trong RAM theo khoá `email + threadId + title` (`Map<string, Promise<…>>`, xoá khi xong).
  2. Trong lượt đó: `linkService.findAlbum(threadId, email, title)`. Có → trả luôn.
  3. Không có → `photosService.createAlbum(title)` → `linkService.record({ kind: 'photos', googleEmail: email, resourceId, url, label: title })`. Ghi lỗi thì log `error` nhưng vẫn trả album để upload hiện tại không mất.
- Thêm `replaceChannelAlbum(target, email, failedAlbumId)`, cũng single-flight theo cùng khoá:
  - Đọc lại DB. Nếu album đang dùng đã khác `failedAlbumId` (một upload khác vừa thay) → trả album đó.
  - Ngược lại → tạo album mới, ghi DB, log `warn` có id album cũ.
- `uploadDual`:
  - `email` null → `photosError = 'Không xác định được tài khoản Google dùng chung'`, không gọi Photos.
  - Có email → `resolveChannelAlbum`, rồi gọi wrapper upload với `album` + `replaceAlbum`.
  - Sau khi thành công vẫn `recordPhotosAlbum` (cập nhật `last_used_at`) như hiện tại.
  - Bỏ `findKnownAlbum` (được thay bằng `resolveChannelAlbum`).
- `syncCurrentStorage`: lấy album đang dùng từ `linkService.findAlbum(threadId, email, title)`, không gọi Google. Dashboard sẽ hiện đúng nhãn "Đang dùng" cho album.
- `getVideoStorageLinks()` (link album toàn cục `ZaloBot - Video`) giữ nguyên; xem mục 4.

### 2.3 `apps/api/src/google/google-drive.service.ts`

- `ensureFolderPath`: duyệt từng tiền tố (`zalobot`, `zalobot/<ch>`, `zalobot/<ch>/image`, …). Mỗi tiền tố dùng cache hiện có, cộng một map promise "đang tạo" theo OAuth client (`WeakMap<object, Map<string, Promise<string>>>`).
  - Upload đồng thời của cùng kênh, kể cả khác loại (image và bill cùng cần `zalobot/<ch>`), chỉ tạo mỗi thư mục một lần.
  - Không đổi cách tìm theo tên.

### 2.4 `apps/api/src/zca/storage/channel-storage-link.service.ts`

- Không đổi chữ ký. `findAlbum` vẫn khớp `(threadId, 'photos', googleEmail, label)` và sắp `lastUsedAt DESC`.
- Chỉ cập nhật comment cho rõ đây là nguồn sự thật của album.

### 2.5 Không đổi

- Schema DB, migration, contracts, web: không đổi.
- Không có dòng DB nào bị sửa hay xoá tự động.

## 3. Test (node:test, theo mẫu spec hiện có)

`google-photos.service.spec.ts`:
- `createMediaItem` → `PhotosAlbumUnavailableError` với 404 và với 400 có chữ "album"; lỗi thường với 500 và 429.
- `uploadPhoto` với album bị báo không dùng được + `replaceAlbum` → gọi `replaceAlbum` 1 lần, thử lại 1 lần, thành công.
- `uploadPhoto` gặp 500 → ném lỗi, **không** có request `POST /albums`.
- Bỏ test dựa trên `getOrCreateAlbumInfo`. Giữ test phân trang của `findAppAlbum` (vẫn dùng cho `getAlbumLink`).

`media-storage.service.spec.ts`:
- DB đã có album → không tạo album, upload vào đúng album đó.
- Kênh mới, 3 upload chạy đồng thời → `createAlbum` gọi **1 lần**, `record` album trước khi thêm ảnh.
- Thêm ảnh lỗi 500 → không tạo album, `photosError` có giá trị, Drive vẫn có kết quả.
- Album không dùng được → tạo 1 album thay thế, ghi DB, thử lại thành công. 2 upload đồng thời cùng gặp lỗi → vẫn chỉ 1 album thay thế.
- `email` null → không gọi Photos, có `photosError`.
- `syncCurrentStorage` trả album từ DB mà không gọi Google.

`google-drive.service.spec.ts`:
- 2 lần `ensureFolderPath` đồng thời (`zalobot/ch/image`, `zalobot/ch/bill`) → mỗi thư mục chỉ `files.create` một lần.

## 4. Ngoài phạm vi (đề xuất làm sau)

- Lệnh Zalo xem kho lưu trữ (`get-storage-links-tool.strategy.ts`) và endpoint `GET /api/photos/album-link` (web không dùng) vẫn đọc album toàn cục / theo tên qua `albums.list`. Chúng luôn ra "chưa có" nhưng **không tạo album**. Nên chuyển sang đọc album của kênh từ DB trong một thay đổi riêng, vì đổi cả nội dung tin nhắn trả lời.
- Gộp hoặc xoá các album trùng đã có trên Google Photos: API không hỗ trợ, phải làm tay. Sau bản sửa, upload dính vào album có `last_used_at` mới nhất của kênh + tài khoản. Các dòng lịch sử thừa xoá được trong hộp "Mở Photos" trên dashboard.
- Khoá Redis cho nhiều instance API: hiện chỉ chạy 1 instance, khoá trong RAM là đủ.

## 5. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/channel-storage.md` (EN): viết lại mục "Album lookup". DB là nguồn sự thật, không dùng `albums.list` vì scope `appendonly`, single-flight, quy tắc album thay thế, `syncCurrentStorage` đọc DB, Drive single-flight.
- `.agents/docs/modules/zca/channel-storage.md` (VI): thêm vào mục 3 nguyên nhân thứ 5 ("album trùng do không đọc được danh sách album") và cập nhật mục 2.2/2.3.
- Chạy `node .claude/hooks/docs-drift-check.mjs` (phải exit 0).

## 6. Kiểm tra

- `npm run test --workspace @zalobot/api` (các spec liên quan, rồi toàn bộ)
- `npm run typecheck --workspace @zalobot/api`
- `npm run lint --workspace @zalobot/api`
- Không kiểm được trên production trong phiên này. Sau khi deploy, kiểm log: không còn `Could not list albums…`, và mỗi kênh chỉ có một dòng `Created Google Photos album "<tên>"` cho mỗi tài khoản.

## 7. Rủi ro còn lại

- Cách nhận diện "album không dùng được" dựa trên mã HTTP và nội dung lỗi của Google, chưa thử với album bị xoá thật.
  - Nếu Google trả lỗi khác mẫu: phần Photos sẽ báo lỗi liên tục, thay vì âm thầm tạo album trùng. Drive vẫn lưu, và log có `status` + nội dung để chỉnh.
- Một upload vào album cũ thành công ngay lúc album đó bị thay có thể cập nhật lại `last_used_at` của album cũ. Đây là trường hợp rất hiếm, có thể dẫn tới thêm 1 album thay thế.
- Ghi DB lỗi ngay sau khi tạo album: lần upload sau có thể tạo thêm 1 album. Có log `error` để phát hiện.

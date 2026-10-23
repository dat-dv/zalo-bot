# Chẩn đoán: Google Photos cứ tạo album mới thay vì dùng album cũ

- Route: investigate · Authority: propose-only · Ngày: 2026-10-23
- Phạm vi đọc: `apps/api/src/google/google-photos.service.ts`, `google-auth.service.ts`, `google-drive.service.ts`, `channel-storage.util.ts`, `apps/api/src/receipt-storage/media-storage.service.ts`, `apps/api/src/zca/storage/channel-storage-link.service.ts`, `apps/api/src/zca/thread-config.service.ts`, `apps/api/src/zca/zca-bot-feature.service.ts`, knowledge `modules/zca/channel-storage.md`.

## 1. Hiện tượng & kỳ vọng

- **Hiện tượng**: media của một kênh bị rải ra nhiều album Google Photos trùng tên, album mới liên tục xuất hiện.
- **Kỳ vọng** (knowledge `channel-storage.md`): mỗi kênh, trên mỗi tài khoản Google dùng chung, chỉ có **1 thư mục Drive gốc** và **1 album Photos**.

## 2. Nguyên nhân gốc (độ tin cậy: cao)

### 2.1 `albums.list` luôn bị Google từ chối vì thiếu scope

- `GOOGLE_SCOPES` chỉ xin `photoslibrary.appendonly` (`google-auth.service.ts:26`).
- Theo tài liệu hiện hành của Google, `albums.list` **chỉ** chấp nhận scope `photoslibrary.readonly.appcreateddata`. `appendonly` là scope chỉ-ghi (upload, tạo media, tạo album), không được liệt kê album.
- Hệ quả: `GooglePhotosService.findAppAlbum()` (`google-photos.service.ts:110`) **luôn** nhận lỗi 403 → `throw` → `getOrCreateAlbumInfo()` nuốt lỗi bằng `logger.warn('Could not list albums…')` rồi **đi thẳng xuống bước tạo album mới** (`google-photos.service.ts:162-178`).
- Nghĩa là bước "tìm album theo tiêu đề" chưa bao giờ hoạt động thật trên production. Bản sửa trước (đọc hết các trang `albums.list`, commit `7e8e9b5`) không có tác dụng vì request đầu tiên đã 403. Unit test không bắt được vì `fetch` được mock trả 200.
- Cùng lý do: `findAlbumInfo()` / `getAlbumLink()` luôn trả `null` (lỗi bị `catch {}` nuốt) → `syncCurrentStorage()` không bao giờ đánh dấu album Photos là "Đang dùng" trên dashboard, lệnh link storage trên Zalo không ra link album.

### 2.2 Thứ duy nhất chặn tạo trùng là bộ nhớ tạm + lịch sử DB, và cả hai đều có lỗ

Vì không tìm được album trên Google, việc dùng lại album chỉ dựa vào:
1. `albumCache` trong RAM (mất khi restart, theo từng OAuth client).
2. `ChannelStorageLinkService.findAlbum(threadId, email, title)` — dòng lịch sử `channel_storage_links` của đúng kênh + email + `label` = tiêu đề.

Các đường đi lọt qua cả hai và **tạo album mới**:

| # | Kích hoạt | Vị trí | Mức khả năng |
| --- | --- | --- | --- |
| T1 | **Lỗi bất kỳ khi `mediaItems:batchCreate`** với album đã biết (429, 5xx tạm thời, file không hỗ trợ, video quá lớn, "item creation rejected"…) → nhánh fallback gọi `getOrCreateAlbumInfo(title)` → list 403 → **tạo album mới**. Nếu lần thêm thứ 2 thành công, album mới được ghi lịch sử với `last_used_at` mới nhất → **mọi upload sau chuyển sang album mới**. | `google-photos.service.ts:281-296` | Cao — khớp đúng mô tả "cứ tạo album mới, không đưa vào album cũ" |
| T2 | **Nhiều ảnh gửi cùng lúc** ở kênh chưa có dòng lịch sử (lần đầu, hoặc sau khi đổi tài khoản Google): mỗi tin nhắn chạy `uploadDual` song song, `findKnownAlbum` đều trả `null`, cache rỗng, không có khoá "đang tạo" → mỗi ảnh tạo 1 album. | `media-storage.service.ts:160-166`, `google-photos.service.ts:147-196` | Cao với auto-backup nhóm |
| T3 | `getAccountEmail()` trả `null` (gọi `userinfo` lỗi tạm) → bỏ qua tra lịch sử; album tạo ra được ghi với `google_email = NULL`, lần sau (có email) không khớp → tạo tiếp. | `media-storage.service.ts:197-207`, `google-auth.service.ts:146-163` | Thấp |
| T4 | Dòng lịch sử admin thêm tay có `label = ''` → `findAlbum` (khớp `label = title`) không thấy → tạo mới. | `channel-storage-link.service.ts:60-69, 114` | Thấp |

Ngoài ra, khi T1 xảy ra với file thực sự lỗi (ví dụ định dạng không hỗ trợ), lần thêm thứ 2 cũng lỗi → để lại **album rỗng** trùng tên mỗi lần.

### 2.3 Drive thì sao

- `drive.file` cho phép `files.list` các thư mục app tạo, nên `ensureFolder` tìm-hoặc-tạo hoạt động bình thường. Drive **không** có lỗi gốc như Photos.
- Chỉ còn rủi ro nhỏ: upload đồng thời lần đầu (chưa có cache) có thể tạo trùng thư mục (`google-drive.service.ts:58-105`, không có khoá "đang tạo"), sau đó `files[0]` chọn ngẫu nhiên giữa các bản trùng.

## 3. Bằng chứng & điều chưa xác minh

- Đã xác minh: code (đường đi ở trên), scope đang xin (`appendonly` duy nhất), tài liệu Google: `albums.list` chỉ nhận `photoslibrary.readonly.appcreateddata` ([albums.list](https://developers.google.com/photos/library/reference/rest/v1/albums/list), [Authorization scopes](https://developers.google.com/photos/library/legacy/guides/authorization), [Updates to the Google Photos APIs](https://developers.google.com/photos/support/updates)).
- **Chưa xác minh trên production** (máy này không chạy API/DB của zalobot, không có log prod). Cách xác nhận:
  - Log API prod có dòng `Could not list albums from Google Photos: Google Photos albums.list failed (403)` và nhiều dòng `Created Google Photos album "<cùng tiêu đề>"`.
  - SQL (chỉ đọc):
    ```sql
    SELECT thread_id, google_email, label, count(*) AS albums
    FROM channel_storage_links
    WHERE kind = 'photos'
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
    ORDER BY albums DESC;
    ```
  - Dashboard: hộp "Mở Photos" của kênh có nhiều album cùng tên, không album nào có nhãn "Đang dùng".

## 4. Đề xuất khắc phục

### Phương án A — Bỏ phụ thuộc `albums.list`, dùng lịch sử DB làm nguồn sự thật (khuyến nghị)

Không cần xin thêm scope, không bắt admin đăng nhập lại.

1. **Không tạo album mới khi batchCreate lỗi vì lý do khác album**: chỉ fallback khi lỗi cho thấy album không còn dùng được (album bị xoá/không ghi được — 400 `INVALID_ARGUMENT` về albumId, 403/404 liên quan album). Lỗi khác (429, 5xx, file bị từ chối) → ném lỗi, giữ album cũ.
2. **Chống tạo trùng khi upload đồng thời**: trong `GooglePhotosService`, giữ map promise "đang tạo" theo (OAuth client, tiêu đề) để các upload song song chờ chung một lần `albums.create`. Cùng cách cho `GoogleDriveService.ensureFolderPath` (khoá theo client + path).
3. **Tìm album hiện tại từ lịch sử**: `syncCurrentStorage` / link album dùng `ChannelStorageLinkService.findAlbum` thay vì `findAlbumInfo` (list), để dashboard hiện đúng "Đang dùng".
4. **Không gọi `albums.list` khi token không có scope đọc** (kiểm tra `credentials.scope`), tránh 1 request 403 vô ích mỗi lần cache trống; giữ lại để dùng nếu sau này có scope.
5. (Tuỳ chọn) Khi `email` null: không tạo album mới nếu cache/lịch sử không xác định được tài khoản — hoặc lấy email từ dòng `user_tokens` của tài khoản dùng chung.
6. Test hồi quy: list trả 403 + đã có lịch sử → không tạo album; batchCreate 500 → không tạo album, ném lỗi; batchCreate báo album không hợp lệ → tạo 1 album; 3 upload đồng thời ở kênh mới → đúng 1 lần `albums.create`.
7. Cập nhật knowledge `modules/zca/channel-storage.md` (mục Album lookup) + docs tiếng Việt tương ứng.

### Phương án B — Xin thêm scope `photoslibrary.readonly.appcreateddata`

- Cho phép `albums.list` hoạt động lại. Nhưng: mọi tài khoản dùng chung phải đăng nhập lại (`/login`), phải cập nhật trang privacy + hồ sơ xác minh OAuth (scope Photos nhạy cảm), và vẫn cần mục A.1, A.2. Tìm theo tiêu đề cũng sẽ nhặt ngẫu nhiên một trong các album trùng tên đã có.
- Có thể làm sau, không cần cho bản sửa này.

### Dọn các album trùng đã có

- Photos API không có lệnh xoá album, và scope hiện tại không cho đọc/di chuyển ảnh giữa album → phải gộp/xoá thủ công trong Google Photos. Các dòng lịch sử thừa có thể xoá trong hộp "Mở Photos" của dashboard.
- Sau bản sửa, upload sẽ dính vào album có `last_used_at` mới nhất của kênh + tài khoản. Nếu muốn chọn album khác làm album chính, cần tính năng "đặt làm album đang dùng" (ngoài phạm vi).

## 5. Rủi ro hồi quy của bản sửa

- Phân loại lỗi batchCreate sai → album bị xoá thật thì upload lỗi mãi thay vì tạo album mới. Giảm thiểu: test cho từng loại lỗi, log rõ.
- Khoá in-flight chỉ có hiệu lực trong một process API (hiện chạy một instance). Nếu sau này scale nhiều instance cần khoá Redis.

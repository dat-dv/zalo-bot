---
metadata:
  agent-artifact:
    id: docs-module-zca-channel-storage
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/channel-storage.md
      - apps/api/src/zca/storage/channel-storage-link.service.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/google/google-photos.service.ts
      - apps/api/src/google/google-drive.service.ts
      - apps/api/src/google/google-auth.service.ts
      - apps/api/src/database/migrations/1724830000000-CreateChannelStorageLinks.ts
      - apps/web/src/modules/zca/presentation/components/thread-storage-links-dialog.tsx
      - apps/web/src/modules/zca/presentation/components/thread-storage-link-form.tsx
      - apps/web/src/modules/zca/presentation/components/google-storage-account-panel.tsx
      - apps/web/src/modules/zca/view/google-storage-screen.tsx
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/zca/text/strategies/get-storage-links-tool.strategy.ts
---

# Lưu trữ media theo kênh (Drive/Photos)

Tài liệu canonical tương ứng: [`channel-storage.md`](../../../knowledge/modules/zca/channel-storage.md).

## 1. Bài toán

- Ảnh, video, tệp và hoá đơn của mỗi kênh Zalo được lưu lên Google Drive và Google Photos.
- Khi admin **đổi tài khoản Google**, ảnh cũ vẫn nằm ở tài khoản cũ, không bị xoá. Nhưng trước đây mỗi kênh chỉ nhớ được **một** link Drive và **một** album. Đổi tài khoản là link cũ biến mất khỏi dashboard, ảnh hoá đơn cũ cũng không xem được nữa.
- Ngoài ra, ảnh hay bị **lưu sai album** và **cứ tạo album mới trùng tên**. Có 5 nguyên nhân, đều đã sửa (xem mục 3).

## 2. Hoạt động hiện tại

### 2.1. Một tài khoản lưu trữ dùng chung, cố định

- Mọi media của kênh đều lưu bằng **tài khoản Google dùng chung**, không dùng token Google riêng của thành viên.
- Tài khoản dùng chung được ghim bằng cột `user_tokens.is_shared`. **Chỉ khi admin bấm `/login` và cấp quyền** thì tài khoản dùng chung mới đổi. Việc tự làm mới token mỗi giờ không còn làm đổi tài khoản.
- Mỗi lần đăng nhập, app tạo một OAuth client mới, nên cache ID thư mục/album của tài khoản cũ bị bỏ đi ngay mà không cần khởi động lại API.
- **Không còn tự chọn tài khoản thay thế**: trước đây, nếu chưa có tài khoản được ghim, hệ thống lấy đại token Google của bất kỳ ai. Như vậy đăng xuất xong, bot sẽ âm thầm lưu media sang Gmail của một admin khác. Giờ chỉ token được ghim (`is_shared`) mới là tài khoản lưu trữ; không có thì bot ngừng lưu lên Google cho tới khi admin đăng nhập lại.

### 2.1b. Xem, đăng nhập, đăng xuất trên dashboard

- Tài khoản lưu trữ có **trang riêng** `/google-storage`, mục menu **Google Drive** trong nhóm HỆ THỐNG (trên điện thoại nằm trong "Thêm"). Lý do: đây là cấu hình cho cả hệ thống, tách khỏi việc đăng nhập ZCA và quản lý người dùng ở `/zca`.
- Chỉ admin xem và thao tác được; người khác mở trang sẽ thấy dòng "Chỉ admin xem và đổi được tài khoản Google lưu trữ".
- Dưới khối tài khoản có mục **Cách hoạt động** nhắc lại các hệ quả bên dưới, để admin đọc trước khi bấm.
- Thẻ cho biết: đã kết nối hay chưa, email Gmail đang dùng, và có thiếu quyền Drive/Photos không (thiếu thì media không lưu được).
- **Đăng nhập Google / Đổi tài khoản / Cấp lại quyền**: mở trang đăng nhập Google ở tab mới. Cấp quyền xong, quay lại tab dashboard, thẻ tự cập nhật email mới. Cách này đi chung đường với lệnh `/login` trên Zalo: tài khoản vừa đăng nhập thành tài khoản dùng chung.
- **Đăng xuất**: có hộp xác nhận. Hệ thống thu hồi quyền của app ngay trên tài khoản Google đó (nếu Google không phản hồi thì vẫn đăng xuất phía bot), rồi xoá token.
  - File đã lưu vẫn nằm nguyên trên Google; lịch sử link của các kênh vẫn giữ.
  - Mỗi người chỉ có một token Google, nên đăng xuất cũng ngắt luôn kết nối Google cá nhân của admin sở hữu token đó.
- Lưu ý bảo mật đã biết (chưa xử lý): tham số `state` của link đăng nhập Google chỉ là ID người dùng, chưa được ký.

### 2.2. Nơi lưu của từng kênh

- **Drive**: thư mục gốc của kênh là `zalobot/<channelId>`, trong đó có `bill`, `image`, `video`, `file`, mỗi thư mục chia tiếp theo tháng `YYYY-MM`. Nếu kênh đặt "thư mục Drive riêng" thì mọi thứ vào thẳng thư mục đó (chia theo tháng).
- **Photos**: **mỗi kênh có một album trên mỗi tài khoản Google**. Hoá đơn, ảnh và video đều vào album này. Tên album: tên album riêng nếu có, nếu không thì `[Zalo] <tên nhóm>`. Tên được giữ cố định từ lần upload đầu; admin đổi "Tên Album Google Photos riêng" thì hệ thống tạo **đúng một** album mới mang tên đó.
- Hàm upload bắt buộc phải nhận "nơi lưu của kênh" (`ChannelStorageTarget`), nên không còn đường upload nào tự rơi vào album mặc định dùng chung.

#### Hệ thống biết album của kênh bằng cách nào

- App chỉ xin quyền Google Photos **chỉ-ghi** (`photoslibrary.appendonly`): được tạo album và thêm ảnh, nhưng **không được xem danh sách album**. Đây là chủ ý: xin thêm quyền đọc thì mọi tài khoản phải đăng nhập lại và app phải xin Google duyệt lại.
- Vì không hỏi được Google "kênh này đã có album nào", **bảng `channel_storage_links` là nơi duy nhất nhớ album**: mỗi dòng gồm kênh, email tài khoản Google, id và link album. Album của một kênh trên một tài khoản là dòng dùng gần nhất.
- Luồng upload một ảnh:
  1. Lấy email tài khoản dùng chung. Không lấy được → bỏ qua phần Photos và báo lỗi (Drive vẫn lưu). Lý do: album tạo ra lúc này không gắn được với tài khoản nào nên lần sau sẽ không tìm lại được, sinh thêm album trùng.
  2. Tìm dòng album của kênh + email trong DB. Có → dùng luôn.
  3. Chưa có → tạo album mới và **ghi vào DB ngay**, trước khi thêm ảnh. Nhờ vậy, dù thêm ảnh lỗi, lần sau vẫn dùng lại album này.
  4. Thêm ảnh vào album. Lỗi do quá tải, lỗi máy chủ Google hay file bị từ chối → **giữ album**, chỉ báo lỗi phần Photos. Chỉ khi Google báo chính album không dùng được (ví dụ admin đã xoá album trong Google Photos) thì mới tạo album thay thế, ghi DB, rồi thử lại một lần.
- **Gửi nhiều ảnh một lúc**: các upload cùng kênh, cùng tài khoản chờ chung một lần tìm/tạo album, nên chỉ có một album. Drive cũng vậy: thư mục `zalobot/<kênh>` và từng thư mục `image`/`bill`… chỉ được tạo một lần.
- Drive không cần tra DB như Photos: quyền `drive.file` cho phép tìm thư mục do app tạo theo tên, nên vẫn tìm thư mục như cũ.

### 2.3. Lịch sử link (bảng `channel_storage_links`)

- Mỗi lần upload thành công, hệ thống ghi lại thư mục gốc Drive và album Photos, kèm **email tài khoản Google** và thời gian dùng. Album mới tạo được ghi ngay lúc tạo.
- Với Photos, bảng này không chỉ là lịch sử để xem mà còn là **nơi upload tra album** (mục 2.2). Xoá dòng album "Đang dùng" bị chặn trên dashboard; nếu xoá thẳng trong DB thì lần upload sau sẽ tạo album mới.
- Đổi tài khoản thì có thêm dòng mới; dòng cũ vẫn giữ nguyên.
- Khi chạy migration, link đang lưu trong cấu hình kênh được chép sang bảng này với email để trống (hiển thị là "Tài khoản cũ").

### 2.4. Trên dashboard (`/zca`)

- Ở cột thao tác, mở menu **⋯** rồi chọn mục xem thư mục Google Drive hoặc album Google Photos của kênh. Hộp thoại sẽ liệt kê mọi link của kênh:
  - Dòng **Đang dùng** (viền xanh) là nơi media mới sẽ vào.
  - Mỗi dòng ghi đường dẫn hoặc tên album, email tài khoản và khoảng thời gian dùng.
  - Bấm vào link Drive sẽ mở thẳng thư mục gốc của kênh, thấy ngay `bill`, `image`, `video`.
- Trang cấu hình của kênh (`/zca/thread?id=…`) cũng mở cùng hộp thoại này từ banner Drive/Photos.
- Hộp thoại được render thẳng vào `document.body` qua `createPortal`. Lý do: nó được mở từ một ô trong bảng có `whitespace-nowrap text-right`, và `<dialog>` dù nổi lên trên cùng màn hình vẫn kế thừa các style đó. Trước khi sửa, mô tả bị kéo thành một dòng dài và làm vỡ layout. **Quy tắc:** hộp thoại nào mở từ một dòng của bảng đều phải dùng portal để thoát khỏi ô đó.

### 2.4a. Thêm, sửa và xoá link

Ở đầu danh sách có nút **➕ Thêm link**. Nút này có ở cả hộp thoại Drive lẫn Photos và vẫn hiện khi kênh chưa có link nào. Mỗi dòng trong danh sách có hai nút **✏️ Sửa** và **🗑️ Xoá**.

- **Thêm link**: dùng để đưa vào danh sách một thư mục Drive hoặc album Photos **đã có sẵn trên Google** mà hệ thống chưa biết. Ví dụ: thư mục cũ từ trước khi có bảng lịch sử, hoặc thư mục nằm ở một tài khoản Google khác.
  - Form có **Đường link** (bắt buộc, đặt lên đầu), **Tên hiển thị** (để trống thì hiện đường link) và **Email tài khoản**. Quy tắc kiểm tra giống form Sửa.
  - **Không tạo gì trên Google, cũng không đổi nơi lưu media mới.** Muốn media mới vào thư mục/album khác thì đổi ô "Thư mục Google Drive riêng" / "Tên Album Google Photos riêng" trong cấu hình kênh. Lý do: nếu nút này tạo thư mục mới mà cấu hình kênh không đổi theo, thư mục đó cũng không thành "Đang dùng", dễ gây hiểu nhầm.
  - **Không cho thêm link trùng.** Hai link được coi là một khi giống nhau sau chuẩn hoá, hoặc cùng id thư mục/album (ví dụ `/drive/u/0/folders/ID` và `/drive/folders/ID`). Web báo lỗi ngay dưới ô link; nếu cùng lúc có người khác vừa thêm, API trả 409 và web hiện cùng thông báo đó.
  - Dòng thêm tay được lưu theo **id thư mục/album** trong link. Nhờ vậy, nếu sau này media được upload vào đúng chỗ đó thì hệ thống cập nhật luôn dòng này, không sinh thêm dòng thứ hai.
  - "Dùng từ … đến …" của dòng thêm tay bắt đầu từ **ngày thêm**, vì hệ thống không biết thư mục đó đã thật sự được dùng từ khi nào. Dòng mới nằm ngay dưới dòng "Đang dùng".

- **Sửa** (form ngay tại dòng):
  - **Tên hiển thị**: đặt tên dễ nhớ (ví dụ "Kho nhà 2025"). Tên lưu ở cột riêng `display_name`, upload sau **không ghi đè**. Để trống thì quay về đường dẫn thư mục / tên album.
  - **Đường link**: phải là `https`. Link Drive phải thuộc `drive.google.com`; link Photos thuộc `photos.google.com` hoặc `photos.app.goo.gl`. **Dòng đang dùng không sửa được link**, vì mỗi lần upload hệ thống sẽ ghi lại link đúng.
  - **Email tài khoản**: hay dùng để điền cho các dòng "Tài khoản cũ". Để trống thì quay lại là không rõ.
  - Web và API dùng chung một hàm kiểm tra (`validateChannelStorageLinkUpdate` trong contracts), nên lỗi hiện ngay dưới ô nhập mà không cần gọi server.
- **Xoá**: chỉ gỡ dòng khỏi danh sách trên dashboard. **Thư mục hoặc album trên Google vẫn giữ nguyên**, vì app không có quyền xoá và cũng không nên xoá. Có hỏi xác nhận trước khi xoá. **Dòng đang dùng không xoá được**: mở hộp thoại hoặc upload lần sau là hệ thống ghi lại ngay, nên xoá cũng vô ích.
- Một mục trong hộp thoại có thể gồm nhiều dòng trong DB có cùng link (dòng backfill + dòng có id thật). Sửa hoặc xoá sẽ áp dụng cho tất cả các dòng đó.
- Mọi thao tác thêm/sửa/xoá đều được ghi vào **nhật ký kiểm toán** (dữ liệu trước/sau, người thực hiện là admin).
- Form Thêm và form Sửa dùng chung component `StorageLinkForm` (`thread-storage-link-form.tsx`).
- API: `POST /api/zca/threads/:threadId/storage-links` (thêm), `PATCH` và `DELETE /api/zca/threads/:threadId/storage-links/:linkId` (chỉ admin), đều trả về danh sách mới để web cập nhật ngay. Thêm dùng hàm kiểm tra `validateChannelStorageLinkCreate` trong contracts, cũng dùng chung cho web và API.

### 2.5. Ảnh hoá đơn cũ

- API tải ảnh hoá đơn theo thứ tự: token tài khoản dùng chung → token người tạo giao dịch → **link công khai** của file. File được đặt sẵn quyền "ai có link cũng xem được" ngay khi upload.
- Vì vậy, sau khi đổi tài khoản, ảnh hoá đơn cũ vẫn hiện được. Không hiện được trong hai trường hợp: tài khoản Google cũ đã bị xoá, hoặc Google Workspace chặn chia sẻ công khai.

## 3. Năm nguyên nhân "lưu sai album / tạo album trùng" đã sửa

| Nguyên nhân | Cách sửa |
| --- | --- |
| 5 đường upload (ảnh hoá đơn gửi thẳng/quote, video gửi thẳng, ảnh chọn "lưu trữ", tạo bill từ ảnh chờ, video của bot chính thức) không truyền album của kênh nên rơi vào album mặc định chung cho mọi kênh | Upload bắt buộc nhận `ChannelStorageTarget` |
| Tài khoản dùng chung tự nhảy sang token vừa được làm mới (nhiều admin, hoặc một người có hai ID) | Ghim bằng `is_shared`, chỉ đổi khi đăng nhập |
| Tìm album chỉ đọc 50 album đầu, nên tạo album trùng tên | Đọc hết các trang (sau đó phát hiện bước tìm này không chạy được, xem dòng cuối) |
| Cache ID thư mục/album gắn với user, không gắn với tài khoản Google | Cache theo OAuth client, và client mới được tạo mỗi lần đăng nhập |
| **Tìm album trên Google luôn bị từ chối** vì app chỉ có quyền chỉ-ghi, nên cứ hụt cache là tạo album mới. Thêm ảnh lỗi bất kỳ (quá tải, lỗi tạm) cũng tạo album mới, và album mới này thành album đang dùng. Gửi nhiều ảnh cùng lúc thì mỗi ảnh tạo một album. | DB (`channel_storage_links`) là nguồn duy nhất của album; album được ghi DB ngay khi tạo; chỉ thay album khi Google báo chính album không dùng được; các upload đồng thời chờ chung một lần tạo (cả album lẫn thư mục Drive) |

- Các album trùng đã sinh ra trước bản sửa **không tự gộp được**: API Google Photos không có lệnh xoá album, và quyền chỉ-ghi không cho chuyển ảnh giữa các album. Cần gộp/xoá tay trong Google Photos nếu muốn. Upload mới sẽ dính vào album được dùng gần nhất của kênh; các dòng thừa trong hộp "Mở Photos" có thể xoá trên dashboard.
- Sau đó, **mọi chỗ hiện link album cũng đọc từ DB** theo đúng quy tắc trên, không hỏi Google và không bao giờ tạo album. App không còn gọi API lấy danh sách album ở bất kỳ đâu.
  - **Lệnh xem kho trên Zalo** (`/drive`, `/kho`, `/album`, hoặc hỏi "ảnh lưu ở đâu"): trước đây hiện 3 album chung `ZaloBot - Hóa đơn/Hình ảnh/Video` nên luôn báo "chưa có". Giờ chỉ còn **một dòng album của kênh**; kênh chưa có ảnh/video nào trên tài khoản đang dùng thì báo "album được tạo khi gửi ảnh/hóa đơn/video đầu tiên". Nếu tra album bị lỗi, tin nhắn vẫn gửi link Drive, chỉ thiếu dòng album.
  - Cũng trong lệnh này: kênh dùng **thư mục Drive riêng** chỉ hiện đúng thư mục đó. Trước đây lệnh vẫn liệt kê `zalobot/<id>/bill|image|video`, mà việc lấy link lại tự tạo thư mục, nên sinh ra 3 thư mục rỗng không ai dùng.
  - **`GET /api/photos/album-link` và `GET /api/photos/open`** (nút "📸 Photos ↗" trên web): trước đây ưu tiên link album lưu trong cấu hình kênh. Link này lưu theo kênh chứ không theo tài khoản, nên sau khi đổi tài khoản Google nó mở album của tài khoản cũ. Giờ endpoint đọc album của kênh trên tài khoản đang dùng từ DB; chưa có thì mở trang chủ Google Photos. Gọi mà không có kênh cũng mở trang chủ, vì không còn album chung.
- Còn tồn tại (chưa sửa): trên web, hàm `getThreadPhotosLink` (hộp đồng bộ media) vẫn ưu tiên link album trong cấu hình kênh trước khi gọi `/api/photos/open`. Link đó được ghi lại sau mỗi lần upload, nên chỉ sai trong khoảng ngay sau khi đổi tài khoản Google đến lần upload kế tiếp.

## 4. Vận hành và kiểm tra

- **Đổi tài khoản Google**: admin bấm **Đổi tài khoản** trên trang **Google Drive** (`/google-storage`) (hoặc gõ `/login` trên Zalo), chọn Gmail mới, rồi bấm Cho phép. Không cần khởi động lại API. Media mới sẽ vào Drive/Photos của tài khoản mới; mở dialog Drive/Photos sẽ thấy dòng mới ở trạng thái "Đang dùng", còn dòng cũ vẫn giữ.
- **Migration** `1724830000000-CreateChannelStorageLinks` và `1724840000000-AddDisplayNameToChannelStorageLinks` tự chạy khi API khởi động (`migrationsRun: true`). Rollback: `migration:revert`, mỗi lần gỡ một migration (lần đầu bỏ cột `display_name`, lần sau bỏ bảng `channel_storage_links` và cột `is_shared`); không đụng dữ liệu tài chính.
- Test liên quan: `channel-storage-link-update.spec.ts` (kiểm tra dữ liệu + sửa/xoá theo nhóm), `media-storage.service.spec.ts` (album từ DB, tạo một album cho nhiều upload đồng thời, thay album bị từ chối, thiếu email), `google-photos.service.spec.ts`, `google-drive.service.spec.ts` (tạo thư mục một lần khi upload đồng thời), `google-auth.service.spec.ts`, `channel-storage-links.mapper.spec.ts`, `receipt-source.spec.ts`, `zca.controller.spec.ts`.
- **Kiểm tra trên production sau khi deploy**: log API không còn dòng `Could not list albums from Google Photos`; mỗi kênh, mỗi tài khoản chỉ có một dòng `Created Google Photos album "<tên>"`. Nếu thấy `Replacing Google Photos album …` thì Google vừa từ chối album cũ (thường do album bị xoá). Nếu thấy `Could not record new Photos album …` (mức error) thì DB ghi lỗi và lần upload sau có thể tạo thêm một album.
- Không tự động kiểm chứng được upload thật lên Google và việc đổi tài khoản thật; cần thử trên môi trường thật.

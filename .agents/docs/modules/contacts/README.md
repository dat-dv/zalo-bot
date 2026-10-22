---
metadata:
  agent-artifact:
    id: docs-module-contacts
    type: documentation
    depends_on:
      - .agents/knowledge/modules/contacts/README.md
      - apps/web/src/modules/contacts/api/contacts-api.ts
      - apps/web/src/modules/contacts/api/contacts-query.ts
      - apps/web/src/modules/contacts/presentation/components/contacts-screen.tsx
      - apps/web/src/modules/contacts/presentation/components/combine-contacts-dialog.tsx
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.service.ts
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/finance/finance-contact-link.spec.ts
      - apps/api/src/database/entities/debt-contact.entity.ts
      - apps/api/src/finance/contact-user-sync.ts
      - apps/api/src/finance/contact-user-sync.service.ts
      - apps/api/src/users/users.service.ts
      - apps/api/src/finance/contact-profile.ts
      - apps/api/src/database/migrations/1724850000000-AddProfileFieldsToDebtContacts.ts
      - apps/web/src/modules/contacts/model/contact-profile-form.ts
      - apps/web/src/modules/contacts/view/contact-profile-screen.tsx
      - apps/web/src/modules/contacts/view/use-open-contact-profile.ts
      - apps/web/src/modules/contacts/presentation/components/contact-profile/profile-styles.ts
---

# Module danh bạ công nợ (contacts)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/contacts/README.md).

## Vai trò nghiệp vụ

**Danh bạ công nợ** là tập "người liên quan" riêng của mỗi người dùng — những người cho mượn, đi vay hoặc gắn với giao dịch. Trang `/contacts` giúp người dùng xem, sửa thông tin (số điện thoại, tài khoản ngân hàng...) và **gộp** các bản ghi trùng (ví dụ bot tạo "Trí" và "Trí Đen" cho cùng một người). Nơi chốn (quán, cửa hàng) **không** thuộc module này; chúng được quản lý ở `/places` trong module dashboard.

## API và cache

- `GET /api/contacts` (`ReportsController`): trả danh bạ công nợ **chung** của cả hệ thống (ai đăng nhập cũng thấy như nhau), sắp theo tên A→Z rồi ngày tạo mới nhất, tối đa 200 dòng. Mỗi liên hệ có: tên, biệt danh, mô tả (`descriptor`), số điện thoại, số tài khoản, mã/tên ngân hàng, avatar, `linkedUserId` và `linkedUser` (tài khoản Zalo được liên kết), `debtCount`, `transactionCount`, thời điểm tạo/cập nhật.
- `PATCH /api/contacts/:id`: sửa thông tin. `POST /api/contacts/combine`: gộp. `DELETE /api/contacts/:id`: xoá (có hook `useDeleteContactMutation` nhưng giao diện hiện **không** có nút xoá).
- Sau khi sửa/xoá: làm mới cache `contacts`, `users`, `debts`, `dashboard`. Sau khi gộp: thêm cả `transactions` và `expenses` vì giao dịch được trỏ sang người liên quan chính. `users` được làm mới để số "🔗 N người liên quan" trên trang ZCA luôn đúng.

## Màn hình danh bạ

- Tiêu đề trang, nút Làm mới/Đăng xuất do `WorkspaceHeader` của layout chung hiển thị; `ContactsScreen` chỉ render bảng.
- Các cột: chọn (checkbox), Tên (không ẩn được), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Ngân hàng, Tài khoản liên kết (chữ thường `Tên @username`, username màu nhạt, hoặc `#<mã>`), Tài nguyên (một dòng `N nợ · N giao dịch`, số nợ chữ vàng, chỉ hiện phần khác 0), Ngày tạo, Thao tác (rộng tối thiểu 120px, chỉ có nút Sửa).
- Dữ liệu hiển thị dạng chữ thường, **không** có link gọi điện hay Google Maps.
- **Bảng phẳng, mỗi ô một dòng** (cùng phong cách với bảng `/zca`): không dùng chip/pill hay emoji trong ô. Chữ dài bị cắt `…` thay vì xuống dòng, rê chuột vào ô để xem đầy đủ, hoặc nhấp đúp để sửa. Lý do: bảng cần lướt nhanh nhiều dòng, một mô tả dài không được làm cả hàng cao gấp ba.
- Sửa trực tiếp: nhấp đúp ô hoặc bấm Sửa để sửa Tên (bắt buộc), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Tên ngân hàng; `Enter` lưu, `Escape` huỷ. Admin còn thấy ô chọn **Tài khoản User** ở cột liên kết (có lựa chọn "Không liên kết"); xem mục "Liên kết với tài khoản User".
  - Hạn chế đã biết: để trống biệt danh/mô tả sẽ xoá giá trị cũ, nhưng để trống số điện thoại/ngân hàng thì backend **giữ nguyên** giá trị cũ (client gửi `undefined`), nên hiện không xoá được các trường này từ giao diện.
- Thanh công cụ: nút Gộp (khi chọn từ 2 dòng), chọn/bỏ chọn tất cả, chip số dòng đã chọn, ô tìm kiếm theo tên/biệt danh/mô tả.
- Trạng thái: đang tải, rỗng, lỗi kèm nút Thử lại, toast sau khi lưu/gộp (vị trí toast dùng chung `TOAST_POSITION`, trên điện thoại nằm ngay trên thanh tab dưới).
- **Trên điện thoại/tablet (≤ 960px)** bảng 11 cột không đọc được, nên `DataTable` chuyển sang danh sách hai dòng:
  - Dòng 1: **Tên (biệt danh)** bên trái, **số điện thoại** bên phải (màn này không có cột số dư nợ nên SĐT là thông tin cần nhìn nhanh nhất). Dòng 2: tài khoản Zalo đã gắn · số khoản nợ/giao dịch. Tài khoản Zalo không có username thì chỉ hiện tên (không hiện `@null`, áp dụng cả cột trên desktop).
  - Chạm một dòng để mở bottom-sheet có đủ các cột. Nút **Sửa** ở chân sheet là cách sửa trên màn cảm ứng (nhấp đúp chỉ tiện trên máy tính): bấm Sửa thì các ô trong sheet thành ô nhập 40px, chân sheet thành **Lưu** / ✕. Nút **Hồ sơ** cũng nằm ở chân sheet.
  - **Chọn để gộp**: cột checkbox bị bỏ ở chế độ này (trong sheet nó sẽ hiện nhãn "Chọn tất cả", gây hiểu nhầm). Thay vào đó chân sheet có nút **Chọn để gộp / ✓ Đã chọn**; dòng đã chọn có dấu ✓ trước tên. Khi chọn từ 2 người, nút **Gộp liên hệ (N)** xuất hiện ở thanh hành động cố định phía dưới (`MobileActionBar`) cho dễ bấm bằng ngón cái; nút trên thanh công cụ bị ẩn để không trùng.
- **Thanh công cụ trên điện thoại (≤ 640px)**: các nút Đồng bộ / Gộp / Chọn tất cả / Đã chọn N nằm trên **một hàng cuộn ngang** cao 40px, ô tìm kiếm chiếm nguyên một hàng riêng cao 40px. Nút ✕ đóng khung gợi ý và nút Gắn cũng cao 40px. Máy tính giữ nguyên giao diện cũ.

## Liên kết với tài khoản User

**Vì sao cần**: Người liên quan chỉ là một cái tên trong danh bạ công nợ chung. Liên kết cho biết "anh Trí trong sổ nợ chính là tài khoản Zalo X trong hệ thống" (`users.id`). Trang **Zalo & Người dùng** dùng liên kết này để hiện chiều ngược lại: một tài khoản đang là Người liên quan nào.

Quy tắc nghiệp vụ:

- **Chỉ admin được gắn hoặc bỏ gắn.** Muốn chọn user phải xem được toàn bộ danh sách user, mà danh sách này chỉ admin được xem. Nếu người dùng thường gửi `linkedUserId` (kể cả `null`), API trả **403**. Không gửi trường này thì liên kết giữ nguyên.
- **Trong danh bạ chung, mỗi tài khoản chỉ gắn với tối đa một Người liên quan.** Nếu trùng, API trả **409** kèm tên liên hệ đang giữ liên kết. Khi đó hãy dùng **Gộp liên hệ**, vì hai bản ghi này thực chất là cùng một người.
- Tài khoản được gắn phải tồn tại, nếu không API trả **400**. Danh bạ không có chủ nên được gắn với bất kỳ tài khoản nào, kể cả tài khoản đang thao tác.
- Bỏ liên kết: chọn "Không liên kết" rồi lưu, web sẽ gửi `linkedUserId: null`. Trước đây thao tác này không có tác dụng vì TypeORM lưu theo relation cũ đã nạp sẵn. Giờ backend gán cả cột lẫn relation.
- Bot **không** tự liên kết khi ghi nợ; liên kết chỉ được tạo trên web.
- **Lưu dự phòng số điện thoại.** Zalo thường ẩn số, nên khi liên hệ đã gắn với user thì hai bên bù số cho nhau, với nguyên tắc **chỉ điền vào chỗ trống, không bao giờ ghi đè**:
  - Lúc gắn: liên hệ chưa có số thì lấy số của user, và user chưa có số thì lấy số của liên hệ.
  - Khi số của user thay đổi (admin sửa trên trang ZCA, thêm user, hoặc bấm "Đồng bộ thông tin" từ ZCA): số mới được điền vào các liên hệ đã gắn mà còn trống số.
  - Nếu hai bên có hai số khác nhau thì hệ thống giữ cả hai, và cột Số điện thoại hiện thêm chữ vàng `· Zalo: <số>` (không có nền) ngay sau số để anh tự quyết định giữ số nào.

## Đồng bộ người dùng Zalo vào danh bạ

**Vì sao cần**: Danh sách user trước đây chỉ nằm ở trang ZCA. Tính năng này đưa từng người dùng Zalo vào danh bạ công nợ chung, để xem chung một bảng và lưu dự phòng số điện thoại của họ.

- Nút **"👥 Đồng bộ người dùng Zalo"** nằm trên thanh công cụ trang Contacts và chỉ admin thấy. Bấm bao nhiêu lần cũng không sinh trùng. Tính năng này không tự chạy khi tải trang, để một thao tác xem dữ liệu không âm thầm ghi dữ liệu.
- User được đưa vào **danh bạ chung**. Hệ thống chỉ bỏ qua tài khoản ZCA của bot (admin cũng được thêm như mọi người).
- Hệ thống xử lý từng user như sau:
  - **Đã có liên hệ gắn với user này:** chỉ đồng bộ số điện thoại.
  - **Có liên hệ chưa gắn trùng tên** (ví dụ anh đã có "Trí" trong sổ nợ): **không tạo mới, không tự gắn**, mà hiện trong khung **Gợi ý liên kết** để anh kiểm tra rồi bấm **Gắn**. Không tạo mới vì nếu có thêm một "Trí" nữa, câu "cho Trí mượn 30k" đang khớp đúng một người sẽ thành trùng tên và bot phải hỏi lại. Không tự gắn vì trùng tên chưa chắc là cùng một người.
  - **Còn lại:** tạo Người liên quan mới, gắn sẵn với user, kèm số điện thoại và avatar. Tên lấy theo thứ tự: tên đã lưu, rồi username, rồi `Zalo <4 số cuối ID>`.
- Sau khi chạy, toast báo "Đã thêm X · điền SĐT Y · Z gợi ý".
- Kiểm thử: `apps/api/src/finance/contact-user-sync.spec.ts`.
- Kiểm thử: `apps/api/src/finance/finance-contact-link.spec.ts`.

## Hồ sơ người liên quan (`/contacts/profile?id=…`)

### Hồ sơ là gì, vì sao lấy Người liên quan làm gốc

Anh cần một chỗ ghi lại mọi thứ biết về một người: thông tin liên lạc, ghi chú, và xem ngay họ đang nợ bao nhiêu. Trong hệ thống, một người có thể vừa là **Người liên quan** (danh bạ công nợ) vừa là **người dùng Zalo**. Mỗi người dùng Zalo chỉ gắn với tối đa một Người liên quan, nên "hồ sơ chung" chính là một Người liên quan cộng với tài khoản Zalo đã gắn (nếu có). Khoản nợ và giao dịch vốn đã gắn theo Người liên quan, nên lấy lịch sử ra rất tự nhiên.

### Dữ liệu lưu thêm

Bảng `debt_contacts` có thêm 7 cột (migration `1724850000000-AddProfileFieldsToDebtContacts`): ghi chú, ngày sinh, địa chỉ, nơi làm việc, quan hệ (Người nhà / Bạn bè / Đồng nghiệp / Đối tác / Khác), danh sách **SĐT phụ** và **tài khoản ngân hàng phụ** (kiểu `jsonb`, có nhãn như "Công ty", "Nhà").

- SĐT và tài khoản **chính** vẫn ở cột cũ. Bot, việc đồng bộ SĐT với người dùng Zalo và bảng danh bạ vẫn chỉ dùng số chính, nên không đổi hành vi. Số phụ chỉ để lưu và xem.
- Dùng `jsonb` thay vì bảng con vì danh sách ngắn, luôn đọc cùng hồ sơ và không cần tìm theo số phụ.
- Mỗi lần sửa đều được ghi vào nhật ký kiểm toán như mọi thay đổi khác.

### API

- `GET /api/contacts/:id/profile`: trả thông tin hồ sơ, tài khoản Zalo đã gắn, số liệu tóm tắt, danh sách khoản nợ gốc và 50 giao dịch gần nhất. Vai trò/quyền của tài khoản Zalo chỉ trả cho admin. Số liệu (còn cho vay, còn nợ, tổng thu, tổng chi) tính trên **toàn bộ** nợ gốc và giao dịch, không chỉ 50 dòng đang hiện. Chỉ tính nợ gốc vì khoản nợ đã gom đã chứa số của các khoản con.
- `PATCH /api/contacts/:id/profile`: chỉ sửa các trường hồ sơ mới. Trường không gửi thì giữ nguyên, gửi rỗng thì xoá. Tách riêng khỏi `PATCH /api/contacts/:id` vì API cũ bắt buộc có tên và sẽ xoá biệt danh/mô tả nếu không gửi.
- Quy tắc kiểm tra dùng chung giữa API và form (`validateContactProfileUpdate` trong contracts): ngày sinh phải là ngày có thật và không ở tương lai; SĐT phụ 8–15 chữ số; số tài khoản 6–20 chữ số; nhãn tối đa 40 ký tự; địa chỉ/nơi làm việc tối đa 200; ghi chú tối đa 5000; tối đa 10 dòng mỗi danh sách; dòng trống và dòng trùng tự bỏ.

### Màn hình

- Đầu trang: nút quay lại, avatar vuông, tên (biệt danh), mô tả, tài khoản Zalo đã gắn kèm trạng thái quyền (admin thấy thêm link sang trang Zalo & Người dùng).
- Dải 4 số liệu: đang cho vay còn lại, đang nợ còn lại, tổng thu, tổng chi (theo nút ẩn/hiện số tiền), kèm dòng "N khoản đang mở · N giao dịch".
- Máy tính: khối **Thông tin** bên trái, bảng **Khoản nợ** và **Giao dịch gần đây** bên phải. Điện thoại: xếp dọc. Trên điện thoại mọi nút và ô nhập của trang hồ sơ (khai báo chung ở `profile-styles.ts`) cao 40px để bấm chính xác, link quay lại cũng vậy; máy tính giữ cỡ nhỏ gọn cũ.
- Bấm **Sửa** thì khối Thông tin chuyển thành form ngay tại chỗ: sửa tên, biệt danh, mô tả, SĐT/tài khoản chính, thêm/xoá dòng SĐT và tài khoản phụ, ngày sinh, quan hệ, địa chỉ, nơi làm việc, ghi chú. Lỗi hiện ngay dưới từng ô. Khi lưu, phần tên/SĐT chính đi qua API sửa danh bạ cũ (chỉ khi có đổi), phần hồ sơ đi qua API mới. Hạn chế cũ vẫn còn: để trống SĐT/tài khoản chính thì giữ nguyên số cũ, không xoá được.
- Trạng thái: thiếu mã trong đường dẫn, đang tải, không tìm thấy (đã xoá hoặc đã gộp vào người khác), lỗi kèm Thử lại.

### Cách mở hồ sơ

- Bảng **Người liên quan**: nút **Hồ sơ** ở cột thao tác. Không dùng bấm vào tên vì nhấp đúp vào tên đang dùng để sửa nhanh.
- Trang **Zalo & Người dùng**: menu **⋯** của dòng người dùng có **Xem hồ sơ** (đã có Người liên quan gắn) hoặc **Tạo hồ sơ** (chưa có: hệ thống tạo Người liên quan mang tên và SĐT của người dùng, gắn với họ, rồi mở hồ sơ; chỉ admin làm được).

### Gộp liên hệ không làm mất hồ sơ

Khi gộp nhiều Người liên quan, liên hệ chính giữ dữ liệu hồ sơ của mình và:
- Ngày sinh, địa chỉ, nơi làm việc, quan hệ: chỉ lấy từ liên hệ nguồn nếu liên hệ chính đang trống, không ghi đè.
- Ghi chú của liên hệ nguồn được nối vào cuối, mỗi đoạn có dòng `— Gộp từ <tên>:`.
- SĐT/tài khoản phụ được hợp nhất và bỏ trùng; SĐT/tài khoản **chính** của liên hệ nguồn, nếu khác của liên hệ chính, được chuyển thành số phụ. Gộp không giới hạn 10 dòng để không mất số nào; lần sửa hồ sơ sau phải bớt xuống còn 10.

## Gộp liên hệ

- Dialog tự xếp hạng ứng viên làm **liên hệ chính**: ưu tiên liên hệ đã liên kết tài khoản Zalo → nhiều khoản nợ + giao dịch nhất → tạo sớm nhất. Người dùng có thể chọn liên hệ chính khác.
- Điền sẵn tên/biệt danh từ liên hệ chính, mô tả ghép từ mô tả của tất cả liên hệ được chọn, tài khoản liên kết lấy từ liên hệ chính hoặc bất kỳ liên hệ nào có.
- Ô chọn tài khoản liên kết chỉ hiện với admin (danh sách lấy từ `GET /api/users`, API chỉ dành cho admin). Người dùng thường không thấy ô này; khi gộp, backend tự kế thừa liên kết từ liên hệ nguồn nếu liên hệ chính chưa có.
- Ô "Gom nợ" (`consolidateDebts`) bật sẵn: sau khi gộp, các khoản nợ gốc cùng chiều và cùng loại tiền của liên hệ chính được gom thành một khoản nợ cha.
- Phía backend, thứ tự xử lý: cập nhật liên hệ chính (kế thừa số điện thoại, ngân hàng, avatar còn thiếu từ liên hệ nguồn) → chuyển nợ và giao dịch của liên hệ nguồn sang → xoá liên hệ nguồn → gom nợ nếu được chọn.
- **Lưu ý quan trọng**: thao tác gộp liên hệ **không** chạy trong một database transaction duy nhất. Nếu lỗi giữa chừng (ví dụ khi gom nợ), các bước trước đó đã được lưu. Mỗi lần gom nợ (`combineDebts`) thì có transaction riêng.

- Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo).
- Trên điện thoại dialog gộp mở **toàn màn hình** (form dài: danh sách ứng viên, 3 ô nhập, ô chọn tài khoản, ô gom nợ, cảnh báo). Phần thân và danh sách ứng viên không còn tự cuộn riêng (`max-h` + `overflow-y-auto` bị tắt ở ≤ 640px) vì cuộn lồng nhau trên màn cảm ứng rất khó dùng; chỉ khung dialog cuộn. Ô nhập 40px, nút Huỷ/Gộp ở chân dính và chia đều chiều rộng.

## Kiểm thử

`npm run typecheck`, `npm run lint`, `npm run build` (scope `--workspace @zalobot/web`).

## Bo góc

- Nút, ô nhập, thẻ/panel và khung dialog trong module này dùng `rounded-[3px]` (tối đa `rounded`, 4px), không dùng `rounded-lg/xl/2xl`. Lý do: giao diện dashboard theo phong cách gọn, sắc cạnh như công cụ quản trị; bo lớn làm các ô trông như app tiêu dùng và lệch với phần còn lại. `rounded-full` chỉ dành cho avatar, chấm trạng thái, công tắc, vòng quay tải và thanh tiến độ. Xem [web-ui-direction](../../global/web-ui-direction.md).

## Màu nút ở dark mode

- Ở dark mode, nút hành động chính dùng tông xanh sky (`dark:bg-sky-600 dark:text-white`), không dùng kiểu đảo màu `dark:bg-slate-100` vì nó thành khối trắng chói trên nền tối. Trong module này áp dụng cho `PRIMARY_BUTTON` của trang hồ sơ, nút xác nhận gộp, nút tạo trên toolbar/thanh hành động mobile và nút chính trong dòng; toast dùng tông toast tối. Light mode giữ nút đen như cũ. Xem [web-ui-direction](../../global/web-ui-direction.md).

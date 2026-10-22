---
metadata:
  agent-artifact:
    id: docs-global-finance-domain
    type: documentation
    depends_on:
      - .agents/knowledge/global/finance-domain.md
      - apps/api/src/finance/finance.service.ts
      - apps/api/src/finance/transaction-item.mapper.ts
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/finance/receipt-source.ts
      - apps/api/src/database/migrations/1724780000000-AddSharedLedgerAndTransactionCreator.ts
      - apps/api/src/database/migrations/1724790000000-RemoveFinanceUserScope.ts
---

# Nghiệp vụ tài chính (Backend)

Tài liệu này ánh xạ với tri thức canonical [`finance-domain.md`](../../knowledge/global/finance-domain.md). Phần giao diện web (bảng giao dịch, modal phân bổ, trang phân tích) được mô tả trong tài liệu module dashboard.

## 1. Phạm vi và lý do tồn tại

`apps/api/src/finance` là phần lõi nghiệp vụ Thu–chi và Công nợ của bot. Toàn hệ thống chỉ có **một kho tài chính chung**: ai đăng nhập dashboard hay nhắn bot (đã được cấp quyền) cũng xem và thao tác trên toàn bộ dữ liệu. Đây là module backend thuần, không có module `finance` bên web.

## 1a. Một kho tài chính chung (không chia theo người dùng)

**Vì sao?** Gia đình/nhóm dùng chung một quỹ chi tiêu. Trước đây mỗi bảng tài chính có cột `user_id` và mọi truy vấn lọc theo người đang thao tác, nên khoản Diệu Hằng ghi không hiện trên dashboard của Văn Đạt; thêm vào đó một người có nhiều ID Zalo (ID webhook dạng hex, UID ZCA dạng số) khiến dữ liệu bị xé ra nhiều "sổ". Phương án "chủ sổ" từng được thử nhưng vẫn để lọt trường hợp chưa chọn chủ sổ, nên đã **bỏ hẳn**.

- Các bảng `finance_transactions`, `finance_places`, `debt_contacts`, `debts`, `debt_payments`, `debt_payment_allocations`, `user_categories` **không còn cột `user_id`**. `FinanceService` không nhận tham số người dùng và không lọc theo người dùng. Không còn cột `users.is_ledger_owner`, không còn khối "Sổ thu chi chung" trên trang "Zalo & Users".
- **Người tạo** giao dịch chỉ để hiển thị (ai ghi, ghi từ đâu), không bao giờ dùng để lọc.
- **Vẫn theo từng người** (không phải dữ liệu tài chính): nhắc nhở, Google Tasks/Calendar, upload Drive/Photos (dùng token Google của người gửi), thẻ xác nhận chờ duyệt, quyền admin.
- API tài chính trên dashboard vẫn **bắt buộc đăng nhập** (thiếu token → 401); đăng nhập chỉ để xác thực, không để giới hạn dữ liệu.
- Nhật ký kiểm toán: `actor_id` của dòng tài chính lấy theo người tạo, nên mục "Hoạt động gần đây" vẫn thấy giao dịch mình ghi.

### Migration gộp dữ liệu cũ (`1724790000000-RemoveFinanceUserScope`)
Chạy tự động một lần khi API khởi động, trong **một transaction DB**:
1. Điền **người tạo** cho giao dịch cũ bằng `user_id` cũ của chính nó.
2. Gộp bản ghi trùng giữa các sổ cũ: nơi chốn trùng tên chuẩn hoá; người liên quan trùng tên + biệt danh (bản giữ lại là bản tạo sớm nhất, được bù số điện thoại/avatar/liên kết tài khoản còn thiếu, không ghi đè); danh mục trùng loại + tên. Giao dịch và công nợ được trỏ về bản giữ lại.
3. Mỗi tài khoản chỉ còn liên kết với tối đa một người liên quan (giữ liên kết sớm nhất).
4. Ghi một dòng nhật ký kiểm toán chứa số lượng của từng sổ cũ, rồi xoá cột `user_id` và `users.is_ledger_owner`; tên nơi chốn trở thành duy nhất toàn hệ thống.

**Không hoàn tác được**: `down()` chỉ thêm lại cột rỗng. Trước khi deploy phải sao lưu DB (`pg_dump`); muốn quay lại thì khôi phục bản sao lưu và deploy commit cũ.

## 1b. Người tạo và ảnh hoá đơn

- Mỗi giao dịch lưu **người tạo** (`created_by_user_id`, tên lúc tạo `created_by_name`), **nguồn** (`zalo` / `dashboard`) và **kênh Zalo** (`source_chat_id`). Trên dashboard hiện tên hiện tại của người tạo và "Nhóm <tên>" / "Chat riêng" / "Dashboard". Giao dịch cũ được migration điền người tạo từ `user_id` cũ; nếu không tra được tên thì hiện "—".
- **Ảnh hoá đơn** xem qua `GET /api/transactions/:id/receipt` (mọi người dùng đã đăng nhập đều xem được): API tự tải ảnh từ Drive (lần lượt thử token tài khoản Google dùng chung → token người tạo → link công khai của file, nên đổi tài khoản Google vẫn xem được ảnh cũ), hoặc tải từ CDN Zalo, rồi trả về trình duyệt. Link Drive gốc là riêng tư nên web không dùng trực tiếp. Chỉ chấp nhận host Drive và CDN Zalo (chống SSRF), tối đa 10MB, chỉ trả về nội dung ảnh. Lỗi (token Google hết hạn, file bị xoá) → web hiện "Không tải được ảnh".
- Lệnh xoá "giao dịch vừa tạo" qua chat ưu tiên giao dịch của chính người nhắn, không xoá nhầm của thành viên khác.

## 2. Các khái niệm chính

- **Giao dịch** (`finance_transactions`): khoản thu hoặc chi, số tiền là số nguyên dương VND, bắt buộc có ghi chú. Danh mục mặc định `Khác`, thời điểm mặc định là lúc ghi.
- **Nơi chốn** (`finance_places`): cửa hàng, quán, địa điểm phát sinh giao dịch. Nơi chốn khác hoàn toàn với người liên quan trong danh bạ công nợ. Mỗi người dùng không thể có hai nơi chốn trùng tên sau chuẩn hoá (bỏ dấu, chữ thường, gom khoảng trắng) — "Highlands Coffee" và "highlands  coffee" là một.
- **Người liên quan** (`debt_contacts`): người cho vay/đi vay. Tra cứu bằng tên (và biệt danh) đã chuẩn hoá, so khớp chính xác. Bảng này cũng lưu các trường **Hồ sơ** (ghi chú, ngày sinh, địa chỉ, nơi làm việc, quan hệ, SĐT/tài khoản phụ), xem [module contacts](../modules/contacts/README.md#hồ-sơ-người-liên-quan-contactsprofileid).
- **Khoản nợ** (`debts`): phải thu (`receivable`) hoặc phải trả (`payable`), có số ban đầu, số còn lại và trạng thái `active`/`settled`. Khoản nợ có thể là con của một khoản nợ cha khi được gộp.
- **Thanh toán nợ** (`debt_payments`) và **phân bổ** (`debt_payment_allocations`): ghi nhận tiền đã trả cho một khoản nợ, hoặc phần tiền của một giao dịch được dùng để trả nợ.

**Vì sao xoá nơi chốn/người liên quan không làm mất lịch sử?** Khoá ngoại `place_id`, `contact_id` dùng `ON DELETE SET NULL`: giao dịch vẫn còn, chỉ mất liên kết.

## 3. Quy tắc nghiệp vụ quan trọng

### 3.1 Giao dịch
- **Danh sách** `GET /api/transactions`: lọc theo kỳ (`startAt`/`endAt`), loại, từ khoá (danh mục, ghi chú, tên nơi chốn), và lọc theo cột: danh mục (`categories`), ghi chú chứa (`note`), nơi chốn (`placeIds`, `none` = không có nơi chốn), người tạo (`createdByUserIds`), có/không ảnh (`hasReceipt`), khoảng tiền (`amountMin`/`amountMax`). Tham số dạng danh sách gửi lặp key (`?categories=a&categories=b`), tối đa 50 giá trị; mọi điều kiện kết hợp kiểu VÀ. Phân trang `limit` (mặc định 100, tối đa 500) + `offset`; tham số sai trả 400. Mỗi dòng có `runningBalance` = số dư ví ngay sau giao dịch đó, tính trên **toàn bộ** sổ theo thứ tự thời gian, nên không đổi dù đang lọc hay đang ở trang nào. Kèm `summary` (tổng thu/chi của cả kỳ, không phụ thuộc loại/từ khoá/bộ lọc cột), `facets` (danh sách người tạo và danh mục có trong kỳ — làm lựa chọn cho bộ lọc, cũng không co lại theo bộ lọc) và `ledgerBalance` (tổng thu − tổng chi toàn thời gian — con số dùng để cân chỉnh số dư).
- Khi tạo/sửa, có thể truyền `placeId` (phải là nơi chốn đang tồn tại) hoặc `placeName` (tự tìm hoặc tạo mới). Truyền `placeId: null` để gỡ nơi chốn.
- Không được đổi loại thu/chi khi giao dịch đang có phân bổ công nợ; không được giảm số tiền xuống dưới tổng đã phân bổ.
- **Xoá giao dịch**: nếu có phân bổ, hệ thống cộng trả lại số còn lại cho từng khoản nợ, xoá phân bổ và các bản ghi thanh toán liên kết rồi mới xoá giao dịch. Lưu ý: luồng này không chạy trong một transaction DB và không tính lại trạng thái `settled` của khoản nợ.

### 3.2 Phân bổ giao dịch vào công nợ
- Khoản thu chỉ trả cho nợ phải thu, khoản chi chỉ trả cho nợ phải trả. Nếu giao dịch đã gắn người liên quan thì chỉ gợi ý nợ của người đó.
- `POST /api/transactions/:id/allocations` **thay thế toàn bộ** bộ phân bổ cũ: hoàn lại phân bổ cũ, kiểm tra tổng không vượt số tiền giao dịch, không trùng khoản nợ, không vượt số còn lại, rồi ghi phân bổ + thanh toán mới. Tất cả trong một transaction DB nên lỗi giữa chừng không làm lệch số liệu.

### 3.3 Gộp (combine)
- **Gộp nơi chốn** (`POST /api/places/combine`): chọn nơi chính (chỉ định, hoặc nơi nhiều giao dịch nhất rồi cũ nhất), chuyển giao dịch sang, xoá nơi phụ. Tên mới không được trùng một nơi chốn ngoài nhóm gộp.
- **Gộp người liên quan** (`POST /api/contacts/combine`): ưu tiên người đã liên kết tài khoản Zalo, rồi người có nhiều nợ + giao dịch nhất, rồi người tạo sớm nhất. Người chính thừa hưởng số điện thoại, tài khoản ngân hàng, avatar còn thiếu. Nợ và giao dịch được chuyển sang. Tuỳ chọn `consolidateDebts` gộp tiếp các khoản nợ cùng chiều, cùng tiền tệ. **Lưu ý:** gộp người liên quan không nằm trong một transaction DB; nếu lỗi giữa chừng có thể phải xử lý dữ liệu thủ công.
- **Gộp khoản nợ** (`POST /api/debts/combine`): cần ít nhất 2 khoản cùng chiều và cùng tiền tệ; tạo khoản nợ cha với tổng số tiền, các khoản cũ trở thành con. Chạy trong transaction.

### 3.4 Thanh toán nợ
- Endpoint đúng: `GET/POST /api/debts/:id/payments`, `DELETE /api/debts/:id/payments/:paymentId`.
- Ghi nhận thanh toán chỉ áp dụng cho khoản đang mở và không vượt số còn lại; hệ thống tự sinh một giao dịch dòng tiền (`Thu hồi nợ` là khoản thu, `Trả nợ` là khoản chi) để số dư ví phản ánh đúng.
- Đợt trả lưu `financeTransactionId` trỏ tới giao dịch tự sinh đó (đợt trả cũ không được bổ sung liên kết).
- Xoá thanh toán hoàn lại số còn lại, mở lại khoản nợ, tính lại khoản nợ cha và xoá luôn giao dịch liên kết, nên sổ thu–chi không còn giao dịch mồ côi.
- Web gọi qua hằng route động `API_ROUTES.debtPayments(debtId)` và `API_ROUTES.debtPaymentDetail(debtId, paymentId)`.

### 3.5 Danh mục
- Danh mục dùng chung cho cả hệ thống. Lần đầu gọi `GET /api/categories` mà chưa có danh mục nào, hệ thống tự gieo bộ mặc định từ `@zalobot/contracts`.
- Tên danh mục là duy nhất theo loại. Giao dịch lưu danh mục dạng chữ, không phải khoá ngoại, nên đổi tên danh mục không tự đổi giao dịch cũ.

### 3.6 Điều chỉnh số dư
Không có API riêng. Danh mục `Điều chỉnh số dư` có sẵn ở cả hai loại. Web tạo một giao dịch thường: chênh lệch dương là khoản thu, âm là khoản chi. Cách này giữ được lịch sử dòng tiền thay vì sửa trực tiếp con số.

### 3.7 Phân tích
`GET /api/finance/analytics` trả tổng thu/chi, tỷ lệ tiết kiệm, vị thế hiện tại (số dư toàn thời gian + phải thu − phải trả), xu hướng theo khung (`week`: 7 ngày T2–CN, `month`: 6 khoảng ngày, `quarter`: 3 tháng, còn lại: 12 tháng), phân bổ danh mục tách riêng thu/chi và top người nợ/chủ nợ.

## 4. Tích hợp chat Zalo

- Câu "ăn trưa 45k ở Highlands" → LLM gọi tool `RECORD_TRANSACTION` → bot gửi thẻ xác nhận. Nếu nơi chốn chưa tồn tại, bot gửi **thêm một thẻ riêng** `CREATE_PLACE`. Duyệt giao dịch thì thẻ nơi chốn tự thu hồi và nơi chốn vẫn được tạo khi lưu giao dịch.
- `CREATE_PLACE`, `DELETE_TRANSACTION`, `MANAGE_DEBT`, `GET_REPORT` là các tool liên quan khác. Không có tool LLM cho phân bổ, người liên quan, danh mục hay gộp — các thao tác này chỉ làm trên dashboard.
- Câu có nhiều giao dịch: LLM trả nhiều tool call, chạy lần lượt. Bot **không gộp** tool call; `propagateSharedTransactionContext` chỉ điền thời gian/nơi chốn/phương thức thanh toán dùng chung cho các giao dịch còn thiếu.
- `MANAGE_DEBT`: trước khi gửi thẻ, bot tra **danh bạ công nợ** theo tên (và biệt danh nếu người dùng nêu) bằng so khớp chính xác. Đúng 1 người → thẻ gắn `contactId`; không có ai → thẻ đánh dấu `createNewContact` để tạo người mới khi duyệt; trùng tên nhiều người → bot không tạo thẻ mà liệt kê `Tên (biệt danh)` và nhờ nhắn lại kèm biệt danh. Lý do: `createDebt` chỉ nhận khoản nợ khi đã chọn người hoặc xác nhận tạo người mới, tránh ghi nhầm người trùng tên.
- Lệnh nhanh `/finance` (thu–chi hôm nay) và `/debts` (nợ đang mở) đọc trực tiếp, không qua LLM.

## 5. Kiểm thử
`npm run test --workspace @zalobot/api` (bao gồm `apps/api/src/finance/finance.service.spec.ts`).

---
metadata:
  agent-artifact:
    id: docs-global-finance-domain
    type: documentation
    depends_on:
      - .agents/knowledge/global/finance-domain.md
      - apps/api/src/finance/finance.service.ts
      - apps/api/src/finance/finance.controller.ts
---

# Nghiệp vụ tài chính (Backend)

Tài liệu này ánh xạ với tri thức canonical [`finance-domain.md`](../../knowledge/global/finance-domain.md). Phần giao diện web (bảng giao dịch, modal phân bổ, trang phân tích) được mô tả trong tài liệu module dashboard.

## 1. Phạm vi và lý do tồn tại

`apps/api/src/finance` là phần lõi nghiệp vụ Thu–chi và Công nợ của bot. Mọi dữ liệu luôn gắn với đúng một người dùng (lấy từ access token dashboard hoặc người gửi tin Zalo), nên không có API nào cho phép đọc hay sửa dữ liệu của người khác. Đây là module backend thuần, không có module `finance` bên web.

## 2. Các khái niệm chính

- **Giao dịch** (`finance_transactions`): khoản thu hoặc chi, số tiền là số nguyên dương VND, bắt buộc có ghi chú. Danh mục mặc định `Khác`, thời điểm mặc định là lúc ghi.
- **Nơi chốn** (`finance_places`): cửa hàng, quán, địa điểm phát sinh giao dịch. Nơi chốn khác hoàn toàn với người liên quan trong danh bạ công nợ. Mỗi người dùng không thể có hai nơi chốn trùng tên sau chuẩn hoá (bỏ dấu, chữ thường, gom khoảng trắng) — "Highlands Coffee" và "highlands  coffee" là một.
- **Người liên quan** (`debt_contacts`): người cho vay/đi vay. Tra cứu bằng tên (và biệt danh) đã chuẩn hoá, so khớp chính xác.
- **Khoản nợ** (`debts`): phải thu (`receivable`) hoặc phải trả (`payable`), có số ban đầu, số còn lại và trạng thái `active`/`settled`. Khoản nợ có thể là con của một khoản nợ cha khi được gộp.
- **Thanh toán nợ** (`debt_payments`) và **phân bổ** (`debt_payment_allocations`): ghi nhận tiền đã trả cho một khoản nợ, hoặc phần tiền của một giao dịch được dùng để trả nợ.

**Vì sao xoá nơi chốn/người liên quan không làm mất lịch sử?** Khoá ngoại `place_id`, `contact_id` dùng `ON DELETE SET NULL`: giao dịch vẫn còn, chỉ mất liên kết.

## 3. Quy tắc nghiệp vụ quan trọng

### 3.1 Giao dịch
- Khi tạo/sửa, có thể truyền `placeId` (phải là nơi chốn của chính mình) hoặc `placeName` (tự tìm hoặc tạo mới). Truyền `placeId: null` để gỡ nơi chốn.
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
- Xoá thanh toán hoàn lại số còn lại, mở lại khoản nợ và tính lại khoản nợ cha.
- **Lỗi đã biết:** contracts khai báo `API_ROUTES.debtPayments = '/api/debts/payments'` nhưng backend không có route này.

### 3.5 Danh mục
- Lần đầu gọi `GET /api/categories`, nếu người dùng chưa có danh mục nào, hệ thống tự gieo bộ mặc định từ `@zalobot/contracts`.
- Tên danh mục là duy nhất theo người dùng + loại. Giao dịch lưu danh mục dạng chữ, không phải khoá ngoại, nên đổi tên danh mục không tự đổi giao dịch cũ.

### 3.6 Điều chỉnh số dư
Không có API riêng. Danh mục `Điều chỉnh số dư` có sẵn ở cả hai loại. Web tạo một giao dịch thường: chênh lệch dương là khoản thu, âm là khoản chi. Cách này giữ được lịch sử dòng tiền thay vì sửa trực tiếp con số.

### 3.7 Phân tích
`GET /api/finance/analytics` trả tổng thu/chi, tỷ lệ tiết kiệm, vị thế hiện tại (số dư toàn thời gian + phải thu − phải trả), xu hướng theo khung (`week`: 7 ngày T2–CN, `month`: 6 khoảng ngày, `quarter`: 3 tháng, còn lại: 12 tháng), phân bổ danh mục tách riêng thu/chi và top người nợ/chủ nợ.

## 4. Tích hợp chat Zalo

- Câu "ăn trưa 45k ở Highlands" → LLM gọi tool `RECORD_TRANSACTION` → bot gửi thẻ xác nhận. Nếu nơi chốn chưa tồn tại, bot gửi **thêm một thẻ riêng** `CREATE_PLACE`. Duyệt giao dịch thì thẻ nơi chốn tự thu hồi và nơi chốn vẫn được tạo khi lưu giao dịch.
- `CREATE_PLACE`, `DELETE_TRANSACTION`, `MANAGE_DEBT`, `GET_REPORT` là các tool liên quan khác. Không có tool LLM cho phân bổ, người liên quan, danh mục hay gộp — các thao tác này chỉ làm trên dashboard.
- Câu có nhiều giao dịch: LLM trả nhiều tool call, chạy lần lượt. Bot **không gộp** tool call; `propagateSharedTransactionContext` chỉ điền thời gian/nơi chốn/phương thức thanh toán dùng chung cho các giao dịch còn thiếu.
- **Lỗi đã biết:** thẻ `MANAGE_DEBT` không mang `contactId` hay `createNewContact`, nên khi duyệt `createDebt` sẽ từ chối.
- Lệnh nhanh `/finance` (thu–chi hôm nay) và `/debts` (nợ đang mở) đọc trực tiếp, không qua LLM.

## 5. Kiểm thử
`npm run test --workspace @zalobot/api` (bao gồm `apps/api/src/finance/finance.service.spec.ts`).

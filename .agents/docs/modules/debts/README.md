---
metadata:
  agent-artifact:
    id: docs-module-debts
    type: documentation
    depends_on:
      - .agents/knowledge/modules/debts/README.md
      - apps/web/src/modules/debts/api/debts-api.ts
      - apps/web/src/modules/debts/api/debts-query.ts
      - apps/web/src/modules/debts/presentation/components/debts-screen.tsx
      - apps/web/src/modules/debts/presentation/components/debts-table.tsx
      - apps/web/src/modules/debts/presentation/components/combine-debts-dialog.tsx
      - apps/web/src/modules/debts/presentation/components/create-debt-dialog.tsx
      - apps/web/src/modules/debts/model/debt-create-form.ts
      - apps/web/src/shared/ui/form-dialog.tsx
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/finance/finance.service.ts
      - packages/contracts/src/index.ts
---

# Module công nợ (debts)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/debts/README.md).

## Vai trò nghiệp vụ

Trang `/debts` cho người dùng theo dõi **khoản phải thu** (người khác nợ mình) và **khoản phải trả** (mình nợ người khác), cả đang mở lẫn đã tất toán. Khoản nợ chỉ hoàn tất khi **số còn lại** bằng 0. Người dùng có thể thêm khoản nợ mới, sửa nhanh, xoá, trả hết một khoản, xem lịch sử các đợt trả và gộp nhiều khoản nợ thành một khoản nợ cha.

## API và cache

- `GET /api/debts`: trả khoản nợ của người đang đăng nhập, sắp theo ngày phát sinh mới nhất → ngày tạo → id (giảm dần), **tối đa 200 bản ghi**, kèm danh sách đợt trả và khoản con. API hỗ trợ `?status=active|settled` nhưng web không dùng — lọc trạng thái làm ở phía client.
- Khoản nợ thiếu `occurredAt` (dữ liệu cũ) dùng `createdAt` thay thế.
- Khoản con xuất hiện cả như một bản ghi riêng (có `parentDebtId`); bảng chỉ hiện khoản gốc/khoản cha, còn khoản con nằm trong panel mở rộng của khoản cha.
- `POST /api/debts` tạo khoản nợ, `DELETE /api/debts/:id` xoá khoản nợ.
- Mọi mutation (thêm, sửa, xoá, trả nợ, xoá đợt trả, gộp) làm mới cache `debts` và `dashboard`; thêm và xoá còn làm mới `contacts` vì thêm nợ có thể tạo người liên quan mới. Nút Thử lại trên màn hình làm mới `debts` và `contacts`.

## Màn hình công nợ

- Tiêu đề trang do `WorkspaceHeader` của layout chung hiển thị.
- **Thẻ KPI**: tổng phải thu và tổng phải trả đang mở (chỉ tính khoản gốc để không cộng trùng khoản con), tuân theo chế độ ẩn/hiện số tiền (hook `useMoneyFormatter()` lấy từ store Zustand dùng chung `apps/web/src/shared/store/money-visibility-store.ts`; bảng và hộp thoại gộp nợ cũng dùng hook này nên mặc định đều ẩn số tiền).
- **Bộ lọc**: trạng thái (Tất cả / Đang mở / Đã tất toán, có số đếm), chiều nợ (Tất cả / Cho vay / Đi vay), tìm kiếm theo người liên quan, biệt danh, ghi chú (tìm cả trong khoản con).
- **Bảng** (`DebtsTable`, `id="debts"`): chọn, Trạng thái, Chiều nợ, Người liên quan (có nút mở rộng ▶/▼), Số tiền gốc, Số còn lại (thanh tiến độ nhỏ + tooltip khi đã trả một phần), Tiền tệ, Hạn trả, Ngày tất toán, Ghi chú, Thao tác. Các cột Trạng thái, Người liên quan, Số còn lại, Thao tác không ẩn được.
- **Sửa trực tiếp** (nhấp đúp hoặc ✎, `Enter`/`Escape`): chiều nợ, người liên quan (gợi ý từ danh bạ công nợ), số tiền gốc, số còn lại, ghi chú, hạn trả. Ngày phát sinh hiện **không** sửa được trên giao diện (API vẫn hỗ trợ).
- **Trả nhanh (+)**: chỉ có ở khoản đang mở, luôn trả **toàn bộ** số còn lại.
- **Panel mở rộng**: bảng nhỏ các khoản con và bảng lịch sử đợt trả (số tiền, ngày, ghi chú, biểu tượng 🔗 nếu đợt trả đến từ phân bổ giao dịch, nút xoá). Xoá đợt trả có hộp `window.confirm` xác nhận.
- **Gộp nợ**: chọn từ 2 khoản gốc → `CombineDebtsDialog` (ghi chú, hạn trả). Nếu chọn lệch chiều nợ hoặc lệch loại tiền, dialog báo lỗi và khoá nút xác nhận.
- **Thêm khoản nợ** (nút `+ Thêm khoản nợ` trên toolbar desktop, hoặc thanh hành động dưới cùng trên điện thoại) mở `CreateDebtDialog`: chọn chiều nợ (mặc định Cho vay), người liên quan (gợi ý từ danh bạ), số tiền (> 0), ngày phát sinh (mặc định là lúc mở form), hạn trả (tuỳ chọn), ghi chú.
  - Vì **danh bạ công nợ dùng chung** và tra cứu bằng tên/biệt danh khớp chính xác, nếu tên gõ vào khớp một người có sẵn thì form gửi đúng mã người đó (`contactId`).
  - Nếu tên không khớp ai, form **không tự tạo người mới**: phải tick ô "Tạo người liên quan mới «tên»" (có thể nhập thêm biệt danh) thì nút Lưu mới bật. Lý do: tránh vô tình tạo người trùng tên khi người dùng gõ sai chính tả; đồng thời API cũng từ chối khi không có `contactId` hay `createNewContact`.
  - Logic khớp tên và dựng request nằm trong hàm thuần `model/debt-create-form.ts` (có unit test), dùng chung với ô người liên quan khi sửa trực tiếp.
- **Xoá khoản nợ** (nút ✕ ở cột Thao tác, hoặc chân sheet trên điện thoại) mở hộp xác nhận `ConfirmDialog` nêu tên người và số tiền gốc, kèm cảnh báo nếu khoản nợ đã có đợt trả hoặc là khoản cha đã gộp (xem quy tắc backend bên dưới).
- Trang chủ dùng lại `DebtsTable` ở chế độ chỉ đọc.

- `CombineDebtsDialog`: Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo).

## Trên điện thoại / màn hình hẹp

Giao diện desktop (> 960px) giữ nguyên. Trên màn hình hẹp, bảng công nợ quá rộng để đọc, nên chuyển thành danh sách giống ứng dụng:

- **Mỗi dòng** (`DebtsTable`, cả ở Trang chủ): dòng 1 là người liên quan (kèm biệt danh) và **số còn lại** bên phải — cùng màu với cột trên desktop (xanh = phải thu, cam = phải trả, xám khi đã hết) và bị che khi đang ẩn số tiền. Dòng 2: chiều nợ · trạng thái · hạn trả · "Đã trả x%" nếu đã trả một phần. Chiều nợ đứng trước vì đó là điều người dùng cần biết đầu tiên.
- **Chạm vào dòng** mở bottom-sheet có đủ mọi cột. Nút **Sửa** ở chân sheet chuyển các ô thành ô nhập cao 40px (kể cả ô chọn ngày hạn trả); trên điện thoại không có nhấp đúp nên đây là đường sửa duy nhất. Lưu/✕ cũng nằm ở chân sheet.
- **Khoản con và lịch sử đợt trả** trong sheet hiện thành danh sách phẳng 2 dòng thay vì bảng lồng phải cuộn ngang; mỗi đợt trả có nút xoá 40×40px (vẫn hỏi xác nhận). Nút mở rộng ▶ bị ẩn vì sheet luôn hiện phần chi tiết.
- **Chọn để gộp**: dòng danh sách là một nút bấm nên không đặt được checkbox. Cách đơn giản nhất: chân sheet có nút **Chọn / Bỏ chọn**; dòng đã chọn có dấu `✓` trước tên. Chip "Chọn tất cả" và chip "Đã chọn n ✕" trên thanh công cụ vẫn dùng được. Thanh hành động cố định phía trên thanh tab luôn có đúng một nút: **Gộp** khi chọn từ 2 khoản, còn lại là **+ Thêm khoản nợ** (các nút tương ứng trên toolbar bị ẩn để không trùng). Chân sheet có thêm nút **✕ Xoá**.
- **Thanh công cụ (≤ 640px)**: không còn cuộn ngang. Trạng thái (Tất cả / Đang mở / Đã tất toán) và chiều nợ (Tất cả / Cho vay / Đi vay) là **2 hàng, mỗi hàng 3 nút đều nhau** cao 40px; nút "Tất cả" dùng nhãn ngắn vì đã nằm trong nhóm, desktop vẫn giữ "Tất cả trạng thái"/"Tất cả luồng". Tiếp theo là ô tìm kiếm rộng hết màn hình, cuối cùng là chip Chọn tất cả / Đã chọn n ✕ (tự xuống dòng). Lý do: khi dồn hết vào một hàng cuộn ngang, nút "Đã tất toán" thường bị khuất, phải vuốt ngang mới thấy. Thông báo (toast) nằm phía trên thanh tab.
- **Hộp thoại gộp nợ**: mở toàn màn hình trên điện thoại (form dài), nút ✕ và nút chân hộp thoại 40px, ô nhập 40px; danh sách khoản đã chọn không còn khung cuộn riêng, cả hộp thoại cuộn một lần.

## Quy tắc nghiệp vụ phía backend

- **Thêm khoản nợ** (`POST /api/debts`): bắt buộc chiều nợ, tên người, số tiền, và **hoặc** `contactId` của người có sẵn **hoặc** `createNewContact: true` (tạo người mới từ tên/biệt danh). Thiếu cả hai thì service ném lỗi và hiện trả về lỗi máy chủ (500), nên form chặn trường hợp này từ phía client. Ngày phát sinh mặc định là lúc tạo.
- **Xoá khoản nợ** (`DELETE /api/debts/:id`): xoá vĩnh viễn.
  - Các đợt trả và phân bổ giao dịch của khoản đó bị xoá theo (khoá ngoại `CASCADE`).
  - **Khác với xoá lẻ một đợt trả**: các giao dịch thu/chi (_Thu hồi nợ_/_Trả nợ_) đã ghi cho những đợt trả này **vẫn ở lại sổ thu–chi**. Hộp xác nhận nói rõ điều này; nếu muốn số dư dòng tiền khớp lại thì xoá từng đợt trả trước rồi mới xoá khoản nợ.
  - Nếu là khoản cha đã gộp, các khoản con được tách ra (`parentDebtId` về `NULL`) và hiện lại thành khoản nợ riêng.

- **Sửa số còn lại**: về 0 thì chuyển `settled` và ghi ngày tất toán; lớn hơn 0 thì mở lại.
- **Ghi nhận đợt trả** (`POST /api/debts/:id/payments`, một transaction): khoản nợ phải đang mở và số trả không vượt số còn lại. Hệ thống đồng thời tạo một giao dịch thu–chi để số dư dòng tiền khớp với công nợ: thu hồi khoản **phải thu** → khoản **thu** danh mục _Thu hồi nợ_; trả khoản **phải trả** → khoản **chi** danh mục _Trả nợ_. Đợt trả lưu `financeTransactionId` trỏ tới giao dịch đó, nên hai bản ghi luôn đi cùng nhau (đợt trả tạo trước bản sửa này không có liên kết và không được bổ sung).
- **Xoá đợt trả** (một transaction): cộng lại số còn lại (không vượt số gốc), mở lại khoản nợ, tính lại số còn lại của khoản cha, và xoá giao dịch liên kết **nếu** đợt trả có `financeTransactionId` (đợt trả thủ công/Trả nhanh và đợt trả sinh ra từ phân bổ giao dịch). Nhờ vậy xoá đợt trả không để lại giao dịch _Thu hồi nợ_/_Trả nợ_ mồ côi trong sổ thu–chi.
- **Phân bổ giao dịch vào nợ**: một giao dịch thu/chi có sẵn có thể được phân bổ vào một hoặc nhiều khoản nợ qua `/api/transactions/:id/allocations` (xem module dashboard); mỗi phân bổ sinh một đợt trả có `financeTransactionId`.
- **Gộp nợ** (`POST /api/debts/combine`, một transaction): cần ít nhất 2 khoản của chính người dùng, cùng chiều và cùng loại tiền. Tạo khoản cha có số gốc và số còn lại bằng tổng các khoản con; khoản con trỏ về cha qua `parentDebtId`. Nếu khoản được gộp đã có con, các con đó được chuyển thẳng lên cha mới để cây luôn chỉ có một cấp.
- Gộp danh bạ có chọn "gom nợ" sẽ tái sử dụng logic gộp nợ theo từng nhóm chiều + loại tiền (xem module contacts).

## Lỗi đã biết (chưa sửa)

- Danh sách giới hạn 200 bản ghi (tính cả khoản con), chưa phân trang.

## Kiểm thử

`npm run typecheck`, `npm run lint`, `npm run build` (scope `--workspace @zalobot/web`); test backend liên quan chạy bằng `npm run test --workspace @zalobot/api`.

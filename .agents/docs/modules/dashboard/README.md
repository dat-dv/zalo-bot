---
metadata:
  agent-artifact:
    id: docs-module-dashboard
    type: documentation
    depends_on:
      - .agents/knowledge/modules/dashboard/README.md
      - apps/web/src/modules/dashboard/api/dashboard-query.ts
      - apps/web/src/modules/dashboard/api/analytics-query.ts
      - apps/web/src/modules/dashboard/api/transactions-query.ts
      - apps/web/src/modules/dashboard/api/places-query.ts
      - apps/web/src/modules/dashboard/api/allocations-query.ts
      - apps/web/src/modules/dashboard/presentation/components/dashboard-home-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/transaction-column-filters.ts
      - apps/web/src/modules/dashboard/presentation/components/column-filter-popover.tsx
      - apps/web/src/modules/dashboard/presentation/components/analytics-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminders-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-reminder-dialog.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/places-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/combine-places-dialog.tsx
      - apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx
      - apps/web/src/modules/dashboard/presentation/components/delete-transaction-modal.tsx
      - apps/web/src/modules/dashboard/presentation/components/adjust-balance-modal.tsx
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/ui/period-filter-toolbar.tsx
      - apps/web/src/shared/ui/category-autocomplete.tsx
      - apps/web/src/shared/ui/data-table.tsx
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.service.ts
      - apps/api/src/zca/text/strategies/dashboard-tool.strategy.ts
      - apps/web/src/modules/dashboard/presentation/components/transaction-receipt.tsx
---

# Module dashboard

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/dashboard/README.md).

## Vai trò nghiệp vụ

`apps/web/src/modules/dashboard` là không gian làm việc chính sau khi người dùng mở dashboard từ Zalo. Module dựng trang Tổng quan từ **một payload dashboard duy nhất** và sở hữu phần lớn các trang: Thu chi, Phân tích, Nơi chốn, Lịch, Việc cần làm, Nhắc nhở. Các module `calendar`, `tasks`, `reminders` chỉ cung cấp lớp API/query (riêng calendar có thêm `CalendarGrid` và hàm xử lý ngày).

## Bản đồ route

| Route | Màn hình |
| --- | --- |
| `/`, `/dashboard` | `DashboardHomeScreen` |
| `/transactions` (có thể kèm `?type=income` hoặc `?type=expense`) | `TransactionsScreen` |
| `/expenses`, `/income` | chuyển hướng sang `/transactions?type=expense` / `?type=income` |
| `/analytics` | `AnalyticsScreen` |
| `/places` | `PlacesScreen` |
| `/calendar`, `/tasks`, `/reminders` | `CalendarScreen`, `TasksScreen`, `RemindersScreen` |
| `/debts`, `/contacts`, `/zca`, `/settings` | thuộc các module khác |

Layout riêng tư (`app/(private)/layout.tsx`) render thanh điều hướng `AppNavigation` và `WorkspaceHeader` **một lần**; các màn hình không tự render header.

## Payload dashboard và giới hạn dữ liệu

`GET /api/dashboard` trả về: thông tin người dùng (`isAdmin`, `googleConnected`), tổng thu/chi/số dư **của tháng hiện tại**, phải thu/phải trả, **tối đa 20 giao dịch mới nhất của tháng hiện tại** (kèm nơi chốn và phân bổ nợ), `finance.ledgerBalance` (số dư sổ cái toàn thời gian), các khoản nợ đang mở, sự kiện lịch và việc cần làm sắp tới (đều đọc từ DB, không phụ thuộc kết nối Google), tối đa 10 nhắc nhở, 10 hoạt động gần nhất trong nhật ký kiểm toán, và số liệu admin (chỉ admin).

Payload này chỉ phục vụ trang Tổng quan. Trang Thu chi có API danh sách riêng (`GET /api/transactions`, xem bên dưới) nên xem được mọi kỳ.

## Trang Tổng quan (`DashboardHomeScreen`)

- URL có `?status=logged_out` → hiện màn hình "Đã đăng xuất" (không gọi API). Lỗi tải dữ liệu → màn hình "Phiên hết hạn" có nút thử lại. Đang tải → `DashboardHomeSkeleton`.
- Thẻ KPI: tổng thu, tổng chi, số dư, phải thu, phải trả, số mục cần chú ý.
- Thanh liên kết nhanh: Thu chi, **Cân chỉnh số dư** (mở `AdjustBalanceModal`), Công nợ, Phân tích, Lịch, Việc cần làm, Nhắc nhở, Danh bạ.
- Dải thông tin admin (chỉ admin thấy): số người dùng, số người đã kết nối Google.
- Các bảng chỉ đọc, mỗi bảng có ô tìm kiếm riêng: Việc cần làm, Nhắc nhở, Lịch, Giao dịch, Công nợ đang mở (tiêu đề là link sang trang chi tiết) và Hoạt động gần đây (không có link).
- **Trên màn hẹp (≤ 960px)**: trang Tổng quan chỉ là bản xem nhanh, không phải nơi làm việc. Vì vậy mỗi khối chỉ hiện **5 dòng đầu** theo thứ tự API trả về (giao dịch/hoạt động mới nhất, việc/nhắc nhở/sự kiện gần nhất; khối Công nợ giới hạn theo khoản nợ gốc, khoản con vẫn nằm trong khoản gốc), dạng danh sách hai dòng nếu bảng đó hỗ trợ, kèm dòng **Xem tất cả** cao 40px dẫn sang trang đầy đủ. Khối Hoạt động không có trang riêng nên không có link. Lý do: 6 khối × 20 dòng trên điện thoại là một trang dài vô tận, người dùng không tìm được khối mình cần.
- **Trên điện thoại (≤ 640px)**: bỏ 6 ô tìm kiếm riêng của từng khối (và bỏ luôn từ khoá đã gõ trước khi xoay máy) vì muốn tìm thì vào trang đầy đủ. Thanh liên kết nhanh là một hàng chip 40px cuộn ngang thay vì nhiều hàng chồng nhau. Thẻ KPI vẫn 2 thẻ một hàng nhưng thấp hơn (52px) để thấy nhiều nội dung hơn.

## Trang Thu chi (`TransactionsScreen`)

- **Nguồn dữ liệu**: `useTransactionsInfiniteQuery` gọi `GET /api/transactions` với kỳ đang chọn (`startAt`/`endAt`; kỳ "Tất cả" thì không gửi), loại (`?type=`) và từ khoá tìm kiếm (chờ 300ms sau khi gõ). Lọc diễn ra ở server, nên chọn tháng cũ, quý hay năm đều ra đúng dữ liệu.
- **Tải thêm**: mỗi lần tải 100 dòng; nếu kỳ có nhiều hơn, cuối bảng có nút "Tải thêm" và bộ đếm hiện "Đã tải X/Y dòng". Khi đổi kỳ/bộ lọc, dữ liệu cũ vẫn hiển thị đến khi dữ liệu mới về.
- Bộ lọc kỳ mặc định theo tháng; thanh chọn kỳ mặc định có Tuần / Tháng / Quý / Năm, đồng bộ lên URL (`?period=&ref=`). Dải xu hướng: tổng thu/chi lấy từ `summary` của server (chính xác cho cả kỳ, gồm cả thu và chi bất kể đang lọc loại nào); biểu đồ cột vẽ từ các dòng đã tải.
- Bộ lọc loại Tất cả / Thu / Chi đồng bộ với `?type=` — đây là lý do `/expenses` và `/income` chỉ cần chuyển hướng về đây. Ô tìm kiếm theo danh mục, ghi chú, tên nơi chốn. Nút Cân chỉnh số dư.
- **Lọc theo cột (trên header)**: các cột Loại, Danh mục, Ghi chú, Nơi chốn, Người tạo, Ảnh, Số tiền có nút hình phễu; cột đang lọc có chấm xanh. Bấm vào mở bảng chọn. Trên điện thoại, bảng chọn mở bằng bottom sheet của `Modal` dùng chung: có nền mờ, khoá cuộn trang, chạm ra ngoài để đóng. Bảng chọn không tự focus vào ô nhập để bàn phím không bật lên ngay, và ô nhập, dòng lựa chọn, nút "Xoá lọc" đều cao 40px:
  - Loại: Tất cả / Thu / Chi — dùng chung trạng thái với nút trên toolbar.
  - Danh mục, Người tạo: chọn nhiều; danh sách lấy từ server (`facets`) theo kỳ đang xem, nên có cả danh mục gõ tay chưa cấu hình. Danh sách không co lại khi đang lọc, để dễ chọn thêm. Người tạo chưa có tên (chưa có hồ sơ và giao dịch cũng không lưu tên) hiện là "Không rõ tên (…4 số cuối ID)" và nằm cuối danh sách — thường là tài khoản trùng nên gộp ở trang Zalo & Người dùng.
  - Nơi chốn: chọn nhiều từ danh sách nơi chốn, kèm mục "Không có nơi chốn".
  - Ghi chú: gõ nội dung cần chứa; Số tiền: nhập khoảng Từ–Đến (gõ ngược thì tự đảo). Hai ô này chờ 400ms sau khi gõ mới gọi API.
  - Ảnh: Tất cả / Có ảnh / Không có ảnh.
  
  Việc lọc **chạy ở backend** (`GET /api/transactions`), nên tổng số dòng, nút "Tải thêm" và bộ đếm luôn đúng với toàn bộ dữ liệu chứ không chỉ các dòng đã tải. Các bộ lọc kết hợp kiểu VÀ với nhau, với kỳ và với ô tìm kiếm. Bộ lọc lưu trên URL nên F5 hoặc gửi link cho người khác vẫn giữ nguyên. Khi có bộ lọc cột, toolbar hiện nút "Xoá tất cả bộ lọc (N)". Dải tổng thu/chi và Số dư lũy kế **không** thay đổi theo bộ lọc cột — chúng luôn phản ánh cả kỳ / cả sổ.
- **Sổ chung**: hệ thống chỉ có một kho tài chính, nên mọi thành viên vào trang này đều thấy cùng một sổ. Cột **Người tạo** cho biết ai đã ghi khoản đó và ghi từ đâu ("Nhóm <tên>", "Chat riêng" hay "Dashboard"); giao dịch cũ chưa có thông tin hiện "—".
- **Ảnh hoá đơn**: mặc định cột **Ảnh** chỉ hiện icon 🧾 ở dòng có ảnh và **không tải ảnh**; nút 🖼 trên header cột bật/tắt chế độ xem trước, khi bật mọi dòng hiện ảnh nguyên khung (không bị cắt, cao khoảng 64px) và cột tự rộng ra. Trạng thái này không lưu qua F5 (giống nút ẩn số tiền) để trang không tự tải hàng loạt ảnh. Bấm icon hoặc ảnh để xem lớn trong hộp thoại, kèm nút "Mở ảnh" sang tab mới. Web không dùng thẳng link Drive vì file Drive là riêng tư; API dùng token Google của người tạo để tải hộ. Ảnh được API tải hộ từ Drive/CDN Zalo; nếu không tải được (token Google hết hạn, file đã xoá) sẽ hiện "Không tải được ảnh".
- **Xem đầy đủ**: mọi dòng đều có nút mở rộng ▶ ở ô Ghi chú, hiện khối chi tiết gồm người tạo, nguồn, thời điểm tạo, phương thức, tiền tệ, ghi chú đầy đủ (không bị cắt) và ảnh lớn; nếu có phân bổ công nợ thì bảng phân bổ nằm ngay bên dưới.
- Bảng (`id="transactions"`): Loại, Danh mục, Ghi chú, Nơi chốn, Người tạo, Ảnh, Số tiền (thanh tỷ lệ chỉ hiện khi đang bấm hiện số tiền), Số dư lũy kế, Thời gian, Thao tác (rộng tối thiểu 130px: Sửa, Xoá). **Số dư lũy kế** do server tính: là số dư ví ngay sau giao dịch đó, tính trên toàn bộ sổ của người dùng — không phụ thuộc kỳ, loại hay từ khoá đang lọc.
- **Sửa trực tiếp**: loại, danh mục, ghi chú (bắt buộc), số tiền (> 0), nơi chốn, thời gian.
  - Danh mục và Nơi chốn dùng chung combobox `CategoryAutocomplete`: click/focus để mở, gõ để lọc, mũi tên lên/xuống + `Enter` để chọn, `Escape` lần đầu đóng danh sách, lần hai huỷ sửa; cho phép gõ giá trị mới. Danh sách nổi trên bảng (portal) nên không bị cắt bởi vùng cuộn.
  - Gợi ý danh mục: danh mục người dùng cấu hình theo đúng loại Thu/Chi, danh mục đã dùng của loại đó, và danh mục mặc định. Gợi ý nơi chốn: danh sách nơi chốn đã lưu.
  - Gõ tên nơi chốn mới → backend tự tạo hoặc dùng lại nơi chốn trùng tên. Xoá trống ô nơi chốn → gửi `placeId: null`, chỉ gỡ liên kết, không xoá giao dịch hay nơi chốn.
  - Không cho lưu nếu giao dịch đã có phân bổ nợ mà đổi loại Thu/Chi, hoặc giảm số tiền xuống dưới tổng đã phân bổ (tooltip nút Lưu giải thích lý do).
- **Phân bổ nợ**: ô Ghi chú có nút mở rộng ▶/▼ và badge `🔗 N phân bổ` (bấm để mở `DebtAllocationModal`); khi đang sửa có thêm nút `🔗` ở cột thao tác. Dòng mở rộng liệt kê người liên quan, số tiền, ghi chú của từng phân bổ.
- **Xoá giao dịch**: mở `DeleteTransactionModal` thay cho hộp xác nhận của trình duyệt. Modal tóm tắt giao dịch và nói rõ tác động lên số dư: xoá khoản **chi** → số dư tăng lại (`+số tiền`, màu xanh ngọc); xoá khoản **thu** → số dư giảm (`-số tiền`, màu hổ phách); nếu có phân bổ nợ → cảnh báo đỏ rằng số nợ còn lại của các khoản liên quan sẽ được khôi phục. Đóng bằng `Escape` hoặc bấm nền (trừ khi đang xử lý).
- Lỗi tải danh sách giao dịch → màn hình "Phiên hết hạn" có nút thử lại.
- **Trên điện thoại (≤ 640px)**: Thu chi là màn đầu tiên dùng chế độ danh sách của `DataTable`. Giờ `TransactionsTable` bật chế độ này mặc định, nên bảng giao dịch ở mọi màn đều thành danh sách trên màn hẹp. Mục tiêu là mở trang ra thấy giao dịch ngay, không phải cuộn ngang. Chi tiết chung xem [web-ui-direction](../../global/web-ui-direction.md).
  - Mỗi giao dịch là một dòng hai tầng: ghi chú và số tiền có dấu +/− ở trên; danh mục · ngày · người tạo · nơi chốn ở dưới. Không có STT/ID và không có thanh tỉ lệ số tiền.
  - Chạm vào dòng mở bảng trượt gồm mọi trường, khối chi tiết, ảnh hoá đơn, phân bổ nợ và dòng ID (mở hộp thoại ID cho AI Agent).
    - Bấm **Sửa** thì các trường thành ô nhập ngay trong bảng trượt.
    - Nút Lưu/Huỷ/Xoá nằm ở chân bảng trượt, luôn thấy kể cả khi bàn phím mở.
  - Các nút lọc theo cột chuyển lên một dải cuộn ngang phía trên danh sách.
  - Toolbar gom chip Tất cả / Thu / Chi / Xoá bộ lọc vào một hàng cuộn ngang. Ô tìm kiếm nằm hàng riêng. Mọi nút, ô nhập và "Tải thêm" cao 40px.
  - Trên màn hẹp (≤ 960px), nút **Cân chỉnh số dư** vẫn nằm trên toolbar, ở cuối hàng chip lọc cuộn ngang. Trang này không dùng thanh hành động dưới đáy (`MobileActionBar`): thao tác cân chỉnh hiếm khi dùng nên không đáng chiếm một thanh cố định che bớt danh sách. Chế độ danh sách cũng áp dụng tới 960px.
  - Bảng giao dịch ở trang Tổng quan cũng dùng danh sách (xem nhanh 5 dòng, xem phần Tổng quan).
  - **Phần đầu trang thấp hơn**: dải tổng hợp `TrendSummaryStrip` (dùng chung với trang Chi tiêu) trên điện thoại chỉ còn một dòng: tổng thu, tổng chi, chênh lệch. Chạm vào dòng đó để mở biểu đồ cột (và chỉ số phụ nếu có). Mặc định thu gọn, để danh sách giao dịch xuất hiện ngay màn hình đầu. Desktop giữ nguyên.
  - Trong bảng trượt chi tiết, bảng phân bổ nợ lồng bên trong thành danh sách dọc (người liên quan + số tiền, ghi chú bên dưới) thay vì bảng phải cuộn ngang. Nút "Chỉnh sửa phân bổ" và nhãn `🔗 N phân bổ` cao 40px. Nút mũi tên mở rộng bị ẩn vì sheet luôn hiện chi tiết. Nút chỉ có biểu tượng `🔗` (khi đang sửa) có `aria-label` để trình đọc màn hình đọc được.

## Phân bổ giao dịch vào công nợ (`DebtAllocationModal`)

- Mục đích: khi người dùng nhận/chuyển tiền để thu hồi hoặc trả nợ, họ gắn giao dịch thu–chi đó vào một hoặc nhiều khoản nợ để số nợ còn lại tự giảm mà không phải ghi trùng.
- Ứng viên: các khoản nợ trong sổ chung, chiều phù hợp (thu → phải thu, chi → phải trả), lọc theo người liên quan của giao dịch nếu có, mới nhất trước, bỏ qua khoản đã trả hết mà chưa được phân bổ từ giao dịch này.
- Modal hiển thị tổng tiền / đã phân bổ / chưa phân bổ, ô nhập số tiền và ghi chú cho từng khoản nợ, nút "Phân bổ tối đa".
- Khi lưu, backend **thay thế toàn bộ** tập phân bổ của giao dịch trong một transaction: hoàn lại phân bổ cũ, xoá các đợt trả nợ cũ sinh từ giao dịch này, rồi áp dụng phân bổ mới. Dòng có số tiền 0 bị bỏ qua — muốn gỡ một phân bổ thì đặt về 0 rồi lưu. Hook `useDeleteDebtAllocationMutation` có sẵn nhưng giao diện chưa dùng.
- Trên điện thoại modal mở toàn màn hình (form dài, nhiều khoản nợ). Danh sách khoản nợ không còn là hộp cuộn riêng bên trong (cuộn lồng nhau rất khó dùng bằng ngón tay), ô nhập và nút "Phân bổ tối đa" cao 40px. Mọi chữ tiếng Việt viết cứng trước đây đã chuyển sang i18n nên hiển thị đúng khi chọn tiếng Anh.

## Dialog trên điện thoại

- Áp dụng cho Cân chỉnh số dư, Phân bổ nợ, Xoá giao dịch, Gộp nơi chốn, xem hoá đơn: nút ✕ và nút ở chân dialog cao 40px, chân dialog dính đáy và có nền đặc để luôn bấm được khi bàn phím mở.
- Cân chỉnh số dư không còn tự focus vào ô nhập khi mở, vì focus tự động làm bàn phím bật lên che nửa màn hình trước khi người dùng kịp đọc số dư hiện tại. Chân dialog trải hết bề ngang sheet và có khoảng đệm dưới.
- Gộp nơi chốn: danh sách nơi chốn không còn hộp cuộn lồng, mỗi dòng cao tối thiểu 44px; vài chữ viết cứng còn sót đã chuyển sang i18n.

## Cân chỉnh số dư (`AdjustBalanceModal`)

- Mở từ thanh liên kết nhanh trang chủ, thanh công cụ trang Thu chi và trang Cài đặt.
- Ô số dư thực tế chỉ điền sẵn số dư hiện tại khi đang **hiện** số tiền. Khi số tiền đang bị ẩn, ô để trống: điền sẵn sẽ in số dư thật ra màn hình, làm mất tác dụng của nút ẩn số tiền (lỗi phát hiện khi test prod ngày 22/10/2026).
- Người dùng nhập số dư thực tế; chênh lệch dương sinh khoản **thu**, chênh lệch âm sinh khoản **chi**, danh mục "Điều chỉnh số dư" (theo ngôn ngữ đang chọn), ghi chú tự sinh có thể sửa, chọn thời điểm. Chênh lệch bằng 0 thì không làm gì.
- "Số dư trên sổ hiện tại" là **số dư sổ cái toàn thời gian** (tổng thu − tổng chi): trang Thu chi lấy `ledgerBalance` từ API danh sách, trang chủ và Cài đặt lấy `finance.ledgerBalance` từ payload dashboard. Nhờ vậy số tiền điều chỉnh luôn đúng bất kể có dữ liệu các tháng trước.

## Trang Phân tích (`AnalyticsScreen`)

- Bộ lọc kỳ mặc định theo tháng; gọi `GET /api/finance/analytics` với `startAt`, `endAt`, `grain` (kỳ "tất cả" không gửi ngày).
- **Kết quả trong kỳ**: Tổng thu, Tổng chi, Tiết kiệm ròng, Tỷ lệ tiết kiệm.
- **Tình hình hiện tại** (không phụ thuộc bộ lọc): Số dư dòng tiền toàn thời gian, Phải thu, Phải trả, Tài sản ròng. Đây không phải số dư ngân hàng vì hệ thống không quản lý số dư đầu kỳ.
- Khối Dòng tiền: nút chuyển Biểu đồ/Bảng; biểu đồ Recharts gồm cột thu/chi và đường số dư lũy kế, hoặc bảng số liệu theo kỳ.
- Trên điện thoại: hai nút Biểu đồ/Bảng cao 40px, chia đôi hàng. Bảng số liệu là theo **kỳ** (không theo danh mục), nên ở dạng danh sách: dòng trên là tên kỳ + dòng tiền ròng (có dấu, có màu), dòng dưới là "Thu +x · Chi −y"; số dư lũy kế xem trong sheet chi tiết. Các thẻ chỉ số giữ 2 thẻ một hàng, thấp hơn.
- Khối Phân bổ chi tiêu (biểu đồ donut, đủ mọi danh mục chi, chú thích cuộn được) và Cơ cấu công nợ (tỷ lệ phải thu/phải trả + top 3 người liên quan mỗi bên; khi ẩn số tiền thì các thanh tỷ lệ cũng ẩn để không lộ ai nợ nhiều/ít). Các biểu đồ nằm ở `shared/ui/charts/`.
- Chỉ hiện màn hình "Phiên hết hạn" khi lỗi tải dashboard. Skeleton được viết trực tiếp trong màn hình (không có component `AnalyticsSkeleton`).

## Trang Nơi chốn (`PlacesScreen`)

- **Nơi chốn** là quán ăn, cửa hàng, địa điểm phát sinh giao dịch — khác với người liên quan trong danh bạ công nợ.
- Bảng `id="places"`: chọn, Tên (sửa trực tiếp, `Enter`/`Escape`), Số giao dịch, Ngày tạo, Thao tác (Sửa, Xoá xác nhận 2 bước ngay trên dòng). Có ô tìm kiếm và form thêm nhanh. Trên màn hẹp (≤ 960px), nút "+ Tạo" chuyển xuống thanh hành động trên thanh tab và ẩn đi khi form đang mở. Trên điện thoại, ô nhập và nút của form cao 40px, rộng hết hàng.
- Trên màn hẹp (≤ 960px) bảng thành danh sách: tên + số giao dịch ở dòng trên, ngày tạo ở dòng dưới. Chạm để mở sheet, bấm **Sửa**/**Xoá** ở chân sheet (desktop vẫn double-click).
- **Chế độ chọn trên màn hẹp**: ở dạng danh sách, chạm vào dòng là mở sheet chi tiết, nên không thể vừa chạm để chọn. Vì vậy có chip **Chọn**/**Xong**: bật lên thì danh sách đổi thành các dòng có ô tích (cả dòng là vùng chạm 52px), chip "Chọn tất cả" chỉ hiện trong chế độ này. Chọn từ 2 nơi chốn thì thanh hành động dưới đáy đổi từ "+ Tạo" thành "Gộp (N)". Thoát chế độ chọn hoặc gộp xong sẽ xoá lựa chọn. Cách này đơn giản hơn đặt ô chọn vào sheet (phải mở từng sheet để chọn từng nơi).
- Toolbar trên điện thoại: một hàng chip 40px cuộn ngang, rồi form thêm nhanh, rồi ô tìm kiếm full width.
- **Gộp nơi chốn**: chọn từ 2 dòng → `CombinePlacesDialog` xếp hạng ứng viên theo số giao dịch nhiều nhất rồi tạo sớm nhất, người dùng chọn nơi chốn chính và tên cuối cùng; gọi `POST /api/places/combine`. Backend chuyển giao dịch sang nơi chốn chính và từ chối nếu tên mới trùng một nơi chốn khác.
- Xoá nơi chốn không bao giờ xoá giao dịch; giao dịch chỉ mất liên kết nơi chốn.

## Lịch, Việc cần làm, Nhắc nhở

- `CalendarScreen`: xem tài liệu module calendar (dải tóm tắt, lưới tháng kèm cột ngày đã chọn / sắp tới, sheet chi tiết–tạo–sửa, xoá hỏi lại bằng hộp xác nhận trong app; trên điện thoại mặc định là Lịch trình liền 14 ngày; thanh công cụ gọn một hàng, tiêu đề tháng không xuống dòng, 4 ô tóm tắt nằm chung một hàng).
- `TasksScreen`: bộ lọc kỳ có Ngày / Tuần / Tháng / Quý / Năm / Tất cả, thẻ tổng quan (tổng, cần làm, đã xong, quá hạn), lọc trạng thái Tất cả / Cần làm / Đã xong, **thêm việc** qua `CreateTaskDialog`, sửa trực tiếp, xoá bằng hộp xác nhận trong app, cột Người tạo. Task chỉ lưu trong zalobot, không đồng bộ Google (xem `modules/tasks/README.md`). Khung Việc cần làm ở trang Tổng quan không có dòng nhắc kết nối Google.
- `RemindersScreen`: tìm kiếm, sửa trực tiếp, xoá có xác nhận, và **thêm lời nhắc** qua `CreateReminderDialog` (nút trên toolbar ở desktop, thanh hành động dưới cùng ở điện thoại). Quy tắc mặc định và kiểm tra thời điểm xem tài liệu module [reminders](../reminders/README.md).
- Trên điện thoại: các chip trạng thái của Việc cần làm nằm trên một hàng cuộn ngang cao 40px thay vì xếp chồng, ô tìm kiếm full width 40px. Hai màn này không có nút tạo mới nên cũng không có thanh hành động dưới đáy.
- Ở màn hẹp (≤ 960px), ba bảng `TasksTable`, `RemindersTable`, `CalendarTable` hiển thị dạng danh sách hai dòng — ở mọi nơi bảng xuất hiện, kể cả trang Tổng quan. Việc cần làm: tiêu đề + hạn (`dd/MM`), dòng hai trạng thái · ghi chú. Nhắc nhở: nội dung + giờ nhắc (`dd/MM HH:mm`), dòng hai kênh (nhắn tin/gọi) · lặp lại. Lịch: tiêu đề + giờ bắt đầu, dòng hai địa điểm · mô tả. Lý do: trên cảm ứng không double-click được, nên chạm vào dòng để mở sheet chi tiết rồi bấm **Sửa** ở chân sheet; các ô trong sheet tự chuyển thành ô nhập. Ô tiêu đề không tự focus trên màn hẹp để bàn phím không bật lên khi vừa bấm Sửa. Desktop vẫn sửa bằng double-click như cũ.

## Hành vi giao diện dùng chung

- `WorkspaceHeader`: tiêu đề theo route, nút ẩn/hiện số tiền, nút **Làm mới** (làm mới **toàn bộ** query đang có), nút Đăng xuất.
- Ẩn/hiện số tiền: mặc định **ẩn** để bảo vệ riêng tư; chỉ giữ trong store Zustand `useMoneyVisibilityStore` trong bộ nhớ (không `persist`, không lưu `localStorage`) nên chuyển trang vẫn giữ nhưng tải lại trang (F5) là ẩn lại; khi ẩn, số tiền hiện `••••••` ở KPI, bảng, tooltip, và thanh tỉ lệ dưới số tiền ở bảng Giao dịch/Chi tiêu cũng ẩn (vì độ dài thanh để lộ khoản lớn/nhỏ); ô nhập khi sửa vẫn hiện số thật.
- `DataTable` ghi nhớ cột ẩn/hiện và độ rộng cột theo id bảng trong `localStorage`; có cơ chế so sánh trước khi cập nhật state để tránh vòng lặp render.
- Điều hướng: sidebar cố định trên desktop (nhóm Tổng quan, Tài chính, Kế hoạch, Dữ liệu, Hệ thống); màn hình ≤ 960px chuyển thành thanh trên cùng + menu trượt. Cuối menu có nút đổi giao diện sáng/tối (lần đầu theo hệ thống) và chọn ngôn ngữ Việt/Anh.

- `DebtAllocationModal`, `AdjustBalanceModal`, `DeleteTransactionModal`, `CombinePlacesDialog`: Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo). Toast dùng vị trí chung `TOAST_POSITION`: trên desktop ở góc phải dưới; trên màn hẹp rộng hết màn và nằm trên thanh tab, có chừa `env(safe-area-inset-bottom)`. Áp dụng cho Tổng quan, Thu chi, Nơi chốn, Việc cần làm, Nhắc nhở, Lịch.

## Mở dashboard, chạy local và production

- Người dùng gửi `/dashboard` (hoặc "dashboard", "mở dashboard") cho bot; bot trả link dùng một lần `/api/access?token=...` (hạn 20 phút). API đổi link thành phiên rồi chuyển hướng sang `/dashboard#dashboard_token=...` (chi tiết ở module auth). Không có nút callback; muốn link mới thì gửi lại lệnh. Link hết hạn/đã dùng trả trang HTML lỗi 401.
- Local: `npm run dev` (chạy cả API và web) hoặc `npm run dev:api` + `npm run dev:web`. Web chạy ở cổng `FE_PORT` (mặc định 5173); Next chuyển `/api/*` sang `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:<NGINX_PORT|3000>`). Khi truy cập qua localhost hoặc tunnel (Cloudflare, ngrok, loca.lt), client gọi đường dẫn tương đối `/api/...`.
- Production: web là static export, Nginx phục vụ file tĩnh và chuyển `/api/*` sang NestJS. `NEXT_PUBLIC_API_URL` là origin **không** kèm `/api` (hằng `API_ROUTES` đã có tiền tố) và được đóng gói lúc build, đổi giá trị thì phải build lại.

## Lỗi/hạn chế đã biết

- Bảng Giao dịch và thẻ "Số dư" trên trang chủ vẫn theo tháng hiện tại (bảng tối đa 20 dòng) — đây là chủ đích, trang Thu chi mới là nơi xem đầy đủ.
- Khi một kỳ có hơn 100 giao dịch, biểu đồ cột của dải xu hướng chỉ phản ánh các dòng đã tải (tổng thu/chi vẫn chính xác).

Khi dữ liệu dashboard sai hoặc rỗng, kiểm tra payload `GET /api/dashboard` trước khi sửa cột hiển thị. Các bảng dùng primitive trong `src/shared/ui`, không tạo primitive riêng trong module.

## Bo góc

- Nút, ô nhập, thẻ/panel và khung dialog trong module này dùng `rounded-[3px]` (tối đa `rounded`, 4px), không dùng `rounded-lg/xl/2xl`. Lý do: giao diện dashboard theo phong cách gọn, sắc cạnh như công cụ quản trị; bo lớn làm các ô trông như app tiêu dùng và lệch với phần còn lại. `rounded-full` chỉ dành cho avatar, chấm trạng thái, công tắc, vòng quay tải và thanh tiến độ. Xem [web-ui-direction](../../global/web-ui-direction.md).

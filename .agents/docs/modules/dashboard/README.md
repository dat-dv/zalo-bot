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
      - apps/web/src/modules/dashboard/presentation/components/analytics-screen.tsx
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
      - apps/api/src/zalo/text/strategies/dashboard-tool.strategy.ts
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

`GET /api/dashboard` trả về: thông tin người dùng (`isAdmin`, `googleConnected`), tổng thu/chi/số dư **của tháng hiện tại**, phải thu/phải trả, **tối đa 20 giao dịch mới nhất của tháng hiện tại** (kèm nơi chốn và phân bổ nợ), các khoản nợ đang mở, sự kiện lịch và việc cần làm sắp tới (nếu đã kết nối Google), tối đa 10 nhắc nhở, 10 hoạt động gần nhất trong nhật ký kiểm toán, và số liệu admin (chỉ admin).

Hệ quả nghiệp vụ cần biết: trang Thu chi **không có API danh sách riêng** — nó dùng chính 20 giao dịch này. Chọn kỳ cũ hơn tháng hiện tại sẽ thấy rỗng.

## Trang Tổng quan (`DashboardHomeScreen`)

- URL có `?status=logged_out` → hiện màn hình "Đã đăng xuất" (không gọi API). Lỗi tải dữ liệu → màn hình "Phiên hết hạn" có nút thử lại. Đang tải → `DashboardHomeSkeleton`.
- Thẻ KPI: tổng thu, tổng chi, số dư, phải thu, phải trả, số mục cần chú ý.
- Thanh liên kết nhanh: Thu chi, **Cân chỉnh số dư** (mở `AdjustBalanceModal`), Công nợ, Phân tích, Lịch, Việc cần làm, Nhắc nhở, Danh bạ.
- Dải thông tin admin (chỉ admin thấy): số người dùng, số người đã kết nối Google.
- Các bảng chỉ đọc, mỗi bảng có ô tìm kiếm riêng: Việc cần làm, Nhắc nhở, Lịch, Giao dịch, Công nợ đang mở (tiêu đề là link sang trang chi tiết) và Hoạt động gần đây (không có link).

## Trang Thu chi (`TransactionsScreen`)

- Bộ lọc kỳ mặc định theo tháng; thanh chọn kỳ mặc định có Tuần / Tháng / Quý / Năm, đồng bộ lên URL (`?period=&ref=`). Có dải xu hướng thu–chi.
- Bộ lọc loại Tất cả / Thu / Chi đồng bộ với `?type=` — đây là lý do `/expenses` và `/income` chỉ cần chuyển hướng về đây. Ô tìm kiếm theo danh mục, ghi chú, tên nơi chốn. Nút Cân chỉnh số dư.
- Bảng (`id="transactions"`): Loại, Danh mục, Ghi chú, Nơi chốn, Số tiền (có thanh tỷ lệ), Số dư lũy kế, Thời gian, Thao tác (rộng tối thiểu 130px: Sửa, Xoá). Số dư lũy kế được tính ở client trên chính các dòng đang có, bắt đầu từ 0.
- **Sửa trực tiếp**: loại, danh mục, ghi chú (bắt buộc), số tiền (> 0), nơi chốn, thời gian.
  - Danh mục và Nơi chốn dùng chung combobox `CategoryAutocomplete`: click/focus để mở, gõ để lọc, mũi tên lên/xuống + `Enter` để chọn, `Escape` lần đầu đóng danh sách, lần hai huỷ sửa; cho phép gõ giá trị mới. Danh sách nổi trên bảng (portal) nên không bị cắt bởi vùng cuộn.
  - Gợi ý danh mục: danh mục người dùng cấu hình theo đúng loại Thu/Chi, danh mục đã dùng của loại đó, và danh mục mặc định. Gợi ý nơi chốn: danh sách nơi chốn đã lưu.
  - Gõ tên nơi chốn mới → backend tự tạo hoặc dùng lại nơi chốn trùng tên. Xoá trống ô nơi chốn → gửi `placeId: null`, chỉ gỡ liên kết, không xoá giao dịch hay nơi chốn.
  - Không cho lưu nếu giao dịch đã có phân bổ nợ mà đổi loại Thu/Chi, hoặc giảm số tiền xuống dưới tổng đã phân bổ (tooltip nút Lưu giải thích lý do).
- **Phân bổ nợ**: ô Ghi chú có nút mở rộng ▶/▼ và badge `🔗 N phân bổ` (bấm để mở `DebtAllocationModal`); khi đang sửa có thêm nút `🔗` ở cột thao tác. Dòng mở rộng liệt kê người liên quan, số tiền, ghi chú của từng phân bổ.
- **Xoá giao dịch**: mở `DeleteTransactionModal` thay cho hộp xác nhận của trình duyệt. Modal tóm tắt giao dịch và nói rõ tác động lên số dư: xoá khoản **chi** → số dư tăng lại (`+số tiền`, màu xanh ngọc); xoá khoản **thu** → số dư giảm (`-số tiền`, màu hổ phách); nếu có phân bổ nợ → cảnh báo đỏ rằng số nợ còn lại của các khoản liên quan sẽ được khôi phục. Đóng bằng `Escape` hoặc bấm nền (trừ khi đang xử lý).
- Lỗi tải dashboard → màn hình "Phiên hết hạn".

## Phân bổ giao dịch vào công nợ (`DebtAllocationModal`)

- Mục đích: khi người dùng nhận/chuyển tiền để thu hồi hoặc trả nợ, họ gắn giao dịch thu–chi đó vào một hoặc nhiều khoản nợ để số nợ còn lại tự giảm mà không phải ghi trùng.
- Ứng viên: khoản nợ của chính người dùng, chiều phù hợp (thu → phải thu, chi → phải trả), lọc theo người liên quan của giao dịch nếu có, mới nhất trước, bỏ qua khoản đã trả hết mà chưa được phân bổ từ giao dịch này.
- Modal hiển thị tổng tiền / đã phân bổ / chưa phân bổ, ô nhập số tiền và ghi chú cho từng khoản nợ, nút "Phân bổ tối đa".
- Khi lưu, backend **thay thế toàn bộ** tập phân bổ của giao dịch trong một transaction: hoàn lại phân bổ cũ, xoá các đợt trả nợ cũ sinh từ giao dịch này, rồi áp dụng phân bổ mới. Dòng có số tiền 0 bị bỏ qua — muốn gỡ một phân bổ thì đặt về 0 rồi lưu. Hook `useDeleteDebtAllocationMutation` có sẵn nhưng giao diện chưa dùng.

## Cân chỉnh số dư (`AdjustBalanceModal`)

- Mở từ thanh liên kết nhanh trang chủ, thanh công cụ trang Thu chi và trang Cài đặt.
- Người dùng nhập số dư thực tế; chênh lệch dương sinh khoản **thu**, chênh lệch âm sinh khoản **chi**, danh mục "Điều chỉnh số dư" (theo ngôn ngữ đang chọn), ghi chú tự sinh có thể sửa, chọn thời điểm. Chênh lệch bằng 0 thì không làm gì.
- Lỗi đã biết: "số dư hiện tại" lấy từ `finance.balance` của payload — tức là **thu trừ chi của tháng hiện tại**, không phải số dư toàn thời gian, nên số tiền điều chỉnh sẽ sai nếu đã có dữ liệu các tháng trước.

## Trang Phân tích (`AnalyticsScreen`)

- Bộ lọc kỳ mặc định theo tháng; gọi `GET /api/finance/analytics` với `startAt`, `endAt`, `grain` (kỳ "tất cả" không gửi ngày).
- **Kết quả trong kỳ**: Tổng thu, Tổng chi, Tiết kiệm ròng, Tỷ lệ tiết kiệm.
- **Tình hình hiện tại** (không phụ thuộc bộ lọc): Số dư dòng tiền toàn thời gian, Phải thu, Phải trả, Tài sản ròng. Đây không phải số dư ngân hàng vì hệ thống không quản lý số dư đầu kỳ.
- Khối Dòng tiền: nút chuyển Biểu đồ/Bảng; biểu đồ Recharts gồm cột thu/chi và đường số dư lũy kế, hoặc bảng số liệu theo kỳ.
- Khối Phân bổ chi tiêu (biểu đồ donut, đủ mọi danh mục chi, chú thích cuộn được) và Cơ cấu công nợ (tỷ lệ phải thu/phải trả + top 3 người liên quan mỗi bên). Các biểu đồ nằm ở `shared/ui/charts/`.
- Chỉ hiện màn hình "Phiên hết hạn" khi lỗi tải dashboard. Skeleton được viết trực tiếp trong màn hình (không có component `AnalyticsSkeleton`).

## Trang Nơi chốn (`PlacesScreen`)

- **Nơi chốn** là quán ăn, cửa hàng, địa điểm phát sinh giao dịch — khác với người liên quan trong danh bạ công nợ.
- Bảng `id="places"`: chọn, Tên (sửa trực tiếp, `Enter`/`Escape`), Số giao dịch, Ngày tạo, Thao tác (Sửa, Xoá xác nhận 2 bước ngay trên dòng). Có ô tìm kiếm và form thêm nhanh.
- **Gộp nơi chốn**: chọn từ 2 dòng → `CombinePlacesDialog` xếp hạng ứng viên theo số giao dịch nhiều nhất rồi tạo sớm nhất, người dùng chọn nơi chốn chính và tên cuối cùng; gọi `POST /api/places/combine`. Backend chuyển giao dịch sang nơi chốn chính và từ chối nếu tên mới trùng một nơi chốn khác.
- Xoá nơi chốn không bao giờ xoá giao dịch; giao dịch chỉ mất liên kết nơi chốn.

## Lịch, Việc cần làm, Nhắc nhở

- `CalendarScreen`: xem tài liệu module calendar.
- `TasksScreen`: bộ lọc kỳ có Ngày / Tuần / Tháng / Quý / Năm / Tất cả, lọc trạng thái Tất cả / Cần làm / Đã xong, sửa trực tiếp, xoá có xác nhận.
- `RemindersScreen`: tìm kiếm, sửa trực tiếp, xoá có xác nhận.

## Hành vi giao diện dùng chung

- `WorkspaceHeader`: tiêu đề theo route, nút ẩn/hiện số tiền, nút **Làm mới** (làm mới **toàn bộ** query đang có), nút Đăng xuất.
- Ẩn/hiện số tiền: mặc định **ẩn** để bảo vệ riêng tư, lưu ở `localStorage` (`zalobot-money-visibility`); khi ẩn, số tiền hiện `••••••` ở KPI, bảng, tooltip; ô nhập khi sửa vẫn hiện số thật.
- `DataTable` ghi nhớ cột ẩn/hiện và độ rộng cột theo id bảng trong `localStorage`; có cơ chế so sánh trước khi cập nhật state để tránh vòng lặp render.
- Điều hướng: sidebar cố định trên desktop (nhóm Tổng quan, Tài chính, Kế hoạch, Dữ liệu, Hệ thống); màn hình ≤ 960px chuyển thành thanh trên cùng + menu trượt. Cuối menu có nút đổi giao diện sáng/tối (lần đầu theo hệ thống) và chọn ngôn ngữ Việt/Anh.

## Mở dashboard, chạy local và production

- Người dùng gửi `/dashboard` (hoặc "dashboard", "mở dashboard") cho bot; bot trả link dùng một lần `/api/access?token=...` (hạn 20 phút). API đổi link thành phiên rồi chuyển hướng sang `/dashboard#dashboard_token=...` (chi tiết ở module auth). Không có nút callback; muốn link mới thì gửi lại lệnh. Link hết hạn/đã dùng trả trang HTML lỗi 401.
- Local: `npm run dev` (chạy cả API và web) hoặc `npm run dev:api` + `npm run dev:web`. Web chạy ở cổng `FE_PORT` (mặc định 5173); Next chuyển `/api/*` sang `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:<NGINX_PORT|GATEWAY_PORT|3000>`). Khi truy cập qua localhost hoặc tunnel (Cloudflare, ngrok, loca.lt), client gọi đường dẫn tương đối `/api/...`.
- Production: web là static export, Nginx phục vụ file tĩnh và chuyển `/api/*` sang NestJS. `NEXT_PUBLIC_API_URL` là origin **không** kèm `/api` (hằng `API_ROUTES` đã có tiền tố) và được đóng gói lúc build, đổi giá trị thì phải build lại.

## Lỗi/hạn chế đã biết

- Trang chủ và trang Thu chi chỉ thấy 20 giao dịch mới nhất của tháng hiện tại; số dư lũy kế chỉ tương đối trên các dòng đó.
- Cân chỉnh số dư dùng số dư của tháng hiện tại làm số dư sổ (xem mục Cân chỉnh số dư).

Khi dữ liệu dashboard sai hoặc rỗng, kiểm tra payload `GET /api/dashboard` trước khi sửa cột hiển thị. Các bảng dùng primitive trong `src/shared/ui`, không tạo primitive riêng trong module.

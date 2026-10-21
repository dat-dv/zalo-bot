# Nghiên cứu: Cải tiến UI mobile web (apps/web)

- Route: research · Authority: research-only · Ngày: 2026-10-21
- Phương pháp: đọc code các component dùng chung và 11 màn hình private, ước lượng ở bề ngang 375px. Chưa chụp màn hình thật vì máy không chạy API/DB.

## 1. Vì sao mobile đang rối (bằng chứng từ code)

### 1.1 Bảng desktop bị ép nguyên xi xuống điện thoại (tác động lớn nhất)
- `shared/ui/data-table.tsx` không có chế độ mobile. Ở ≤640px bảng chỉ thêm `min-w-max` và cuộn ngang (dòng ~877).
- Luôn có 2 cột hệ thống không ẩn được: STT (56px) và ID (rộng 220px), dòng 614–665. Trên màn 375px, hai cột này chiếm gần hết chiều ngang trước khi tới dữ liệu thật.
- Không cột nào ẩn mặc định. Bảng Thu chi rộng khoảng 1.650px, Công nợ 1.620px, Danh bạ 1.810px.
- Bảng có khung cuộn riêng `max-h-[520px] overflow-auto` nằm trong trang cũng đang cuộn, nên dễ kẹt cuộn.
- Mỗi bảng có thêm một thanh "Ẩn/hiện cột" cao 33px, và tay kéo resize rộng 8px vẫn bật trên mobile.
- Dòng chi tiết mở rộng dùng `colSpan` toàn bảng, nên panel chi tiết cũng rộng hơn 1.000px.

### 1.2 Phần "đầu trang" chiếm quá nhiều chiều cao trước dữ liệu
- Topbar mobile 46px (`app-navigation.tsx:162`), sau đó là `WorkspaceHeader` với 3 nút chữ không co (`Ẩn số tiền`, `Làm mới`, `Đăng xuất`). Tiêu đề bị ép còn khoảng 50px và bị cắt.
- Toolbar của panel chuyển sang `flex-col` ở ≤640px, nên mỗi chip lọc thành một hàng full-width.
- Ước lượng chiều cao trước hàng dữ liệu đầu tiên: Thu chi khoảng 700px (vượt màn hình 667px), Tổng quan khoảng 600px, Công nợ khoảng 500px, Việc cần làm khoảng 510px, ZCA khoảng 1.200px.

### 1.3 Vùng chạm quá nhỏ
- Nút hành động trên dòng cao 22px, chip lọc và ô tìm kiếm 24px, nút kỳ 28px, nút header 30px, hamburger 32px. Chuẩn chạm trên mobile là ≥ 40–44px.
- Thu chi, Công nợ và Nhắc việc có 2–3 nút 22px trên mỗi dòng (Sửa / Xoá / Trả nợ / Hoãn).

### 1.4 Khối KPI và biểu đồ không đồng nhất
- Bề rộng tối thiểu của thẻ KPI khác nhau theo màn: 140px, 180px, 200px và 110px.
- `TrendSummaryStrip` mặc định mở và lồng thẻ có viền trong khung có viền.
- `MicroBarChart` dùng `preserveAspectRatio="none"` nên nhãn bị méo, tooltip chỉ hoạt động bằng chuột.

### 1.5 Lỗi riêng từng màn
- **Lịch**: lưới 7 cột cố định, ô khoảng 48px với sự kiện chữ 11px bị cắt. Không có dạng xem danh sách (agenda) cho mobile.
- **ZCA**: thiếu trong `ROUTE_HEADER_MAP` nên header hiển thị "zalobot". Trang lại tự render tiêu đề riêng, nên có 2 nút Làm mới và 2 nút Đăng xuất. Bảng tự viết với độ rộng cố định khoảng 900px, ô tìm kiếm cố định `w-64`, 7 tab lọc wrap thành 3 dòng.
- **Tổng quan**: 6 bảng xếp chồng, mỗi bảng có khung cuộn 520px, ô tìm kiếm, thanh cột, STT và ID riêng.
- **Phân tích**: DataTable lồng trong DataPanel (viền đôi). Bảng dòng kỳ ảo vẫn có STT và ID.
- **Không đồng nhất**: toast lúc ở góc dưới phải, lúc ở giữa trên. Bo góc lẫn lộn 2px, 3px, 4px, `md` và `lg`. Padding `p-6` so với `p-3`.
- Prop `counter` của DataPanel được truyền vào nhưng không render, nên số bản ghi bị mất.

### 1.6 Đã ổn, giữ nguyên
- `Modal` thành bottom sheet trên mobile, có tính tới bàn phím và safe area.
- Drawer điều hướng hoạt động tốt.
- Zoom khi focus trên iOS đã có `IosViewportFix` xử lý. Không cần tăng font input lên 16px.

## 2. Đề xuất (theo thứ tự hiệu quả trên công sức)

### P1. DataTable có "chế độ danh sách" cho ≤640px (làm 1 lần, mọi màn được lợi)
- Mỗi bản ghi là một dòng phẳng 2 tầng, phân cách bằng `border-b`, không đổ bóng. Cách này vẫn đúng hướng Flat Enterprise.
  - Tầng 1: tên/mô tả bên trái, số tiền căn phải (đỏ/xanh theo thu/chi).
  - Tầng 2 (chữ nhỏ, màu mờ): danh mục · ngày · người tạo / nơi chốn.
- Cột khai báo thêm `mobile: 'title' | 'amount' | 'meta' | 'hidden'`. Màn nào chưa khai báo thì vẫn rơi về bảng cuộn ngang như hiện tại, nên có thể chuyển dần từng màn.
- Bỏ STT, ID, thanh "Ẩn/hiện cột" và tay resize trên mobile. Bỏ khung cuộn 520px, để trang cuộn tự nhiên.
- Chạm vào dòng mở **bottom sheet hành động** (dùng `Modal` sẵn có), chứa chi tiết đầy đủ, Sửa / Xoá / Trả nợ và "Xem ID" (mở `IdExplainerDialog`). Bỏ toàn bộ nút 22px trên dòng.

### P2. Gộp đầu trang thành một thanh
- Đưa tiêu đề trang lên topbar mobile (bên cạnh hamburger).
- Nút Ẩn/hiện số tiền thành icon 40px trên topbar. Làm mới và Đăng xuất chuyển vào drawer hoặc menu `⋯`.
- Trên mobile ẩn `WorkspaceHeader`. Tiết kiệm khoảng 90px và hết cảnh tiêu đề bị cắt.

### P3. Toolbar lọc gọn một hàng
- Chip lọc (Tất cả / Thu / Chi; trạng thái, chiều nợ) nằm trên một hàng cuộn ngang thay vì mỗi chip một dòng.
- Bộ lọc phụ và tìm kiếm gom vào nút "Bộ lọc" mở bottom sheet, ô tìm kiếm thu thành icon.
- Thanh chọn kỳ giữ một dòng.
- Thao tác chính (Thêm giao dịch, Điều chỉnh số dư) thành nút nổi (FAB) góc dưới.

### P4. KPI và biểu đồ
- Mobile dùng một dải KPI cuộn ngang hoặc lưới 2 cột cố định, chuẩn hoá một component `MetricGrid` cho mọi màn.
- `TrendSummaryStrip` mặc định thu gọn trên mobile.
- Biểu đồ giữ tỉ lệ và có tooltip khi chạm.

### P5. Chuẩn vùng chạm và nhất quán
- Ở ≤640px mọi control cao ≥ 40px (`max-[640px]:h-10`). Desktop vẫn giữ mật độ cao.
- Thống nhất vị trí toast (dưới, tính safe area) và padding (`p-3`).
- **Giữ nguyên bo góc nhỏ hiện tại** (`rounded-[3px]` / `rounded`), không chuẩn hoá sang `rounded-md` (anh chốt 2026-10-21). Chip và nút trong hình minh hoạ trước đó bo tròn chỉ để minh hoạ, không phải thiết kế đích.

### P6. Theo màn
- **Lịch**: mobile mặc định xem dạng agenda theo ngày; lưới tháng chỉ hiện chấm sự kiện, chạm vào ngày thì mở danh sách.
- **ZCA**: thêm vào `ROUTE_HEADER_MAP` và bỏ header trùng. Bảng luồng chuyển sang DataTable để dùng chế độ danh sách. Tab lọc thành chip cuộn ngang.
- **Tổng quan**: mỗi khối chỉ hiện 5 bản ghi gần nhất dạng danh sách, kèm link "Xem tất cả" sang trang chi tiết.
- **Tuỳ chọn**: thanh tab dưới (Tổng quan · Thu chi · Công nợ · Lịch · Thêm) thay hamburger cho 4 màn dùng nhiều nhất.

## 3. Lộ trình gợi ý

| Giai đoạn | Nội dung | Phạm vi | Rủi ro |
| --- | --- | --- | --- |
| A | P1 + P2 + P5, thử trên màn **Thu chi** | `data-table.tsx`, `app-navigation.tsx`, `workspace-header.tsx`, `transactions-table.tsx` | Trung bình: đổi component dùng chung, cần giữ nguyên hành vi desktop |
| B | Áp chế độ danh sách cho Công nợ, Nhắc việc, Việc cần làm, Danh bạ, Nơi chốn; làm P3 + P4 | Các common table và screen | Thấp–trung bình |
| C | P6: Lịch agenda, ZCA, Tổng quan, (tuỳ chọn) bottom tab bar | Từng màn | Trung bình |

## 4. Ảnh hưởng tài liệu và điểm cần quyết định
- `global/web-ui-direction.md` hiện ghi "bảng cuộn ngang trên mobile" và "STT/ID không ẩn được". P1 thay đổi hợp đồng này, nên khi implement phải cập nhật cả knowledge lẫn docs.
- Cần anh chọn:
  1. Có chấp nhận bỏ STT/ID trên mobile không (ID vẫn xem được qua bottom sheet)?
  2. Hamburger hay bottom tab bar?
  3. Bắt đầu từ giai đoạn A với Thu chi làm màn thử?
- Chưa kiểm chứng: hình ảnh render thật. Nên chụp màn hình trước/sau bằng trình duyệt ở 375px khi chạy được stack local.

---
metadata:
  agent-artifact:
    id: docs-module-calendar
    type: documentation
    depends_on:
      - .agents/knowledge/modules/calendar/README.md
      - apps/web/src/modules/calendar/api/calendar-api.ts
      - apps/web/src/modules/calendar/api/calendar-query.ts
      - apps/web/src/modules/calendar/model/calendar-date-utils.ts
      - apps/web/src/modules/calendar/presentation/components/calendar-grid.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-agenda.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-event-fields.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-screen.tsx
      - apps/api/src/google/google-resources.controller.ts
---

# Module lịch (calendar)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/calendar/README.md).

## Vai trò nghiệp vụ

Người dùng đã kết nối Google xem và chỉnh sửa sự kiện Google Calendar của mình ngay trên dashboard. Module `apps/web/src/modules/calendar` **chỉ** chứa lớp dữ liệu (API + TanStack Query), hàm xử lý ngày và component lưới tháng `CalendarGrid`. Trang `/calendar` thực tế là `CalendarScreen` nằm trong module **dashboard** (`modules/dashboard/presentation/components/calendar-screen.tsx`); màn hình này giữ trạng thái chế độ xem, điều hướng tháng, tìm kiếm, trạng thái sửa và dạng bảng `CalendarTable`.

## Thành phần trong module

- **API** (`api/calendar-api.ts`): lấy danh sách theo khoảng `timeMin`/`timeMax` (`GET /api/calendar/events`), sửa (`PATCH /api/calendar/events/:id`), xoá (`DELETE /api/calendar/events/:id`).
- **Query** (`api/calendar-query.ts`): mỗi khoảng thời gian là một cache riêng (`['calendarEvents', params]`). Sửa/xoá thành công thì làm mới toàn bộ cache lịch và cache `dashboard` để trang chủ không hiện dữ liệu cũ.
- **Hàm ngày** (`model/calendar-date-utils.ts`, có unit test):
  - `getCalendarGridRange`: tính khoảng thời gian bao trùm toàn bộ ô đang hiển thị của lưới (tuần bắt đầu từ Thứ 2, gồm cả ngày đệm của tháng trước/sau).
  - `getEventDateKeys`: trải sự kiện nhiều ngày lên từng ngày nó bao phủ. Ngày kết thúc của sự kiện cả ngày và mốc kết thúc đúng 00:00 được hiểu là **không bao gồm** (tránh hiện thừa một ngày).
  - `getWeekDays`, `addDays`, `toDateKey`, `formatEventTime`: tính tuần Thứ 2 → Chủ nhật quanh một ngày, cộng ngày theo nửa đêm giờ địa phương, khoá `YYYY-MM-DD` và giờ `HH:mm` — dùng chung cho lưới và agenda để hai chế độ xem luôn khớp nhau.
- **`CalendarGrid`**: component "điều khiển từ ngoài" — không tự giữ dữ liệu hay trạng thái sửa, mọi thứ đi qua props.
  - Lưới 7 cột Thứ 2 → Chủ nhật, ngày đệm làm mờ, tô sáng hôm nay, viền ngày đang chọn, badge số sự kiện mỗi ngày.
  - Mọi sự kiện trong ngày đều hiện thành thẻ (giờ bắt đầu + tiêu đề). Tiêu đề chỉ một dòng và bị cắt bằng `truncate`; xem đầy đủ qua tooltip hoặc panel chi tiết.
  - Panel ngày đang chọn liệt kê sự kiện kèm nút Sửa/Xoá; sửa trực tiếp tiêu đề (bắt buộc), giờ bắt đầu, giờ kết thúc, địa điểm, mô tả. Các ô nhập này nằm trong `CalendarEventFields`, dùng chung với sheet của agenda.
  - Trên điện thoại (≤ 640px) mỗi ô chỉ rộng khoảng 50px nên không đọc được chữ: thẻ sự kiện và badge số lượng bị ẩn, thay bằng tối đa 3 chấm cho ngày có sự kiện; ô cao tối thiểu 52px. Nút Sửa/Xoá/Lưu/Hủy trong panel ngày cao 40px cho dễ chạm.
- **`CalendarAgenda`** (mặc định trên điện thoại): lưới tháng 7 cột ở bề ngang 375px không hiện nổi tiêu đề sự kiện, nên điện thoại mở thẳng dạng danh sách theo ngày.
  - Dải tuần: nút tuần trước/tuần sau (40px) và 7 nút ngày cao 40px (thứ, ngày, chấm nếu có sự kiện); hôm nay tô nhạt, ngày đang chọn tô đặc.
  - Danh sách: ngày đang chọn luôn đứng đầu (trống thì báo "Không có sự kiện nào trong ngày này"), sau đó là các ngày còn lại trong tuần có sự kiện, mỗi ngày một tiêu đề. Mỗi dòng phẳng, cao tối thiểu 52px: giờ (hoặc "Cả ngày") + tiêu đề, dòng hai là địa điểm · mô tả.
  - Chạm một dòng mở bottom sheet chi tiết với nút Xoá / Sửa ở chân sheet. Bấm Sửa thì sheet chuyển sang ô nhập (không tự focus để bàn phím không bật lên đột ngột) với Hủy / Lưu. Đóng sheet khi đang sửa = huỷ sửa. Sửa trên điện thoại không phụ thuộc double-click.

## Phần do `CalendarScreen` (module dashboard) đảm nhận

- Chuyển giữa Lưới tháng và Bảng (mặc định Lưới), nút Hôm nay / tháng trước / tháng sau, nhãn tháng-năm theo ngôn ngữ, ô tìm kiếm theo tiêu đề/địa điểm/mô tả.
- Trên điện thoại có thêm nút **Lịch trình** (agenda) và đây là chế độ mặc định cho tới khi người dùng chọn chế độ khác; lưới tháng vẫn chọn được. Ở agenda, đổi tháng sẽ dời ngày đang chọn về ngày 1 của tháng đó, và chọn một ngày ở tháng khác sẽ đổi tháng đang tải — nhờ vậy khoảng dữ liệu đã tải luôn bao trùm tuần đang xem. Thanh công cụ trên điện thoại: Hôm nay/trước/sau 40px, các nút chế độ xem nằm trên một hàng cuộn ngang, ô tìm kiếm full width 40px.
- Dạng Bảng (`CalendarTable`) ở màn hẹp (≤ 960px) hiển thị danh sách: dòng 1 là tiêu đề + giờ bắt đầu, dòng 2 là địa điểm · mô tả; chạm dòng mở sheet chi tiết và sửa bằng nút Sửa ở chân sheet.
- Mỗi lần đổi tháng gọi API cho đúng khoảng của lưới; nếu API trả rỗng thì hiện rỗng, không lấy dữ liệu tóm tắt của dashboard bù vào.
- Xoá sự kiện hỏi xác nhận bằng `window.confirm`. Nút Thử lại làm mới mọi cache lịch và cache dashboard.
- Nếu tài khoản chưa kết nối Google, panel hiển thị gợi ý kết nối.

## Phía backend

`GoogleResourcesController` cung cấp `GET/POST /api/calendar/events` và `GET/PATCH/DELETE /api/calendar/events/:id`. Khi người dùng chưa cấp quyền Google hoặc Google báo lỗi, API danh sách trả mảng rỗng (không báo lỗi) — vì vậy "lịch trống" có thể là do chưa kết nối. `timeMin >= timeMax` bị từ chối (400); mặc định tối đa 100 sự kiện.

## Kiểm thử

`npm run test --workspace @zalobot/web` (spec `calendar-date-utils.spec.ts`), `npm run typecheck`, `npm run lint`.

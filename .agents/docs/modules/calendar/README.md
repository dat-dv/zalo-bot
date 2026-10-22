---
metadata:
  agent-artifact:
    id: docs-module-calendar
    type: documentation
    depends_on:
      - .agents/knowledge/modules/calendar/README.md
      - apps/api/src/calendar/calendar.service.ts
      - apps/api/src/calendar/calendar.controller.ts
      - apps/api/src/database/entities/calendar-event.entity.ts
      - apps/api/src/database/migrations/1724870000000-CreateCalendarEvents.ts
      - apps/web/src/modules/calendar/api/calendar-api.ts
      - apps/web/src/modules/calendar/api/calendar-query.ts
      - apps/web/src/modules/calendar/model/calendar-date-utils.ts
      - apps/web/src/modules/calendar/presentation/components/calendar-grid.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-agenda.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-event-sheet.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-screen.tsx
---

# Module lịch (calendar)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/calendar/README.md).

## Vì sao lịch phải lưu trong DB

Trước đây hệ thống **không lưu sự kiện nào**: mọi thao tác đi thẳng vào Google Calendar, và người chưa kết nối Google riêng thì dùng chung tài khoản Google của admin. Khi admin đăng nhập một tài khoản Google khác (hoặc người dùng đổi tài khoản), dashboard và bot chỉ còn thấy lịch của tài khoản mới, nhìn như sự kiện cũ bị mất.

Giờ sự kiện nằm trong bảng `calendar_events` của zalobot. Google Calendar chỉ giữ **bản sao**, để điện thoại vẫn nhận nhắc của Google.

- **Lịch dùng chung** như sổ tài chính: ai cũng xem được mọi sự kiện. Người tạo, nguồn (Zalo / dashboard / Google) và nhóm Zalo tạo ra sự kiện chỉ để hiển thị, không dùng để lọc.
- **Bản sao Google** được ghi vào tài khoản Google của người thao tác (token riêng, không có thì tài khoản dùng chung). Mỗi sự kiện nhớ bản sao nằm ở tài khoản nào (`google_account_email` + `google_event_id`).
- **Chưa kết nối Google** vẫn tạo được sự kiện, trạng thái "Chỉ lưu trong app".

## Đồng bộ với Google hoạt động thế nào

| Thao tác | Trong zalobot | Trên Google |
| --- | --- | --- |
| Tạo | Lưu ngay | Tạo bản sao nếu có kết nối. Google lỗi thì sự kiện vẫn còn, trạng thái "Lỗi đồng bộ". |
| Sửa | Sửa ngay | Bản sao còn truy cập được thì sửa theo. Bản sao nằm ở tài khoản cũ (đã đổi tài khoản) thì tạo bản sao mới ở tài khoản hiện tại. |
| Xoá | Xoá mềm (`deleted_at`) | Xoá bản sao nếu còn truy cập được; Google báo "không còn" thì bỏ qua. |
| Đồng bộ lại | — | Nút "Đồng bộ lại" trong chi tiết sự kiện, dùng cho sự kiện lỗi, chỉ lưu trong app, hoặc ở tài khoản cũ. |

**Nhập từ Google**: mỗi khi mở lịch (dashboard, trang Tổng quan, hoặc lệnh bot), hệ thống đọc tài khoản Google của người xem trong khoảng đang xem rồi ghi vào DB, nên sự kiện tạo thẳng trên app Google cũng hiện ra và được giữ lại.

- Lần đầu gặp một tài khoản Google: nhập 12 tháng trước đến 12 tháng sau (đánh dấu trong Redis `calendar:initial-import:<email>`).
- Sau đó mỗi khoảng thời gian chỉ đọc Google tối đa 5 phút một lần để tiết kiệm quota.
- Sự kiện đã xoá trong zalobot thì không bị nhập lại.
- Sự kiện của chính tài khoản đó, bắt đầu trong khoảng đang xem, mà Google không còn trả về ⇒ người dùng đã xoá trên Google ⇒ xoá mềm trong zalobot.
- Nhập hàng loạt không ghi nhật ký kiểm toán (tránh hàng nghìn dòng); tạo/sửa/xoá do người dùng làm thì có ghi.

**Sự kiện ở tài khoản cũ**: không lấy lại được sự kiện nằm ở tài khoản Google mà hệ thống không còn token. Muốn giữ lịch của tài khoản cũ, đăng nhập lại tài khoản đó một lần để hệ thống nhập vào DB rồi đổi về.

## Backend (`apps/api/src/calendar/`)

- `CalendarService` là nơi duy nhất đọc/ghi sự kiện. `GoogleCalendarService` (module google) chỉ còn là client Google: đọc nhiều trang, thêm, sửa, xoá bản sao.
- API giữ nguyên đường dẫn cũ `/api/calendar/events` (danh sách, chi tiết, tạo, sửa, xoá), thêm `POST /api/calendar/events/:id/resync`. Mọi đường dẫn khai báo trong `API_ROUTES` (`calendarEvents`, `calendarEvent(id)`, `calendarEventResync(id)`).
- Danh sách nhận `timeMin`, `timeMax` (ISO, tối đa 400 ngày) và `query`. Lỗi Google không làm request thất bại, chỉ thể hiện ở trạng thái đồng bộ.
- Trang Tổng quan (`GET /api/dashboard`) lấy 10 sự kiện trong 7 ngày tới từ DB, không còn phụ thuộc kết nối Google.
- Bot: `/today`, `/week`, tra cứu lịch đọc từ DB. Tạo lịch không còn đòi kết nối Google. Xoá lịch tìm trong các sự kiện sắp tới; mã duyệt cũ (đang chờ trong Redis lúc triển khai) chứa id Google vẫn xoá được vì `getEvent` tìm cả theo `google_event_id`. Phần Việc cần làm của `/today`, `/week` cũng đọc từ DB (xem `modules/tasks/README.md`). Các hàm dùng chung với việc cần làm (tìm tài khoản giữ bản sao, tên người tạo, trạng thái đồng bộ) nằm ở `apps/api/src/google/google-copy.util.ts`; màu nhãn đồng bộ trên web ở `apps/web/src/shared/ui/google-sync.ts`.

## Giao diện trang Lịch

**Vấn đề cũ**: trên điện thoại thanh công cụ chiếm 3 hàng trước khi tới nội dung; chế độ Lịch trình chỉ hiện đến hết tuần, nên hôm nay trống là gần như cả màn hình trống. Trên desktop phải cuộn xuống dưới lưới mới thấy chi tiết ngày; thẻ sự kiện thiếu thông tin; không tạo được sự kiện từ dashboard.

**Chung**
- Dải tóm tắt 4 ô trên một hàng (điện thoại thu nhỏ ô, nhãn được xuống 2 dòng): Hôm nay, 7 ngày tới, Trong tháng, **Chưa lên Google** (bấm để chỉ xem các sự kiện cần đồng bộ lại; bấm lại hoặc "Bỏ lọc" để tắt). Số đếm không phụ thuộc ô tìm kiếm.
- Chưa kết nối Google thì hiện dòng nhắc: sự kiện vẫn lưu trong zalobot, chỉ chưa có nhắc trên Google.
- Thẻ sự kiện: vạch màu bên trái theo trạng thái (xanh lá = đang diễn ra, xanh dương = sắp tới, xám mờ = đã qua), giờ bắt đầu–kết thúc và thời lượng, tiêu đề, địa điểm, mô tả 2 dòng, người tạo · nhóm Zalo, nhãn đồng bộ (chỉ hiện khi chưa đồng bộ xong).
- Chạm sự kiện mở **sheet chi tiết**: thời gian, địa điểm, mô tả, các mốc nhắc, nguồn và thời điểm tạo, trạng thái bản sao Google kèm email tài khoản, nút Đồng bộ lại; chân sheet là Xoá / Sửa. Xoá hỏi lại bằng hộp xác nhận trong app (`ConfirmDialog`), không dùng `window.confirm`.
- Form tạo/sửa: tiêu đề, ô "Cả ngày" (đổi ô giờ thành ô ngày), bắt đầu, kết thúc, địa điểm, mô tả nhiều dòng, các mốc nhắc (lúc bắt đầu, 10 phút, 30 phút, 1 giờ, 1 ngày). Kết thúc phải sau bắt đầu. Sự kiện mới mặc định tròn giờ kế tiếp (hôm nay) hoặc 9:00 (ngày khác), dài 1 giờ.

**Desktop / tablet (> 640px)**
- Một hàng công cụ: `‹ Tháng 10 2026 ›`, Hôm nay, chuyển chế độ Lưới tháng / Danh sách, ô tìm kiếm, nút **+ Thêm sự kiện** (ở ≤ 960px nút này chuyển xuống thanh hành động dưới đáy).
- Lưới tháng bên trái, **cột phải** luôn hiện "Ngày đã chọn" và "Sắp tới · 14 ngày", không phải cuộn xuống. Dưới 1180px cột phải xuống dưới lưới.
- Ô ngày cao đều nhau, tối đa 3 sự kiện rồi "+N"; sự kiện cả ngày là thanh màu đặc, sự kiện đã qua làm mờ.
- Chế độ Danh sách dùng `CalendarTable` (thêm cột Người tạo và Google Calendar); nút Sửa trên dòng mở sheet chi tiết.

**Điện thoại / PWA (≤ 640px)**
- Đầu trang gọn: `‹ tháng ›`, Hôm nay, icon tìm kiếm (bấm mới hiện ô tìm). Chế độ xem là nút chuyển `Lịch trình | Lưới tháng` chiếm một hàng.
- **Nhớ chế độ xem**: tab đã chọn được lưu vào `localStorage`, F5 hay mở lại vẫn giữ. Điện thoại (`Lịch trình | Lưới tháng`) và desktop (`Lưới tháng | Danh sách`) nhớ riêng (`zalobot:calendar-view:phone` / `:desktop`) vì hai bên có bộ tab khác nhau. Trình duyệt chặn lưu trữ (chế độ riêng tư) thì vẫn đổi tab được, chỉ không nhớ sau khi tải lại. Tháng đang xem, ngày chọn và ô tìm kiếm không được lưu.
- **Lịch trình** (mặc định): dải 7 ngày có chấm cho ngày bận, nút tuần trước/tuần sau; bên dưới là ngày đang chọn rồi liền mạch các ngày có sự kiện trong 14 ngày tới. Ngày đang chọn trống chỉ hiện một dòng "Không có sự kiện", phần sắp tới vẫn hiện ngay bên dưới.
- Nút **+ Thêm sự kiện** nằm trên thanh hành động phía trên thanh tab. Form tạo/sửa mở toàn màn hình để không bị bàn phím che.

## Kiểm thử

- API: `npm run test --workspace @zalobot/api` (gồm `calendar.service.spec.ts`: tạo có/không có Google, Google lỗi, sửa khi đã đổi tài khoản, xoá khi Google báo đã mất, tìm theo id Google, nhập và xoá mềm; `calendar-event.mapper.spec.ts`: sự kiện cả ngày, múi giờ, nhãn bot).
- Web: `npm run test --workspace @zalobot/web` (`calendar-date-utils.spec.ts`: lưới, sự kiện cả ngày, sắp xếp, form nháp, thời lượng, trạng thái đồng bộ).
- `npm run typecheck`, `npm run lint`, `npm run build`.
- Kiểm tra tay: tạo sự kiện khi có và khi không có Google; đổi tài khoản Google rồi xác nhận sự kiện cũ vẫn còn với nhãn "Ở tài khoản Google cũ" và bấm Đồng bộ lại; xoá một sự kiện trên app Google rồi mở lại lịch sau 5 phút.

## Màu nút ở dark mode

- Ở dark mode, nút hành động chính dùng tông xanh sky (`dark:bg-sky-600 dark:text-white`), không dùng kiểu đảo màu `dark:bg-slate-100` vì nó thành khối trắng chói trên nền tối. Trong module này áp dụng cho nút chính trong sheet sự kiện (Lưu/Sửa, hằng `PRIMARY` của `CalendarEventSheet`); nút Xoá giữ tông đỏ `DANGER`. Light mode giữ nút đen như cũ. Xem [web-ui-direction](../../global/web-ui-direction.md).

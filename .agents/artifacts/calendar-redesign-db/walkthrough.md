# Walkthrough: Lịch lưu trong DB + làm lại trang Lịch

Kế hoạch: [implementation_plan.md](implementation_plan.md). Anh duyệt bằng "làm xong commit push". Ba câu hỏi mở anh chưa trả lời nên làm theo đề xuất: lịch **dùng chung**, **có** nút Thêm sự kiện, xoá trên Google thì **xoá mềm** trong zalobot.

## Backend
- Bảng mới `calendar_events` (entity + migration `1724870000000-CreateCalendarEvents`), đăng ký trong `database.module.ts` và `data-source.ts`.
- Module mới `apps/api/src/calendar/`: `CalendarService` (tạo/sửa/xoá mềm/đồng bộ lại, nhập từ Google có throttle, chuyển bản sao sang tài khoản hiện tại), `CalendarController` (giữ route `/api/calendar/events`, thêm `/:id/resync`), DTO class-validator, mapper thuần.
- `GoogleCalendarService` chỉ còn là client Google (đọc nhiều trang, insert/patch/delete; hỗ trợ sự kiện cả ngày).
- Gỡ endpoint lịch khỏi `GoogleResourcesController`; trang Tổng quan, 5 lệnh bot lịch và luồng duyệt mã (`TransactionConfirmationService`) chuyển sang `CalendarService`.
- Contracts: `ICalendarEventItem` thêm `allDay`, `reminderMinutes`, người tạo, nguồn, `sync`; `API_ROUTES.calendarEvent(id)`, `calendarEventResync(id)`; i18n vi/en.

## Web
- Màn hình Lịch viết lại: dải tóm tắt (lọc "Chưa lên Google"), lưới tháng + cột phải (ngày đã chọn, sắp tới 14 ngày), chế độ Danh sách (`CalendarTable` thêm cột Người tạo, Google Calendar), lịch trình điện thoại liền 14 ngày, sheet chi tiết/tạo/sửa, nút Thêm sự kiện (toolbar desktop, `MobileActionBar` ≤ 960px).
- `ConfirmDialog` dùng chung (tách từ `LogoutConfirmDialog`) cho xoá sự kiện.
- Bỏ `calendar-event-fields.tsx` (thay bằng `calendar-event-form.tsx`).

## Kiểm tra đã chạy
- API: `npm run test` 515/515 pass, `lint`, `typecheck`, `build`: pass.
- Web: `npm run test` 69/69 pass, `lint`, `typecheck`, `build` (static export): pass.
- Migration SQL chạy thử trên container `postgres:16-alpine` tạm: tạo bảng, index, `ON CONFLICT DO NOTHING` với unique index có điều kiện: OK.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm được
- Không xem được UI trên máy: dev server trong browser pane bị macOS chặn (`EPERM uv_cwd`). Cần xem trên prod sau deploy.
- Chưa khởi động thật toàn bộ API (DI) với DB thật: chỉ có test quét module; khởi động thật sẽ chạy cả bot Zalo/ZCA với cấu hình thật nên không chạy local.

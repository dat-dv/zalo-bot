# Kế hoạch hiển thị đầy đủ tất cả sự kiện trong Calendar Grid

## Mục tiêu

Loại bỏ việc cắt giảm hiển thị (`maxVisibleEvents = 2` và `+{count} sự kiện`) trên giao diện Lưới lịch tháng (`CalendarGrid`), hiển thị trực tiếp toàn bộ các sự kiện của từng ngày trên trang `/calendar`.

## User Review Required

> [!NOTE]
> Khi hiển thị tất cả các sự kiện trong ô ngày, chiều cao các ô sẽ tự động dãn theo số lượng item nhờ `min-h-[96px]` của CSS Grid, giữ bố cục đồng đều theo từng tuần và hiển thị đầy đủ thông tin sự kiện mà không bị che khuất.

## Proposed Changes

### Frontend Web (`apps/web`)

#### [MODIFY] [calendar-grid.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/calendar/presentation/components/calendar-grid.tsx)

- Bỏ logic cắt mảng sự kiện `const maxVisibleEvents = 2`, `visibleEvents = cell.events.slice(0, maxVisibleEvents)` và `hiddenCount`.
- Render trực tiếp tất cả sự kiện trong `cell.events.map(...)`.
- Bỏ dòng hiển thị phụ `+{count} sự kiện`.

### Canonical Knowledge & Docs Sync (`.agents/`)

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/calendar/README.md)

- Cập nhật tài liệu kỹ thuật tiếng Anh của module `calendar`: bỏ đề cập "+N more badge", ghi nhận tính năng hiển thị toàn bộ sự kiện trong ô lưới tháng.

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/calendar/README.md)

- Cập nhật tài liệu hướng dẫn tiếng Việt của module `calendar`: mô tả trực quan việc hiển thị toàn bộ danh sách sự kiện trong từng ô ngày.

## Verification Plan

### Automated Tests

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run agent-system:validate`

### Manual Verification

- Truy cập trang `/calendar` trên giao diện web.
- Kiểm tra các ngày có từ 3 sự kiện trở lên trong tháng: các ô ngày hiển thị toàn bộ các thẻ sự kiện kèm thời gian, không còn bị thu gọn thành "+X sự kiện".

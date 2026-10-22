# Implementation plan: tab "Đã xong" ở `/reminders`

- Route: implement · Phase 1 (planning) · Rủi ro: **MEDIUM** (đổi API công khai theo hướng tương thích ngược, sửa nhiều file web, không có migration)
- Plugin: backend, backend-bridge-frontend, frontend-orchestration, tanstack-query, nextjs-static

## 1. Mục tiêu

Người dùng xem lại được các **lời nhắc cá nhân đã xong** trên dashboard:

- `GET /api/reminders` nhận thêm tham số trạng thái `status=upcoming|done`. Mặc định là `upcoming`, hành vi giữ nguyên như hiện tại.
- Trang `/reminders` có hai tab **Sắp tới / Đã xong**. Tab đang chọn được lưu trên URL (`/reminders?status=done`).

**Ngoài phạm vi:** bot Zalo (`/reminders` trong chat), payload Home (`reports.controller.ts`), nhắc việc gắn với task, tự dọn lời nhắc cũ. Các chỗ này vẫn dùng `getUserUpcomingReminders` như cũ.

## 2. Hiện trạng (đã kiểm tra trong code)

| Chỗ | Hiện trạng |
| --- | --- |
| `apps/api/src/reminders/reminders.service.ts:188` | `getUserUpcomingReminders` chỉ lấy `isTriggered = false`, sắp theo `remindAt` tăng dần |
| `reminders.service.ts:182`, `:243`, `:284` | Lời nhắc xong thì được đánh dấu `isTriggered = true, status = 'completed', completedAt = now`, **không xoá** |
| `reminders.service.ts:183` | Thêm giờ mới ở tương lai cho lời nhắc đã xong thì nó tự quay về `pending` |
| `reminders.controller.ts:34` | `GET /` không nhận query |
| `reminders.controller.ts:96` | `withChatNames` trải `...row`, nên `completedAt` đã có trong JSON nhưng `IReminderListItem` chưa khai báo |
| `apps/web/.../reminders-screen.tsx:62` | Khi `useRemindersQuery` trả về rỗng, màn hình **lấy tạm** `dashboard.data.reminders` (là danh sách sắp tới). Nếu giữ nguyên, tab Đã xong rỗng sẽ hiện nhầm lời nhắc sắp tới |
| `apps/web/src/modules/reminders/api/reminders-query.ts:11` | Query key chỉ có `['reminders']`, chưa tách theo trạng thái |
| `apps/web/.../tasks-screen.tsx:331` | Đã có mẫu chip lọc "Tất cả / Cần làm / Đã xong" (`CHIP_PHONE`, bo góc `rounded-[3px]`), sẽ dùng lại cùng kiểu |
| `transactions-screen.tsx:43`, `app/(private)/transactions/page.tsx` | Đã có mẫu lưu filter trên URL (`useSearchParams` + `router.replace` + bọc `<Suspense>`) |

**Định nghĩa "Đã xong":** `isTriggered = true`, bao gồm cả lời nhắc gửi hết các lần lẫn lời nhắc người dùng bấm "✅ Đã xong". Lời nhắc lặp (`daily`/`weekly`) không bao giờ tự xong nên vẫn ở tab Sắp tới. Không cần migration: dữ liệu cũ đã có sẵn và đã có index trên `is_triggered`.

## 3. Thay đổi dự kiến

### 3.1 Contracts: `packages/contracts/src/index.ts`

- Thêm:
  ```ts
  export const REMINDER_LIST_STATUSES = ['upcoming', 'done'] as const;
  export type ReminderListStatus = (typeof REMINDER_LIST_STATUSES)[number];
  export const REMINDER_LIST_LIMITS = { DONE_MAX: 200 } as const;
  export function isReminderListStatus(value: unknown): value is ReminderListStatus;
  ```
- `IReminderListItem`: thêm `completedAt?: string` (thời điểm lời nhắc xong).
- i18n (vi + en):
  - `reminders.tab.upcoming`: "Sắp tới" / "Upcoming"
  - `reminders.tab.done`: "Đã xong" / "Done"
  - `reminders.tabs`: "Trạng thái lời nhắc" / "Reminder status" (aria-label của nhóm tab)
  - `reminders.columns.completedAt`: "Xong lúc" / "Done at"
  - `reminders.noDone`: "Chưa có lời nhắc nào đã xong" / "No finished reminders yet"
- Không thêm route mới. Vẫn dùng `API_ROUTES.reminders` và `APP_ROUTES.reminders`, tham số trạng thái đi qua query string.

### 3.2 API: `apps/api/src/reminders`

- `reminders.service.ts`: thêm `getUserReminders(userId, status: ReminderListStatus)`.
  - `upcoming`: gọi lại `getUserUpcomingReminders`, giữ nguyên logic.
  - `done`: `isTriggered = true` của user, sắp theo `completedAt DESC` (`NULLS LAST`), rồi đến `remindAt DESC`; lấy tối đa `REMINDER_LIST_LIMITS.DONE_MAX` dòng.
- `reminders.controller.ts`: `list(@Req() req, @Query('status') status?: string)`.
  - Thiếu tham số thì coi là `upcoming`.
  - Giá trị không hợp lệ thì trả 400 `status is invalid.` (kiểm tra bằng `isReminderTargetMode`-style guard `isReminderListStatus`, cùng cách controller đang kiểm tra các field khác).
  - Thêm `@ApiQuery` cho Swagger.
- Test:
  - `reminders.service.spec.ts`: `done` chỉ lấy `isTriggered = true` của đúng user, có `order` và `take`; `upcoming` giữ nguyên.
  - Controller: thiếu `status` thì gọi `upcoming`; `status=done` gọi `done`; `status=abc` trả 400. Nếu chưa có spec cho controller thì thêm vào spec sẵn có gần nhất.

### 3.3 Web

- `apps/web/src/modules/reminders/api/reminders-api.ts`: `getReminders(status, signal)` gửi `params: { status }`.
- `reminders-query.ts`:
  - Query key: `remindersQueryKeys = { all: () => ['reminders'] as const, list: (status) => ['reminders', status] as const }`.
  - `useRemindersQuery(status)`.
  - Các mutation invalidate `all()`, nên sửa, xoá hay "nhắc lại" đều làm mới cả hai tab.
- `apps/web/src/modules/reminders/model/reminder-list-status.ts` (mới, hàm thuần) kèm spec: `reminderListStatusFrom(searchParams)` đọc `status`, giá trị lạ thì về `upcoming`.
- `reminders-screen.tsx`:
  - Đọc và ghi tab qua `useSearchParams` + `router.replace(..., { scroll: false })`. Tab `upcoming` thì xoá tham số khỏi URL cho gọn.
  - Thêm hai chip tab trong toolbar, cùng style với `tasks-screen`, gắn `aria-pressed`.
  - **Chỉ tab Sắp tới** mới lấy tạm `dashboard.data.reminders`. Tab Đã xong dùng đúng dữ liệu của query (rỗng thì hiện `reminders.noDone`).
  - Tab Đã xong: không truyền `onSnooze`. Vẫn cho Sửa và Xoá. Sửa giờ sang tương lai thì lời nhắc tự về Sắp tới (logic API sẵn có), có toast như hiện tại.
  - Ô tìm kiếm áp cho tab đang mở. Bộ đếm dòng theo tab.
- `reminders-table.tsx`: thêm prop `showCompletedAt`. Khi bật, hiện thêm cột "Xong lúc" (`completedAt`, cùng định dạng ngày giờ với cột lịch). Cột lịch vẫn hiện các lần nhắc kèm dấu đã gửi như hiện tại.
- `apps/web/app/(private)/reminders/page.tsx`: bọc `<Suspense>` vì giờ dùng `useSearchParams` (static export bắt buộc, giống trang transactions).

### 3.4 Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/reminders/README.md` (EN):
  - Bảng API: `GET /api/reminders?status=upcoming|done`.
  - Mục Web UI: hai tab, URL state, chỉ tab Sắp tới mới lấy tạm dữ liệu Home, tab Đã xong không có Snooze, thêm cột `completedAt`.
  - Contracts: `REMINDER_LIST_STATUSES`, `completedAt`.
- `.agents/docs/modules/reminders/README.md` (VI): giải thích "đã xong" là gì, tại sao lời nhắc lặp không vào tab này, cách làm một lời nhắc đã xong nhắc lại.
- `CONTEXT.md`: thêm thuật ngữ **Lời nhắc đã xong** (không còn lần nhắc nào chờ gửi, hoặc đã bấm Đã xong; vẫn được giữ để xem lại cho tới khi xoá).
- Không thêm file docs mới, nên `.agents/docs/README.md` không đổi.

## 4. Kiểm tra

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test --workspace @zalobot/api` (service và controller spec)
4. `npm run test --workspace @zalobot/web` (spec `reminder-list-status`)
5. `npm run build --workspace @zalobot/web` (đảm bảo `<Suspense>` đúng với static export)
6. `node .claude/hooks/docs-drift-check.mjs`
7. Nếu có dev server: mở `/reminders`, chuyển tab, F5 ở `?status=done`, thử sửa giờ một lời nhắc đã xong rồi kiểm tra nó quay về tab Sắp tới. Bước này có chạy được hay không sẽ được báo rõ.

## 5. Rủi ro và quyết định cần duyệt

- **Tương thích ngược:** client cũ, bot và Home không gửi `status`, nên vẫn nhận danh sách sắp tới.
- **Giới hạn 200 lời nhắc đã xong**, mới nhất trước, chưa có "Tải thêm". Nếu muốn phân trang thật thì phải đổi response sang dạng có `total`; đề xuất để sau.
- **Tab Đã xong vẫn cho Sửa.** Sửa giờ sang tương lai sẽ mở lại lời nhắc. Nếu muốn tab này chỉ để xem (chỉ cho Xoá) thì báo để bỏ nút Sửa.
- Lời nhắc có `status = 'cancelled'` (nếu có dữ liệu cũ) và `isTriggered = true` cũng vào tab Đã xong. Hiện chưa có luồng nào tạo `cancelled`.

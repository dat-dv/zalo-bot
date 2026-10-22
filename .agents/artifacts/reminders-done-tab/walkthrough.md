# Walkthrough: tab "Đã xong" ở `/reminders`

Làm theo [implementation_plan.md](implementation_plan.md) đã duyệt, giữ nguyên các quyết định ở mục 5: tab Đã xong vẫn cho sửa, giới hạn 200 dòng, chưa phân trang.

## Đã làm

- **Contracts** (`packages/contracts/src/index.ts`):
  - Thêm `REMINDER_LIST_STATUSES`, `ReminderListStatus`, `isReminderListStatus`, `REMINDER_LIST_LIMITS.DONE_MAX = 200`.
  - Thêm `completedAt?` vào `IReminderListItem`.
  - Thêm 5 chuỗi i18n (vi + en).
- **API** (`apps/api/src/reminders`):
  - `GET /api/reminders?status=upcoming|done`. Không gửi `status` thì là `upcoming`, giá trị lạ trả 400.
  - `RemindersService.getUserReminders` / `getUserDoneReminders`.
  - Bot `/reminders` và trang Home vẫn dùng `getUserUpcomingReminders`.
- **Web**:
  - Thêm hai chip tab, tab đang mở lưu trên URL (`model/reminder-list-status.ts`).
  - Query key theo tab.
  - Chỉ tab Sắp tới mới lấy tạm dữ liệu dashboard khi danh sách rỗng.
  - Tab Đã xong có thêm cột "Xong lúc" và bỏ nút Nhắc lại.
  - Trang `/reminders` được bọc `<Suspense>`.
- **Tài liệu**:
  - knowledge và docs của `reminders` và `dashboard`.
  - `CONTEXT.md` thêm thuật ngữ "Lời nhắc đã xong".

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npm run build --workspace @zalobot/contracts` | OK. API đọc contracts từ `dist`, nên cần build lại trước khi chạy test API |
| `npm run typecheck` | OK (api, web, contracts) |
| `npm run lint` | OK |
| `npm run test` | api 620/620, web 119/119 |
| `npm run build --workspace @zalobot/web` | OK, `/reminders` export tĩnh |
| `node .claude/hooks/docs-drift-check.mjs` | PASS |

## Chưa kiểm tra

- **Chưa thử tay trên trình duyệt.** Máy không chạy Postgres của zalo-bot, và `DATABASE_URL` trong `.env` có thể trỏ tới DB thật, nên không dựng API cục bộ. Cần thử sau khi deploy:
  - Chuyển tab qua lại.
  - F5 ở `?status=done`.
  - Sửa giờ một lời nhắc đã xong sang tương lai, kiểm tra nó quay về tab Sắp tới.
  - Xem trên điện thoại.
- Prettier báo `reminder-create-form.spec.ts` lệch định dạng. File này đã như vậy từ trước và không thuộc task, nên không sửa.

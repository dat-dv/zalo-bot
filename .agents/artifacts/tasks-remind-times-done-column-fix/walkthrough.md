# Walkthrough: sửa `remindTimes` của /api/tasks và cột "Xong lúc"

Plan đã duyệt: [implementation_plan.md](implementation_plan.md), giữ nguyên các quyết định ở mục 7.

## Đã làm

### Lỗi 1 — `/api/tasks` từ chối `remindTimes` dạng object

- `apps/api/src/tasks/dto/task.dto.ts`:
  - Thêm `@Transform(keepRawRemindTimes)` vào `remindTimes` của cả `CreateTaskDto` và `UpdateTaskDto`. Hàm này trả đúng giá trị `remindTimes` trong body thô (`obj`), có kiểm tra `obj` là object, không ép kiểu `any`.
  - Sửa mô tả Swagger của `UpdateTaskDto.remindTimes`: trước ghi `type: [String]`, nay ghi rõ phần tử là ISO string hoặc object.
- `apps/api/src/tasks/dto/task.dto.spec.ts` (mới) có 4 test chạy qua `AppValidationPipe` thật:
  - object và chuỗi được giữ nguyên, và `parseRemindTimesBody` ra đúng rule lặp;
  - `[]` vẫn xoá hết giờ nhắc;
  - không gửi `remindTimes` thì field vẫn là `undefined`;
  - quá `MAX_TIMES` thì trả 400.
- Lưu ý về test:
  - `tsx` (esbuild) không phát metadata `design:type`, nên test ban đầu pass cả khi chưa sửa; chạy như vậy không bắt được lỗi.
  - Test nay tự gán `design:type = Array` cho `remindTimes` giống `nest build` (tsc, `emitDecoratorMetadata`).
  - Khi đã gán, chạy trên code cũ thì 2 test fail, khớp lỗi trên prod; sau khi sửa thì cả 4 pass.

### Lỗi 2 — cột "Xong lúc" bị ẩn khi chuyển tab

- `apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx`: `RemindersTable` có `key={status}` và id bảng `reminders` (Sắp tới) hoặc `reminders-done` (Đã xong).
- Docs: thêm một ý vào `RemindersScreen` trong `.agents/knowledge/modules/dashboard/README.md` (EN) và `.agents/docs/modules/dashboard/README.md` (VI): mỗi tab là một bảng riêng, nên cột được nhớ riêng từng tab.

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npx tsx --test src/tasks/dto/task.dto.spec.ts` trên code cũ (đã gán metadata) | 2 fail, đúng lỗi prod |
| cùng lệnh sau khi sửa | 4/4 pass |
| `npm run build --workspace @zalobot/contracts` | OK |
| `npm run test --workspace @zalobot/api` | 684/684 pass (lần chạy đầu có 1 fail do phiên khác đang sửa file audit; chạy lại thì pass) |
| `npm run typecheck` (api, web) | OK |
| `npx eslint` cho 2 file DTO/spec | OK |
| `npm run lint --workspace @zalobot/web` | OK |
| `npm run build --workspace @zalobot/web` | OK |
| `nest build` rồi chạy `AppValidationPipe` trên DTO đã biên dịch | object giữ nguyên (trước khi sửa thì ra `[]`) |
| `node .claude/hooks/docs-drift-check.mjs` | còn 1 lỗi ở module `audit`, không thuộc task này |

## Còn lại và ghi chú

- Có một phiên khác (`audit-log-page-fixes`) đang sửa chung checkout này: audit, users, zca, `packages/contracts`, `dashboard-home-screen.tsx` và một migration mới.
  - Lỗi lint (prettier ở `audit.service*.ts`, `users-session-profile.spec.ts`) và lỗi docs-drift module `audit` đều từ các file đó. Task này không đụng tới.
- Chưa thử tay trên trình duyệt ở local, và chưa thử lại trên prod (cần deploy).
- Chưa commit. Khi commit chỉ nên add các file của task này:
  - `apps/api/src/tasks/dto/task.dto.ts`
  - `apps/api/src/tasks/dto/task.dto.spec.ts`
  - `apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx`
  - hai file `modules/dashboard/README.md` (knowledge và docs)
  - thư mục artifact này

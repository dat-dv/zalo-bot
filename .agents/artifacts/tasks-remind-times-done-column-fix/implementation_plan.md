# Implementation plan: sửa `remindTimes` của /api/tasks và cột "Xong lúc"

Trạng thái: chờ duyệt (Phase 1)
Route: implement · Authority: inspect-and-plan

## 1. Bối cảnh

Đã thử tay trên prod ngày 2026-10-23 và thấy hai lỗi.

| # | Lỗi | Mức độ | Nguồn |
| --- | --- | --- | --- |
| 1 | `POST/PATCH /api/tasks` trả 400 "remindTimes is invalid." khi phần tử `remindTimes` là object, kể cả khi mọi giờ đều "Không lặp". Hệ quả: dashboard không tạo hay sửa được việc nào có giờ nhắc. | Cao (prod đang lỗi) | commit `cab49fe` |
| 2 | Chuyển từ tab Sắp tới sang Đã xong ở `/reminders` thì cột "Xong lúc" bị ẩn. Tải lại thẳng trang `?status=done` thì cột hiện. | Thấp | tab Đã xong (`reminders-done-tab`) |

## 2. Nguyên nhân

### Lỗi 1

- `AppValidationPipe` (`apps/api/src/common/pipes/app-validation.pipe.ts`) bật `transform: true` và `transformOptions: { enableImplicitConversion: true }`.
- `CreateTaskDto.remindTimes` và `UpdateTaskDto.remindTimes` (`apps/api/src/tasks/dto/task.dto.ts`) có kiểu `unknown[]`. Metadata kiểu của TypeScript ghi là `Array`, nên class-transformer chuyển ngầm từng phần tử object thành `[]`.
  - Đã tái hiện bằng bản build hiện tại: đầu vào `[{ remindAt, repeatType: 'none' }, "2027-01-06T02:00:00.000Z"]` ra `[[], "2027-01-06T02:00:00.000Z"]`.
  - Sau đó `parseRemindTimesBody` gặp `[]` (không phải object có `remindAt`) nên báo lỗi.
- `/api/reminders` không bị vì controller nhận `@Body() body: Record<string, unknown>`, không có DTO class.
- Test hiện có gọi thẳng controller hoặc service, không chạy qua pipe, nên không bắt được lỗi.
- Đã kiểm tra: chỉ hai field này trong `apps/api/src/**/*.dto.ts` dùng `unknown[]`.

### Lỗi 2

`DataTable` (`apps/web/src/shared/ui/data-table.tsx`) chỉ đọc danh sách cột ở lần render đầu:

- `useState(initialColumnIds)` lấy giá trị một lần khi mount.
- Tab Sắp tới không có cột `completedAt`, nên khi chuyển tab, cột mới không nằm trong `visibleColumnIds`.

Ngoài ra, bảng dùng chung khoá localStorage `zalobot:table-columns:reminders` cho cả hai tab. Nếu người dùng từng bật/tắt cột ở tab Sắp tới, danh sách đã lưu không có `completedAt`. Khi đó cột vẫn bị ẩn kể cả sau khi remount. Vì vậy chỉ thêm `key={status}` là chưa đủ.

## 3. Thay đổi đề xuất

### 3.1 API — giữ nguyên giá trị gốc của `remindTimes`

File `apps/api/src/tasks/dto/task.dto.ts`, áp dụng cho cả `CreateTaskDto` và `UpdateTaskDto`:

```ts
import { Transform, Type } from 'class-transformer';

  // Items are ISO strings or `{ remindAt, repeatType?, repeatWeekdays? }`; keep them as sent,
  // because implicit conversion would turn each object into `[]`. parseRemindTimesBody checks them.
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.remindTimes)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TIME_LIMITS.MAX_TIMES)
  remindTimes?: unknown[];
```

- `@Transform` nhận `obj` là body thô, nên trả lại đúng mảng client gửi.
- `@IsArray` và `@ArrayMaxSize` vẫn kiểm tra mảng gốc.
- Việc kiểm tra từng phần tử vẫn do `parseRemindTimesBody` làm như cũ.
- Sửa thêm mô tả Swagger của `UpdateTaskDto.remindTimes`: đang ghi `type: [String]`, đổi cho khớp `CreateTaskDto` (ISO string hoặc object).
- Không đổi `AppValidationPipe`. Tắt `enableImplicitConversion` toàn cục sẽ ảnh hưởng mọi query hoặc DTO số khác.

### 3.2 API — test chạy qua pipe thật

Tạo file mới `apps/api/src/tasks/dto/task.dto.spec.ts`, dùng `node:test` theo mẫu `app-validation.pipe.spec.ts`. Mọi test đều chạy `new AppValidationPipe().transform(body, { type: 'body', metatype })`.

- Với `CreateTaskDto`, `remindTimes` trộn object `{ remindAt, repeatType: 'weekly', repeatWeekdays: [2, 6] }` và một chuỗi ISO. Kết quả `remindTimes` phải giữ nguyên (`deepEqual`). Đưa tiếp kết quả qua `parseRemindTimesBody` thì không lỗi và ra đúng 2 giờ với rule tương ứng.
- Với `UpdateTaskDto`, cùng kiểm tra như trên; thêm trường hợp `remindTimes: []` vẫn là `[]`, tức xoá hết giờ nhắc.
- Mảng vượt `REMINDER_TIME_LIMITS.MAX_TIMES` phải bị pipe từ chối (400).
- Không gửi `remindTimes` thì field vẫn `undefined`. Cần kiểm tra vì `@Transform` không được biến field thiếu thành có mặt; nếu có thì PATCH sẽ hiểu nhầm là đổi giờ nhắc.

### 3.3 Web — mỗi tab một bảng riêng

File `apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx`:

```tsx
<RemindersTable
  // Each tab has its own columns (Done adds "Done at"), so it gets its own table:
  // a fresh column state and its own saved column choices.
  key={status}
  id={status === 'done' ? 'reminders-done' : 'reminders'}
  ...
```

- `key={status}` remount `DataTable` khi đổi tab, nên `initialColumnIds` tính lại theo cột của tab mới.
- Tab Đã xong dùng id `reminders-done`, nên chọn cột và độ rộng cột của tab này lưu riêng và không bị danh sách cũ của tab Sắp tới che mất cột "Xong lúc".
- Tab Sắp tới giữ id `reminders`, nên lựa chọn cột người dùng đã lưu không mất.
- `resolveTableEntityInfo` so khớp `includes('reminder')`, nên `reminders-done` vẫn ra entity `reminders`.
- Không sửa `DataTable` dùng chung, để tránh ảnh hưởng mọi bảng khác.
- Hệ quả nhỏ (UI) chấp nhận được: khi đổi tab, trạng thái nội bộ của bảng (dòng đang mở chi tiết ID, độ rộng tạm) bị reset. `setStatus` vốn đã huỷ chế độ sửa.

## 4. Tài liệu

- Cả hai lỗi đều là sửa cài đặt cho đúng hành vi đã ghi trong knowledge. Contract của API (`remindTimes` nhận chuỗi hoặc object) và hành vi tab Đã xong không đổi. Vì vậy theo `repository-changes.md` thì không cần sửa nội dung knowledge/docs.
- Vẫn chạy `node .claude/hooks/docs-drift-check.mjs`. Nếu hook đòi cập nhật module `tasks` hoặc `dashboard` vì có code thay đổi, sẽ thêm một dòng ngắn đúng sự thật vào `modules/tasks/README.md` (EN và VI), nói rằng `remindTimes` được giữ nguyên qua pipe toàn cục. Không thêm nội dung lấp chỗ.
- Ghi `walkthrough.md` trong thư mục artifact này sau khi làm xong.

## 5. Kiểm tra

1. `npm run build --workspace @zalobot/contracts`, vì API đọc contracts từ `dist`.
2. `npm run test --workspace @zalobot/api`; test mới trong mục 3.2 phải fail trước khi sửa và pass sau khi sửa.
3. `npm run typecheck` và `npm run lint` cho `@zalobot/api` và `@zalobot/web`.
4. `npm run build --workspace @zalobot/web` (static export).
5. `node .claude/hooks/docs-drift-check.mjs`.
6. Thử tay ở local nếu chạy được: tạo việc có 2 giờ nhắc (một giờ lặp hằng tuần), rồi sửa việc đó. Ở `/reminders`, chuyển Sắp tới → Đã xong và thấy cột "Xong lúc".
   - Prod chỉ kiểm lại được sau khi deploy. Việc deploy không nằm trong plan này.

## 6. Ngoài phạm vi và rủi ro

- Không commit, không push, trừ khi anh yêu cầu.
- Không đổi `AppValidationPipe` và `DataTable` dùng chung.
- Rủi ro thấp: thay đổi API giới hạn ở 2 field của 1 DTO và có test qua pipe thật; thay đổi web giới hạn ở 1 component.
- Rủi ro còn lại: client khác (nếu có) đang gửi `remindTimes` không phải mảng vẫn bị `@IsArray` chặn như trước, không có gì thay đổi.

## 7. Quyết định cần anh duyệt

1. Sửa lỗi 1 bằng `@Transform` ở DTO, không đổi pipe toàn cục.
2. Sửa lỗi 2 bằng `key={status}` cộng id bảng riêng `reminders-done`, nghĩa là cột và độ rộng cột của tab Đã xong được lưu riêng.

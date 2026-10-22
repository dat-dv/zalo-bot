# Kế hoạch: Nhiều lần nhắc cho Việc cần làm và Lời nhắc

- Route: implement · Phase 1 (Planning) · Risk: **HIGH** (2 bảng mới + migration chuyển dữ liệu, đổi contract API, đổi 2 bộ hẹn giờ, đổi tool LLM)
- Nối tiếp: nhắc việc (`3501070`) và đích nhắc dùng chung (`0c64b07`), đã ở `main` (`8c25189`, chưa push)
- Trạng thái: chờ anh duyệt (còn **2 câu cần chốt** ở mục 5)

## 1. Yêu cầu

- Việc **đã xong thì không nhắc** — đã đúng sẵn (bộ hẹn giờ chỉ lấy việc `needsAction`, chưa xoá). Giữ nguyên.
- **Một việc có nhiều lần nhắc**: ví dụ 8h sáng và 14h cùng ngày, hoặc hôm trước và sáng hôm hạn chót.
- **Một lời nhắc cũng có nhiều lần nhắc**: ví dụ "uống thuốc" lúc 8h và 20h.

## 2. Hiện trạng

| | Việc cần làm | Lời nhắc |
| --- | --- | --- |
| Thời điểm | 1 cột `remind_at` | 1 cột `remind_at` |
| Đã gửi | `reminded_at` | `is_triggered` / `status` |
| Lặp | Không | `repeat_type` `none/daily/weekly` (dời `remind_at` sau mỗi lần) |
| Đích nhắc | `remind_chat_id`, `remind_users`, `remind_mode` | `chat_id`, `remind_users`, `remind_mode` |

`remind_at` đang được ~28 file đọc: sắp xếp danh sách, báo cáo dashboard (`reports.controller.ts`), lệnh `/reminders`, bảng và form web, bot.

## 3. Thiết kế

### 3.1 Mỗi lần nhắc là một dòng riêng

Hai bảng con, cùng một hình dạng:

| Bảng | Cột |
| --- | --- |
| `task_reminder_times` | `id`, `task_id` → `tasks.id` (xoá theo cha), `remind_at`, `sent_at` (NULL = chưa gửi) |
| `reminder_times` | `id`, `reminder_id` → `reminders.id` (xoá theo cha), `remind_at`, `sent_at` |

Index `(sent_at, remind_at)` cho bộ hẹn giờ. Mỗi việc/lời nhắc **tối đa 10 lần nhắc**.

**Vì sao bảng con, không dùng mảng jsonb**: mỗi lần nhắc cần trạng thái "đã gửi" riêng, và bộ hẹn giờ phải đánh dấu đúng **một** lần nhắc bằng câu update có điều kiện (`sent_at IS NULL`) để hai lượt chạy chồng nhau không gửi trùng. Làm việc đó trên một phần tử trong mảng jsonb vừa khó vừa dễ ghi đè lẫn nhau.

**Đích nhắc vẫn một cho cả việc/lời nhắc** (không tách theo từng lần nhắc). Cần nhắc mỗi lần một nhóm khác nhau thì rất hiếm; tách ra sẽ làm form phức tạp gấp nhiều lần.

### 3.2 Giữ `remind_at` trên dòng cha = "lần nhắc kế tiếp"

`tasks.remind_at` và `reminders.remind_at` vẫn giữ, nhưng nghĩa đổi thành **lần nhắc sớm nhất chưa gửi** (NULL khi đã gửi hết). Service cập nhật nó mỗi khi thêm/sửa/xoá lần nhắc và sau mỗi lần gửi.

Lý do: mọi chỗ chỉ **đọc** `remind_at` để sắp xếp hay hiển thị "lần tới" (báo cáo, `/reminders`, cột bảng) chạy tiếp mà không phải sửa. Đánh đổi: có một cột suy ra từ bảng con. Quy tắc cập nhật nằm ở đúng **một** hàm mỗi bên, có unit test.

`tasks.reminded_at` đổi nghĩa thành "lần gửi gần nhất" (để bảng vẫn hiện "Đã nhắc").

### 3.3 Bộ hẹn giờ

**Việc cần làm**: lấy các dòng `task_reminder_times` có `sent_at IS NULL AND remind_at <= now`, nối với việc còn `needsAction` và chưa xoá → đánh dấu `sent_at` (có điều kiện) → gửi tới đích nhắc → cập nhật `remind_at` kế tiếp của việc. Việc đã xong/xoá: các lần nhắc còn lại **không bao giờ gửi**; mở lại việc thì những lần nhắc **còn ở tương lai** lại có hiệu lực.

**Lời nhắc**: như trên với `reminder_times`. **Lặp ngày/tuần áp cho từng lần nhắc**: lời nhắc lặp hằng ngày có 8h và 20h thì sau khi gửi lần 8h, dòng đó dời sang 8h hôm sau (`sent_at` để trống lại); lời nhắc không lặp thì lần nhắc gửi xong là xong. Lời nhắc chuyển `completed` khi **mọi** lần nhắc đã gửi và không lặp.

**Hoãn (snooze, +15 phút)**: áp cho **lần nhắc kế tiếp** (dòng có `remind_at` sớm nhất chưa gửi), như hiện tại đang dời `remind_at`.

### 3.4 API + contracts

- `ITaskListItem` / `IReminderListItem`: thêm `remindTimes: { id; remindAt; sentAt? }[]`; `remindAt` vẫn có (= lần kế tiếp).
- Tạo/sửa: thêm `remindTimes?: string[]` (ISO, tối đa 10).
  - Gửi `remindTimes` = **thay cả danh sách**: giữ lại lần nhắc nào trùng thời điểm cũ (giữ luôn trạng thái đã gửi), xoá lần không còn, thêm lần mới. Lần mới phải ở tương lai (lệch 1 phút như hiện tại).
  - `remindAt` (một giá trị) vẫn nhận để **tương thích**: coi như `remindTimes: [remindAt]`. `remindAt: ''` vẫn xoá hết lần nhắc.
- Đích nhắc: không đổi.

### 3.5 Bot Zalo

- `CREATE_TASK`, `SET_REMINDER`: tham số mới `remindTimes` (mảng ISO) bên cạnh `remindAt`. Ví dụ: "thêm việc nộp báo cáo, nhắc 8h và 14h mai" → 2 lần; "nhắc uống thuốc 8h và 20h mỗi ngày" → 2 lần + lặp hằng ngày.
- Thẻ xác nhận: dòng **Nhắc lúc** liệt kê các lần (`08:00 23/10, 14:00 23/10`); tóm tắt `⏰ nhắc 08:00, 14:00 23/10`.
- Lần nào đã qua lúc duyệt thì bỏ lần đó, các lần còn lại vẫn giữ (như cách đang bỏ một giờ nhắc đã qua).

### 3.6 Web

- Form thêm việc / thêm lời nhắc: thay ô "Nhắc lúc" bằng **danh sách giờ nhắc**: mỗi dòng một ô `datetime-local` + nút xoá, nút **"+ Thêm giờ nhắc"** (tối đa 10). Model thuần dùng chung `reminder-times.ts` (kiểm tra giờ ở tương lai, bỏ trùng, sắp xếp), có unit test.
- Sửa tại chỗ (2 bảng): cùng thành phần đó ở bản gọn.
- Bảng: cột Nhắc lúc hiện **lần kế tiếp** + "+N lần" (rê chuột/hàng sheet trên điện thoại hiện đủ danh sách, lần đã gửi bị mờ).

### 3.7 Migration (1 file, chuyển dữ liệu)

1. Tạo 2 bảng con + index.
2. Chép dữ liệu cũ: mỗi việc có `remind_at` → 1 dòng (`sent_at = reminded_at`); mỗi lời nhắc → 1 dòng (`sent_at` = NULL nếu còn chờ; lời nhắc đã `completed` thì `sent_at = completed_at`).
3. `down`: xoá 2 bảng (cột cha vẫn còn nên quay về được).

### 3.8 Tài liệu

`knowledge|docs/modules/tasks`, `knowledge|docs/modules/reminders`, `knowledge|docs/modules/dashboard`, `knowledge|docs/global/google-tasks.md`, `CONTEXT.md` (thuật ngữ **Lần nhắc**; sửa **Nhắc việc** "một lần nhắc" → "một hoặc nhiều lần nhắc"); `docs-drift-check`.

## 4. Kiểm thử

- Unit: thay danh sách giữ trạng thái lần cũ; `remind_at` kế tiếp sau thêm/xoá/gửi; việc xong không gửi lần nào; mở lại việc chỉ còn lần tương lai; lời nhắc lặp dời từng lần; snooze chỉ dời lần kế tiếp; hai lượt chạy chồng không gửi trùng; tương thích `remindAt` đơn; migration chép đúng.
- Bot: nhiều giờ trong một câu, bỏ lần đã qua khi duyệt.
- Web: model danh sách giờ.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build --workspace @zalobot/web`, `docs-drift-check --all`.
- Không tự kiểm chứng được trên Zalo/DB thật (như các lần trước), sẽ báo rõ.

## 5. ❓ Cần anh chốt

1. **Đổi đích nhắc có gửi lại các lần đã gửi không?** Hiện tại (một lần nhắc) đổi kênh/người thì bot nhắc lại. Với nhiều lần nhắc, em đề xuất **không gửi lại**: đổi đích chỉ áp cho các lần nhắc **chưa gửi**; muốn nhắc thêm thì thêm giờ mới. Gửi lại hết sẽ dội cùng lúc nhiều tin cũ.
2. **Việc cần làm có cần "lặp mỗi ngày tới khi xong" không?** (ví dụ ngày nào cũng nhắc 9h cho tới khi đánh dấu xong). Em đề xuất **để việc sau**: lần này chỉ làm danh sách giờ nhắc cụ thể; lời nhắc thì vẫn giữ lặp ngày/tuần như hiện có.

## 6. Rủi ro

- Migration chuyển dữ liệu trên bảng thật: viết `IF NOT EXISTS`, chép bằng `INSERT … SELECT`, có `down`.
- `remind_at` trên dòng cha thành cột suy ra: nếu quên cập nhật ở một đường ghi thì "lần kế tiếp" sai. Gom việc cập nhật vào một hàm duy nhất mỗi bên + test.
- LLM có thể trả một giờ thay vì danh sách: vẫn nhận `remindAt` đơn.
- Checkout chính vẫn có thể có thay đổi chưa commit của phiên khác; em làm tiếp trong worktree `reminder-targets` (nhánh hiện trùng `main`).

## 7. Ghi chú thực thi (Phase 2, 2026-10-22)

Trạng thái: **đã code xong**, chưa commit. Worktree `.claude/worktrees/reminder-targets`, nhánh `feat/reminder-targets` (tách từ `main` `8c25189`).

Đã chốt theo anh: đổi đích **không** gửi lại lần đã gửi; task **chưa** có lặp tới khi xong.

Điều chỉnh so với kế hoạch:

- **`reminder_times` dùng kiểu `timestamp` (không múi giờ)** giống `reminders.remind_at`, để migration chép giá trị y nguyên. Nếu dùng `timestamptz` thì kết quả phụ thuộc múi giờ của phiên DB. `task_reminder_times` dùng `timestamptz` giống `tasks`.
- **Lời nhắc vẫn nhận giờ đã qua** (`allowPast`), vì server chưa bao giờ từ chối, giờ đã qua thì gửi ngay ở lượt kế tiếp. Form dashboard vẫn kiểm tra. Việc cần làm thì server từ chối giờ mới ở quá khứ, như trước.
- **Mở lại việc đã xong**: những lần nhắc đã qua trong lúc việc đang xong được đánh dấu bỏ qua, để không gửi dồn.
- **Lặp ngày/tuần nhảy qua các lần đã lỡ** (`nextRepeatAt`). Trước đây chỉ cộng 1 ngày, nên nếu bot ngừng vài hôm thì gửi bù từng ngày một ở mỗi lượt.
- **Nút hoãn trên web** dời lần kế tiếp thêm 15 phút **tính từ chính giờ đó**, giữ đúng cách cũ.
- **Sửa thêm lỗi nhỏ có sẵn**: ô sửa giờ ở bảng Nhắc nhở cắt chuỗi ISO (giờ UTC) rồi hiển thị như giờ máy, nên lệch múi giờ. Giờ dùng giờ địa phương.
- Thêm `items` vào kiểu `LlmToolProperty` để khai báo tham số mảng `remindTimes`. Bộ chuẩn hoá schema của các provider vốn đã đệ quy, nên `items` được truyền đi.

Kiểm chứng:

- `npm run typecheck` ✅, `npm run lint` ✅ (api/web/contracts).
- `npm run test`: api 587/587 ✅, web 113/113 ✅. Test mới: `reminder-times.spec.ts`, `reminders.service.spec.ts` (spec đầu tiên của RemindersService), phần nhắc của `tasks.service.spec.ts`, `task-reminder-scheduler.service.spec.ts`, `task.mapper.spec.ts`, `transaction-confirmation.service.spec.ts`; web `reminder-times.spec.ts`, `task-create-form.spec.ts`, `reminder-create-form.spec.ts`.
- `npm run build --workspace @zalobot/web` ✅; `docs-drift-check` và `--all` ✅.
- ❌ Chưa chạy migration `CreateReminderTimes` trên DB thật (có bước chuyển dữ liệu). Nên chạy thử trên bản sao DB trước.
- ❌ Chưa xem UI trên trình duyệt, chưa thử trên Zalo thật.

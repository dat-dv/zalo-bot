# Kế hoạch: Hài hoà màu button ở dark mode

- Route: implement · Phase 1 (Planning) · Risk: MEDIUM (nhiều file, chỉ đổi giao diện, không đụng API/schema)
- Phạm vi: `apps/web` — chỉ đổi các class `dark:*`; **giao diện light mode giữ nguyên 100%**.

## 1. Hiện trạng (đã kiểm tra trong code)

### 1.1 Nút "sáng trắng" ở dark mode
App đang dùng kiểu "đảo màu": light = `bg-slate-900 text-white`, dark = `dark:bg-slate-100 dark:text-slate-900`.
Nền dark của app là `#090d16` / panel `slate-900`, nên nút `slate-100` thành một khối trắng chói, nhất là trong dialog / bottom sheet.

Có ~45 chỗ trong 28 file, chia 3 nhóm:

| Nhóm | Ví dụ | Số chỗ |
| --- | --- | --- |
| **A. Nút hành động chính** (Lưu, Tạo, + Thêm, Xác nhận…) | `form-dialog.tsx` `PRIMARY`, `calendar-event-sheet.tsx` `PRIMARY`, `profile-styles.ts` `PRIMARY_BUTTON`, các `combine-*-dialog`, `linked-contacts-dialog`, `zca-screen` (2), nút `MOBILE_ACTION_BUTTON` của debts/contacts/places/tasks/reminders/calendar, nút "+" trên toolbar và nút nhỏ trong bảng (settings, debts-table, expenses, contacts, reminders-table, calendar-table, tasks-table, transactions-table), link "Mở Zalo Bot" (`workspace-header`, `app-navigation`), `pwa-status-stack`, `access-code-form` | ~33 |
| **B. Trạng thái đang chọn** (không phải nút hành động) | ô menu đang active trong sheet "Thêm" (`MENU_TILE_ACTIVE`), nút ngôn ngữ đang chọn (`MENU_LOCALE_ACTIVE`), link sidebar đang active, toggle Biểu đồ/Bảng ở `analytics-screen` | 5 |
| **C. Toast thông báo** | `${TOAST_POSITION} … dark:bg-slate-100` ở settings, debts, expenses, contact-profile, contacts, tasks, transactions, places, calendar, reminders | 10 |

### 1.2 Nút outline "Đăng xuất" bị chìm
`app-navigation.tsx:496` (footer sheet "Thêm"): `!bg-transparent dark:border-rose-900 dark:!text-rose-300`.
Viền `rose-900` trên panel `slate-900` gần như cùng độ sáng → nút mất viền, trông như chữ trôi nổi.

### 1.3 Các chỗ đã ổn (không đổi)
- Nút phụ (Huỷ / Secondary): `dark:bg-slate-800 dark:border-slate-700` — đã hợp nền.
- Nút đỏ của `ConfirmDialog` (`dark:bg-rose-600`) và `DANGER` của calendar sheet (`dark:bg-rose-950/40`) — đã ổn.
- Các nút đã dùng màu xanh (ZCA, sync media, debt allocation, calendar grid…): giữ nguyên.
- Thanh chỉ báo 2px của tab bar (`dark:bg-slate-100`): là đường kẻ mảnh, không phải khối trắng → giữ.
- Đã quét `bg-white` thiếu biến thể dark: chỉ còn ở trang công khai `/about`, `/privacy`, `/terms` (ngoài phạm vi, không có dark mode riêng).

## 2. Hướng style đề xuất (theo chính app)

Trong app, những nơi đã có màu nhấn ở dark mode đều dùng **xanh sky/blue** (lịch: `dark:bg-sky-600`, ô focus `dark:focus:border-sky-500`, viền focus `#93c5fd`, nút cập nhật PWA `dark:bg-sky-500`). Nên:

| Nhóm | Dark mode mới | Lý do |
| --- | --- | --- |
| A. Nút chính | `dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500` | Trùng màu nhấn đã có (lịch, focus); vẫn nổi bật nhưng không chói |
| B. Đang chọn | `dark:border-slate-600 dark:bg-slate-700 dark:text-white` | Trạng thái điều hướng nên trung tính, nhẹ hơn nút hành động; vẫn đủ tương phản (chữ trắng trên slate-700) |
| C. Toast | `dark:bg-slate-800 dark:text-slate-100` + viền `dark:border dark:border-slate-700` | Toast tối, tách nền bằng viền 1px (theo quy tắc "border over shadow") |
| Đăng xuất (outline) | `dark:border-rose-800 dark:!bg-rose-950/40 dark:!text-rose-300` | Cùng kiểu với nút `DANGER` đã có ở calendar sheet: nền đỏ rất nhạt + viền rõ, không còn chìm |

Light mode: không đổi class nào.

> Phương án thay thế nếu anh muốn trung tính hoàn toàn (không dùng xanh): nhóm A dùng `dark:border-slate-500 dark:bg-slate-600 dark:text-white`. Nhược điểm: nút chính và nút phụ (`slate-800`) chênh nhau ít → khó phân cấp. Em khuyến nghị phương án xanh ở trên.

## 3. Các bước thực hiện (Phase 2)

1. **Nhóm A** — thay phần `dark:` của nút chính trong các file liệt kê ở 1.1 (giữ nguyên phần light, kích thước, `!` important ở những chỗ đang dùng).
2. **Nhóm B** — `app-navigation.tsx` (`MENU_TILE_ACTIVE`, `MENU_LOCALE_ACTIVE`, link sidebar active), `analytics-screen.tsx` (2 toggle).
3. **Nhóm C** — 10 toast.
4. **Nút Đăng xuất** trong sheet "Thêm" (`app-navigation.tsx:496`), light mode giữ nguyên.
5. Không tạo abstraction mới: mỗi chỗ chỉ đổi chuỗi class `dark:` cho khớp code xung quanh (các file đã có hằng riêng như `PRIMARY` thì chỉ sửa hằng đó).

## 4. Kiểm tra

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`.
- `grep` xác nhận không còn `dark:bg-slate-100` / `dark:!bg-slate-100` trên nút, toast và trạng thái chọn (trừ thanh chỉ báo tab bar).
- Mở preview ở dark mode, chụp màn hình: sheet "Thêm" (ô active, ngôn ngữ, nút Đăng xuất), dialog xác nhận đăng xuất, một form dialog (Tạo công nợ), bottom sheet lịch, thanh hành động mobile, toast, sidebar desktop. Kiểm tra lại light mode không đổi. Không bấm xác nhận Đăng xuất (giữ phiên test).

## 5. Tài liệu

Cập nhật quy tắc màu dark mode (nút chính = sky, trạng thái chọn = slate-700, toast tối có viền, outline nguy hiểm có nền nhạt):
- `.agents/knowledge/global/web-ui-direction.md` (EN)
- `.agents/docs/global/web-ui-direction.md` (VI)
- Chạy `node .claude/hooks/docs-drift-check.mjs`.

## 6. Rủi ro

- Thấp về logic (chỉ class CSS). Rủi ro chính là thẩm mỹ — sẽ chụp ảnh trước/sau để anh duyệt.
- Không đụng các thay đổi đang dở trên branch (`zca-screen.tsx`, `app-navigation.tsx` đang có diff chưa commit) — chỉ sửa đúng các dòng class liên quan.

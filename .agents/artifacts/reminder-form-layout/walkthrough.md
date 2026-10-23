# Walkthrough: Gọn bố cục ô giờ nhắc và phần Nhắc lại

Branch `fix/reminder-form-layout`, tách từ `main` `0c421c9`. Làm theo `implementation_plan.md` đã được duyệt.

## Đã sửa

### `reminder-times-field.tsx`

Mỗi giờ nhắc giờ có các dòng cố định, ở cả dialog lẫn khi sửa trong bảng:

1. Ô ngày giờ, rộng hết bề ngang. Đã bỏ `min-w-[150px] flex-1`.
2. Một hàng `flex items-center gap-1`, gồm:
   - select Lặp lại `${field} min-w-0 flex-1`;
   - chữ "đã gửi" (`shrink-0 whitespace-nowrap`);
   - nút ✕.
3. Các nút T2…CN khi chọn Hằng tuần, giữ nguyên.

### `reminder-nag-fields.tsx`

- Nhãn "Mỗi" và "Tối đa (lần)" có thêm `shrink-0 whitespace-nowrap`.
- Bỏ `w-auto` trên hai select, vì `w-full` của `FORM_FIELD` / `INLINE_EDIT_FIELD` luôn thắng nó.
- Select tự co về đúng bề rộng nội dung nhờ flex.

### Tài liệu

Thêm một ý về bố cục, kèm lưu ý `w-full` thắng `w-auto`, vào:

- `.agents/knowledge/modules/dashboard/README.md` (EN);
- `.agents/docs/modules/dashboard/README.md` (VI).

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck --workspace @zalobot/web` | Pass |
| `npm run lint --workspace @zalobot/web` | Pass |
| `npm run test --workspace @zalobot/web` | 137/137 pass |
| `npm run build --workspace @zalobot/web` | Pass (static export) |
| `node .claude/hooks/docs-drift-check.mjs` | PASS (0 errors) |

### Xem bố cục

**Cách làm:** trang thật cần đăng nhập vào API, nên em dựng một trang thử trong scratchpad. Trang này nạp đúng file CSS vừa build (`apps/web/out/_next/static/chunks/*.css`) và dựng lại DOM bằng đúng các class của 2 component, cả bản TRƯỚC và SAU. Em đo vị trí bằng `getBoundingClientRect` trong browser pane.

**Kết quả:**

| Trường hợp | TRƯỚC | SAU |
| --- | --- | --- |
| Dialog, màn 1024px (ô cao 32px) | ✕ rơi xuống dòng riêng; "Tối đa (lần)" cao 31px (2 dòng) | ✕ cùng dòng với select; "Tối đa (lần)" cao 15px (1 dòng) |
| Dialog, màn 378px (ô cao 40px, chữ 15px) | Như trên | Như trên, kể cả giờ có "đã gửi" |
| Sửa trong bảng, ô 200px | ✕ dòng riêng; nhãn bẻ 2 dòng | ✕ cùng dòng; cụm "Tối đa (lần) [3]" chuyển nguyên xuống dòng dưới, chữ không bẻ |
| Sửa trong bảng, ô 260px | (không đo) | "Mỗi [15 phút] Tối đa (lần) [3]" nằm gọn trên một dòng |

Không có phần tử nào tràn ra ngoài bề rộng của component.

### Chưa kiểm

- Chưa xem trên trang thật có dữ liệu thật: local không có API và phiên đăng nhập. Cần xem lại trên prod sau khi merge và deploy.
- Hai dialog thật (Thêm lời nhắc, Thêm việc) dùng cùng 2 component này, nên bố cục phải giống trang thử.

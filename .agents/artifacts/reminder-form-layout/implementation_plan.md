# Plan: Gọn bố cục ô giờ nhắc và phần Nhắc lại

Rủi ro: **THẤP**. Chỉ sửa class CSS ở 2 component web, không đổi logic, API hay i18n.

## Hiện trạng và nguyên nhân

Trên prod (v1.0.176), ở form Thêm lời nhắc / Thêm việc:

1. Nút ✕ xoá giờ nhắc rơi xuống một dòng riêng, nằm dưới ô "Lặp lại".
2. Nhãn "Tối đa (lần)" của phần Nhắc lại bị xuống 2 dòng.

Cùng một nguyên nhân: các select được gắn `${field} w-auto`, trong đó `field` là `FORM_FIELD` / `INLINE_EDIT_FIELD`, vốn đã có `w-full`. Trong CSS build ra, `.w-full` nằm **sau** `.w-auto`, nên `w-auto` không có tác dụng và select luôn rộng 100%. Hệ quả:

- **Dòng giờ nhắc** (`reminder-times-field.tsx`): ô ngày giờ, select, nhãn "đã gửi" và nút ✕ nằm chung một hàng `flex-wrap`. Select chiếm trọn một dòng nên ✕ bị đẩy xuống dòng thứ ba.
- **Nhắc lại** (`reminder-nag-fields.tsx`): trong mỗi `<label class="flex">`, select rộng 100% chiếm chỗ. Chữ "Tối đa (lần)" vẫn được co nên bị bẻ thành 2 dòng.

## Thay đổi

### 1. `apps/web/src/modules/dashboard/presentation/components/reminder-times-field.tsx`

Mỗi giờ nhắc có 2 dòng cố định, áp dụng cho cả dialog lẫn ô sửa trực tiếp trong bảng (`compact`):

- **Dòng 1:** ô ngày giờ chiếm hết bề ngang. Bỏ `min-w-[150px] flex-1`, vì không còn chung hàng với phần tử nào.
- **Dòng 2:** `<div className="flex items-center gap-1">` gồm:
  - select Lặp lại: `${field} min-w-0 flex-1`, giãn ra phần còn lại và co được khi ô hẹp; bỏ `w-auto shrink-0`;
  - nhãn "đã gửi", nếu có: thêm `shrink-0 whitespace-nowrap`;
  - nút ✕: giữ nguyên `shrink-0` và điều kiện hiện.
- **Dòng 3:** các nút T2…CN khi chọn Hằng tuần, giữ nguyên.

Phác thảo:

```
[ 23/10/2026, 10:00                    📅 ]
[ Hằng tuần                       ▾ ] [ ✕ ]
[T2][T3][T4][T5][T6][T7][CN]
```

### 2. `apps/web/src/modules/dashboard/presentation/components/reminder-nag-fields.tsx`

- Hai nhãn "Mỗi" và "Tối đa (lần)": thêm `shrink-0 whitespace-nowrap`. Nhãn không bị co hay bẻ dòng, nên select tự về đúng bề rộng nội dung.
- Bỏ `w-auto` trên 2 select, vì nó vốn không có tác dụng.
- Ô quá hẹp (bảng, `min-w-[200px]`): hàng `flex-wrap` vẫn đưa nguyên cụm "Tối đa (lần) [3]" xuống dòng dưới, không bẻ chữ.

### 3. Tài liệu (mô tả bố cục)

- `.agents/knowledge/modules/dashboard/README.md` (EN), đoạn `TasksScreen` / `RemindersScreen`: thêm một ý về bố cục dòng giờ: dòng 1 là ngày giờ; dòng 2 là select Lặp lại, dấu đã gửi và nút xoá ✕.
- `.agents/docs/modules/dashboard/README.md` (VI): thêm ý tương ứng.
- Không đổi hành vi nghiệp vụ, nên không sửa CONTEXT.md hay knowledge của reminders/tasks.

## Không làm

- Không sửa `FORM_FIELD` / `INLINE_EDIT_FIELD` dùng chung, không thêm thư viện gộp class (tailwind-merge).
- Không đổi chữ "Tối đa (lần)", bo góc hay màu sắc (giữ bo góc nhỏ như hiện tại).

## Nơi làm và kiểm chứng

- Làm trên branch mới `fix/reminder-form-layout`, tách từ `main` hiện tại (`0c421c9`).
- `npm run typecheck`, `lint`, `test`, `build` cho `@zalobot/web`; chạy `node .claude/hooks/docs-drift-check.mjs`.
- Xem tận mắt: thử mở bản web local trong browser pane. Nếu không mở được (như lần trước), em xem lại trên prod sau khi anh cho merge và push. Các trường hợp cần xem:
  - dialog Thêm lời nhắc và Thêm việc, có 1 giờ và có 2 giờ;
  - chọn Hằng tuần;
  - giờ "đã gửi";
  - bật Nhắc lại;
  - sửa trực tiếp trong bảng;
  - bề ngang điện thoại 375px.
- Merge vào main và push chỉ khi anh yêu cầu.

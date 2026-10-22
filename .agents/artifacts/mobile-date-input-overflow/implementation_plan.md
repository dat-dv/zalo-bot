# Kế hoạch: date input tràn ngang trên mobile

Rủi ro: LOW (chỉ CSS global, không đổi hành vi nghiệp vụ, không cần cập nhật knowledge/docs).

## Nguyên nhân

- Các ô `input[type=date|datetime-local]` (form giao dịch, công nợ, lịch, việc cần làm, nhắc lịch, hồ sơ, điều chỉnh số dư, sửa inline trong bảng) phần lớn nằm trong `<label className="grid gap-1">`: cột ngầm định của grid là `auto`, nên độ rộng tối thiểu của cột bằng min-content của input.
- Trên iOS Safari / Android Chrome, date input dùng giao diện native có độ rộng nội tại theo chuỗi ngày giờ hiển thị và bỏ qua `width: 100%` khi nhỏ hơn mức đó. Rule `font-size: 16px !important` cho màn cảm ứng (chống zoom iOS) làm chuỗi này rộng hơn nữa → label/cột bị đẩy rộng hơn ô chứa, gây scroll ngang ở 375px.

## Thay đổi

`apps/web/src/styles.css`:

1. Mọi `input[type=date|datetime-local|time|month|week]`: `min-width: 0; max-width: 100%` để không đóng góp min-content vào grid/flex cha (desktop vốn đã `w-full` nên không đổi).
2. Chỉ trong `@media (hover: none) and (pointer: coarse)` (cùng phạm vi rule 16px sẵn có): `-webkit-appearance: none; appearance: none` để iOS tôn trọng độ rộng, và `::-webkit-date-and-time-value { text-align: left }` để giá trị không bị căn giữa sau khi bỏ appearance. Desktop không bị ảnh hưởng.

Không đổi bo góc, không đổi class component.

## Kiểm tra

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`.
- Browser pane ở 375px (preset mobile): mở các form có date input, kiểm `document.documentElement.scrollWidth <= clientWidth`. Nếu dev server lỗi `EPERM uv_cwd` thì ghi rõ là chưa kiểm được trên trình duyệt.

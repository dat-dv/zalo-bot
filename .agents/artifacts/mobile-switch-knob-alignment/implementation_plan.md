# Sửa nút tròn của công tắc bị lệch lên trên trên điện thoại

## Hiện tượng

Trên iPhone (màn hình ≤ 640px), nút tròn trắng trong các công tắc bật/tắt (trang cấu hình kênh `/zca/thread`) nằm sát mép trên, không nằm giữa thanh trượt.

## Nguyên nhân

`apps/web/src/modules/zca/presentation/components/thread-config/config-switch.tsx`

- Nút tròn là pseudo-element `::after` có `after:absolute after:top-[2px] after:left-[2px]`.
- Thanh trượt (`div`) **không có `relative`**, nên `::after` được định vị theo phần tử `relative` gần nhất là thẻ `label`.
- Trên desktop, `label` có kích thước bằng đúng thanh trượt nên không thấy lỗi.
- Trên điện thoại, `label` được nới thành vùng chạm `min-h-10 min-w-10` (40×40px) và căn giữa thanh trượt. Nút tròn vẫn bám `top: 2px` của khung 40px, nên lệch hẳn lên trên thanh trượt (và lệch ngang với size `md`/`sm` vì thanh trượt hẹp hơn 40px).

## Thay đổi đề xuất

Một file, một class: thêm `relative` vào `div` thanh trượt để `::after` định vị theo chính thanh trượt.

```diff
-        className={`peer rounded-full bg-slate-300 ...
+        className={`peer relative rounded-full bg-slate-300 ...
```

Vùng chạm 40px trên điện thoại giữ nguyên; desktop không đổi gì về hình ảnh.

## Phạm vi ảnh hưởng

- Mọi chỗ dùng `ConfigSwitch`: `listen-toggle-card.tsx`, `group-member-picker.tsx`, `config-toggle-row.tsx`, `config-section-card.tsx`.
- Công tắc React Scan ở trang Cài đặt là nút dạng chữ, không dùng nút tròn, không bị ảnh hưởng.

## Rủi ro

THẤP: chỉ CSS, một file, không đụng API/schema/auth, rollback bằng cách bỏ một class.

## Kiểm tra

1. `npm run typecheck --workspace @zalobot/web` và `npm run lint --workspace @zalobot/web`.
2. Mở `/zca/thread?id=…` trong browser pane ở viewport mobile (375×812), kiểm tra nút tròn nằm giữa thanh trượt ở cả 3 size, cả trạng thái bật và tắt; kiểm tra lại desktop.

## Tài liệu

Sửa lỗi hiển thị, không đổi hành vi nghiệp vụ, nên không cần cập nhật `.agents/knowledge/` hay `.agents/docs/`.

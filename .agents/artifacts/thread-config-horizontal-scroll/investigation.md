# Điều tra: vùng main bị scroll ngang ở `/zca/thread`

## Hiện tượng

- URL: `https://zalobot.datintech.site/zca/thread?id=3187684911649430854` (prod).
- Ở desktop (viewport > 960px), cột nội dung bên phải (section cuộn của layout private) có thanh scroll ngang ~4px.
- Ở mobile (375px) không tái hiện: `document.scrollWidth = 375`.

## Bằng chứng (đo trên prod, viewport 1280×800)

- Phần tử cuộn duy nhất bị tràn: `section.flex.min-h-0.min-w-0.flex-col.gap-3.overflow-y-auto` (`app/(private)/layout.tsx:16`) — `clientWidth = 1030`, `scrollWidth = 1034`.
- Phần tử con vượt khỏi cha: thanh lưu sticky "Lưu cấu hình" — rộng `1038px` trong cha `form.flex.flex-col.gap-4` rộng `1030px`.

## Nguyên nhân gốc

`apps/web/src/modules/zca/presentation/components/thread-config/thread-config-action-bar.tsx:16` dùng `-mx-1` (margin âm 4px mỗi bên) nên thanh rộng hơn form 8px.

- Desktop: section của layout có `overflow-y-auto`; theo CSS, khi một trục là `auto` thì trục còn lại `visible` bị tính thành `auto` → 4px tràn bên phải biến thành scroll ngang. Section không có padding nên không có chỗ "đỡ" phần margin âm.
- Mobile (≤ 960px): section chuyển sang `overflow-visible` và `main` có padding 0.75rem, nên 4px tràn nằm gọn trong padding → không thấy lỗi.

`-mx-1` có từ commit `61d6ebf` (chuyển thread config từ modal sang trang riêng) — nhiều khả năng là phần sót lại từ footer modal, nơi container có padding.

## Phạm vi ảnh hưởng

- Chỉ trang `/zca/thread` (không có thanh sticky nào khác dùng margin âm; `MODAL_STICKY_FOOTER` trong `modal.tsx` không dùng `-mx-*`).

## Đề xuất khắc phục (nhỏ nhất)

- Bỏ class `-mx-1` khỏi thanh action bar. Thanh sẽ rộng đúng bằng form, viền trên thẳng hàng với các card.
- Không đề xuất thêm `overflow-x-hidden` vào layout chung: chỉ che triệu chứng và có thể cắt nội dung ở các trang khác.

## Kiểm chứng sau khi sửa

- Desktop 1280px: `section.scrollWidth === section.clientWidth` trên `/zca/thread`.
- Mobile 375px: `document.documentElement.scrollWidth === 375`, thanh lưu vẫn nằm trên bottom tab bar.
- `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web`.
- Không đổi hành vi nghiệp vụ → không cần cập nhật `.agents/knowledge` / `.agents/docs`.

## Kết quả thực thi (2026-10-22)

- Đã bỏ `-mx-1` trong `thread-config-action-bar.tsx`.
- `npm run lint` và `npm run typecheck` của `@zalobot/web`: sạch.
- Dev server local không khởi động được (`EPERM uv_cwd`, macOS chặn quyền thư mục), nên kiểm chứng trên prod bằng cách gỡ class `-mx-1` khỏi DOM ngay trên tab:
  - Desktop 1280px: section `scrollWidth` 1034 → 1030 (= `clientWidth`), thanh lưu rộng 1030 = form.
  - Mobile 375px: `document.scrollWidth = 375`, thanh lưu thẳng hàng form (12 → 363), đáy thanh (756) nằm sát trên bottom tab bar (756).
- Chưa commit/deploy; prod chỉ hết lỗi sau khi build và deploy lại.

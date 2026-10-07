# Kế hoạch triển khai: Mở liên kết ngoài ở tab mới (New Tab) cho Terms & Privacy

Đảm bảo tất cả các liên kết mở trang ngoài (external links) trên các trang công khai (Terms, Privacy, About) đều mở ở tab mới (`target="_blank"` kèm `rel="noreferrer"`) thay vì điều hướng đè lên tab hiện tại.

## Bối cảnh & Vấn đề

Hiện tại trên trang Chính sách quyền riêng tư ([`privacy/page.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/privacy/page.tsx)), đường link tới Google API Services User Data Policy (`https://developers.google.com/terms/api-services-user-data-policy`) chỉ có `rel="noreferrer"` nhưng thiếu `target="_blank"`, dẫn tới việc khi người dùng click vào liên kết sẽ điều hướng trực tiếp trên tab hiện tại, làm rời khỏi ứng dụng zalobot.

Tương tự trên trang Giới thiệu ([`about/page.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/about/page.tsx)), liên kết tới zalo (`https://t.me`) cũng thiếu `target="_blank"`.

## Thay đổi đề xuất

Group các file theo ứng dụng Web:

### `apps/web`

---

#### [MODIFY] [privacy/page.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/privacy/page.tsx)

- Thêm `target="_blank"` vào thẻ `<a>` chứa liên kết Google API Services User Data Policy:
  ```tsx
  <a
    href="https://developers.google.com/terms/api-services-user-data-policy"
    target="_blank"
    rel="noreferrer"
  >
    {t('public.privacy.policyLink')}
  </a>
  ```

#### [MODIFY] [about/page.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/about/page.tsx)

- Thêm `target="_blank"` vào thẻ `<a>` chứa liên kết zalo:
  ```tsx
  <a
    className="mt-[18px] inline-flex rounded-md bg-slate-900 px-[18px] py-[13px] font-bold text-white no-underline hover:bg-slate-800"
    href="https://t.me"
    target="_blank"
    rel="noreferrer"
  >
    {t('public.about.zalo')}
  </a>
  ```

#### [CHECK] [terms/page.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/terms/page.tsx)

- Xác nhận trang Terms hiện tại chỉ gồm các internal navigation links sử dụng `<Link>` (`APP_ROUTES.about`, `APP_ROUTES.privacy`).

---

## Kế hoạch xác thực (Verification Plan)

### Automated Tests / Typecheck

- Chạy `npm run typecheck` (hoặc `npm run build` trong `apps/web`) để đảm bảo không có lỗi type hay cú pháp.
- Chạy `npm run agent-system:validate` để đảm bảo hệ thống agent và các ràng buộc tuân thủ quy chuẩn.

### Manual Verification

- Kiểm tra mã nguồn JSX của `privacy/page.tsx` và `about/page.tsx` đảm bảo thẻ `<a>` có đủ `target="_blank"` và `rel="noreferrer"`.

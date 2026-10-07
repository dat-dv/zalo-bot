# Walkthrough: Cập nhật mở liên kết ngoài ở tab mới cho Privacy & Terms

Đã hoàn thành việc thêm thuộc tính `target="_blank"` và `rel="noreferrer"` cho các liên kết ngoài, đảm bảo khi người dùng nhấn vào sẽ mở trang mới mà không thay đổi/rời tab hiện tại.

## Thay đổi đã thực hiện

### 1. [`apps/web/app/privacy/page.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/privacy/page.tsx)

- Đã thêm `target="_blank"` vào liên kết Google API Services User Data Policy:

```tsx
<p>
  {t('public.privacy.policyPrefix')}
  <a
    href="https://developers.google.com/terms/api-services-user-data-policy"
    target="_blank"
    rel="noreferrer"
  >
    {t('public.privacy.policyLink')}
  </a>
  {t('public.privacy.policySuffix')}
</p>
```

### 2. [`apps/web/app/about/page.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/about/page.tsx)

- Đã thêm `target="_blank"` vào liên kết zalo:

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

### 3. [`apps/web/app/terms/page.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/terms/page.tsx)

- Trang Terms chỉ sử dụng các liên kết nội bộ Next.js `<Link>` (`APP_ROUTES.about`, `APP_ROUTES.privacy`), giữ nguyên hành vi SPA điều hướng nhanh trong cùng tab.

---

## Kết quả kiểm thử & xác thực (Verification Results)

- **Typecheck**: `npm run typecheck` thành công 100% trên cả 3 packages (`@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
- **Linter**: `npm run lint` hoàn thành mà không có bất kỳ warning/error nào.
- **Agent System Validation**: `npm run agent-system:validate` vượt qua toàn bộ 88 artifacts và các ràng buộc.

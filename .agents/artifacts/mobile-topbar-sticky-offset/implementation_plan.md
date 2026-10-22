# Implementation Plan — Topbar mobile không bị đẩy lên khi scroll

- Route: `implement` · Risk: **LOW** (1 file, chỉ đổi 2 class Tailwind, không đụng API/schema/auth)
- File: `apps/web/src/shared/ui/app-navigation.tsx`

## Nguyên nhân

Ở màn ≤ 960px, topbar (`<header>` trong `AppNavigation`) là `sticky` với `top-[env(safe-area-inset-top)]`.
Nhưng `<main>` trong `app/(private)/layout.tsx` có padding-top `calc(0.625rem + env(safe-area-inset-top))`.

- Lúc chưa scroll: topbar nằm ở vị trí tự nhiên = `0.625rem + safe-area` tính từ mép trên.
- Khi scroll: topbar dính ở `safe-area` → bị trượt lên đúng `0.625rem` (10px) rồi mới đứng yên.

Đó là cú "giật lên" anh thấy.

## Thay đổi

1. Topbar: đổi `max-[960px]:top-[env(safe-area-inset-top)]` → `max-[960px]:top-[calc(0.625rem+env(safe-area-inset-top))]`
   để vị trí dính trùng vị trí ban đầu → không còn dịch chuyển.
2. Dải nền che status bar (div `fixed` ngay trên header): đổi chiều cao `h-[env(safe-area-inset-top)]`
   → `h-[calc(0.625rem+env(safe-area-inset-top))]` để khoảng 10px phía trên topbar cũng được che,
   nội dung scroll qua không lộ ra ở khe đó.

Giữ nguyên radius, màu nền, z-index (theo quy ước giữ radius nhỏ).

## Không ảnh hưởng

- Desktop (> 960px): `WorkspaceHeader` không sticky, không đổi.
- Chỉ báo pull-to-refresh (`top: safe + 3.5rem`) và PWA status stack (`top: safe + 4.5rem`) vẫn nằm dưới topbar
  (topbar cao 52px + 10px offset ≈ 3.9rem) — sẽ kiểm tra lại vị trí khi verify.
- Không đổi hành vi nghiệp vụ → không cần cập nhật `.agents/knowledge` / `.agents/docs`.

## Verify

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`.
- Mở dev server ở viewport mobile, scroll trang dài (ví dụ `/transactions`): đo `getBoundingClientRect().top`
  của topbar trước/sau scroll phải bằng nhau; kiểm tra không có nội dung lộ qua khe phía trên.

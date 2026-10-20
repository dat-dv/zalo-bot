# Walkthrough: Responsive modal & bàn phím ảo

## Đã làm
- **Viewport/CSS**: `interactiveWidget: 'resizes-content'` (`app/layout.tsx`), `html { -webkit-text-size-adjust: 100% }`, `body min-height: 100dvh`; `h-screen`/`min-h-screen` → `h-dvh`/`min-h-dvh` ở private layout, drawer nav, loading fallback.
- **Chặn auto-zoom iOS** (không tăng font, theo yêu cầu): `src/shared/ui/ios-viewport-fix.tsx` thêm `maximum-scale=1` chỉ trên iOS/iPadOS, gắn trong `AppProviders`.
- **Hook mới**: `use-body-scroll-lock.ts` (ref-counted, nav drawer dùng chung), `use-visual-viewport.ts` (ghi `--app-vvh`, `--app-vv-top`).
- **`src/shared/ui/modal.tsx`**: bottom-sheet < 640px, căn giữa ≥ 640px; overlay theo visual viewport; panel tự cuộn; `MODAL_STICKY_HEADER`/`MODAL_STICKY_FOOTER`; Escape (chỉ modal trên cùng), click nền tuỳ chọn, focus trap, trả focus, cuộn input vào tầm nhìn.
- **Đã chuyển 12 modal**: IdExplainerDialog (DataTable), CombinePlaces/Debts/Contacts, DeleteTransaction, AdjustBalance, DebtAllocation, MergeUser, UserForm, ThreadConfig, SyncMedia, QR login (zca-screen). Giữ nguyên logic/nội dung; bỏ các Escape handler riêng.
- `CategoryAutocomplete` menu `z-[100]` → `z-[1000]` để nổi trên modal; 6 toast thêm safe-area + `max-sm:left-4`.
- Docs: `global/web-ui-direction` (EN + VI) và ghi chú trong README module contacts, dashboard, debts, users, zca.

## Kiểm chứng
- `npm run typecheck --workspace @zalobot/web`: pass.
- `npm run build --workspace @zalobot/web`: pass.
- `npm run lint --workspace @zalobot/web`: 1 lỗi **có sẵn từ trước** (`zca/api/zca-query.ts` `SyncThreadMediaResponse` unused, file không bị đụng; baseline cũng fail). ESLint các file đã sửa: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Browser (static build, 375×812): modal QR hiển thị bottom-sheet full-width, body bị khoá cuộn, panel nhận focus. Ở 375×380 (giả lập bàn phím): header ở top, footer ở đáy, nội dung cuộn, `--app-vvh` cập nhật. Escape đóng và mở khoá cuộn. 1280×800: căn giữa như cũ.

## Chưa kiểm được
- Bàn phím ảo thật và auto-zoom iOS: cần test trên iPhone/Android thật.
- Các modal cần dữ liệu (gộp, phân bổ, xoá giao dịch...) không mở được khi không có token/API; mới kiểm qua typecheck + modal QR dùng cùng shell.

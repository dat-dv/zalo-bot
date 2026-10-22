# Walkthrough: UX mobile — dialog, bottom sheet, filter công nợ, quick links, nhớ tab lịch

## Đã thay đổi

| Mục | File |
| --- | --- |
| Footer dialog toàn màn hình sát đáy (`MODAL_STICKY_FOOTER` + `mt-auto`, `<form>` con giãn hết panel) | `apps/web/src/shared/ui/modal.tsx` |
| Khoá scroll kiểu body-fixed + trả vị trí cuộn; backdrop `touch-none` | `apps/web/src/shared/hooks/use-body-scroll-lock.ts`, `modal.tsx` |
| Sheet "Thêm": select ngôn ngữ → 2 nút `Tiếng Việt / English` (12px, 40px như nút giao diện) | `apps/web/src/shared/ui/app-navigation.tsx` |
| Filter công nợ phone: 2 hàng × 3 nút đều, tìm kiếm, chip chọn tự xuống dòng; gom class vào `filterChipClass` | `apps/web/src/modules/debts/presentation/components/debts-screen.tsx` |
| Quick links dashboard phone: lưới 4 cột × 2 hàng (skeleton 8 ô) | `apps/web/src/modules/dashboard/presentation/components/dashboard-home-screen.tsx` |
| Nhớ tab lịch theo layout trong localStorage | `modules/calendar/model/calendar-view-mode.ts` (+ spec), `presentation/components/use-calendar-view-mode.ts`, `view/use-calendar-view-mode.ts`, `dashboard/.../calendar-screen.tsx` |

Tài liệu: `.agents/knowledge/global/web-ui-direction.md`, `modules/{debts,dashboard,calendar}/README.md` và bản VI tương ứng trong `.agents/docs/`.

## Kiểm tra đã chạy

- `npm run typecheck --workspace @zalobot/web`: pass. `npm run lint --workspace @zalobot/web`: pass. `npm run test --workspace @zalobot/web`: 90/90 pass (gồm spec mới).
- `npm run build --workspace @zalobot/web`: lần đầu fail ở `thread-config-form.spec.ts` do phần chat-memory đang làm dở ở session khác; sau commit `33303ec` của session đó, chạy lại: compiled, 24/24 trang static, không lỗi.
- Browser pane 375px (bản prerender `next build --experimental-build-mode compile|generate`, serve tĩnh, không có API):
  - Thêm khoản nợ: `footer.bottom = 812 = innerHeight`; body `position: fixed` khi mở, gỡ khi đóng.
  - `/debts`: filter 2 hàng 3 nút, `scrollWidth = clientWidth = 375`.
  - `/dashboard`: lưới quick links 4×2 (chỉ thấy skeleton vì không có API).
  - Sheet "Thêm": nút giao diện và nút ngôn ngữ đều 12px/40px, không còn `<select>`; đổi sang English hoạt động; cuộn 152px → mở/đóng sheet → `scrollY = 152`.
  - `/calendar`: chọn Lưới tháng → reload → vẫn Lưới tháng (`zalobot:calendar-view:phone = month`).

## Chưa kiểm được

- Scroll xuyên sheet trên iPhone thật (Chromium không tái hiện).
- Quick links với dữ liệu thật (nhãn dài xuống 2 dòng) — chỉ thấy skeleton.
- (Đã giải quyết) `node .claude/hooks/docs-drift-check.mjs`: PASS sau commit `33303ec`.

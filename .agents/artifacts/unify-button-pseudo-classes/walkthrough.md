# Walkthrough: Thống nhất trạng thái tương tác của button

- Plan: [implementation_plan.md](implementation_plan.md) (đã duyệt: Q1 đổi primary lệch màu, Q2 `not-allowed`, Q3 có guard spec)
- Branch: `refactor/unify-button-states`. **Chưa commit.**

## Đã làm

1. **Lớp nền** (`apps/web/src/styles.css`, `@layer base`) cho mọi `button` / `[role=button]`:
   - Nút bật: con trỏ `pointer`. Nút `disabled`: `not-allowed` và mờ 0.5.
   - Transition màu, nền, viền, opacity, transform trong 120ms. Không chuyển dần `outline-color`, để viền focus hiện ngay.
   - `:focus-visible`: outline 2px `#0284c7` cách 1px, dark mode `#93c5fd`. Áp cho cả `a`, `summary`, `[role=tab]`.
2. **`BUTTON_TONE`** (`src/shared/ui/button-styles.ts`, file mới) gồm 12 tone: primary, secondary, ghost, accent, danger, dangerSoft, dangerGhost, positiveSoft, chip/chipSelected, segment/segmentSelected.
   - Tone chỉ chứa màu. Hover dùng `not-disabled:hover:`.
   - Size, padding, radius, font weight vẫn do từng nút tự quyết.
3. **`Button`** chỉ còn mặc định `type="button"`; focus ring riêng đã bỏ.
4. **Migrate** khoảng 70 file trong `src/shared/ui` và 10 module:
   - Bỏ các token cursor, transition, disabled, focus, `active:scale` và `!` trên class màu.
   - Gộp khoảng 15 hằng số tone trùng lặp về `BUTTON_TONE`.
   - Đổi primary blue/indigo/emerald/amber/sky-700 về `primary`.
   - Ngoại lệ (giữ màu riêng có lý do) được ghi trong doc của từng module.
5. **Guard spec** (`src/shared/ui/button-states.spec.ts`):
   - Quét mọi thẻ `<button>`/`<Button>`, đọc theo vào hằng số và helper cấp file lẫn cục bộ trong component, rồi báo `file:dòng token (lý do)`.
   - Có fixture test chứng minh guard bắt được token cấm, nên guard không thể pass "rỗng".
6. **Tài liệu**:
   - `global/web-ui-direction.md`: knowledge EN có mục "Button Interaction States", docs VI có mục "Trạng thái tương tác của nút".
   - Mục "Buttons" / "Nút bấm" của 10 module (EN + VI).

## Kiểm chứng đã chạy

- Guard spec: từ 752 vi phạm xuống 0; fixture test pass.
- `npm run typecheck`, `lint`, `test` (141/141) và `build` của `@zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs --all`: pass.
- Đã kiểm tra trên browser pane, bản build tĩnh, không có API nên chỉ ở màn "phiên hết hạn", sidebar và sheet "Thêm":
  - Nút bật có con trỏ `pointer`.
  - Nút khoá: `not-allowed`, opacity 0.5, rê chuột thật vào không đổi nền.
  - Hover nút secondary ở dark mode: `slate-800` → `slate-700`.
  - Phím Tab: viền 2px `#0284c7` ở light, `#93c5fd` ở dark.
  - Light/dark và viewport mobile 375px.

## Chưa kiểm chứng / rủi ro còn lại

- Các trang có dữ liệu thật (bảng, dialog, sheet chi tiết, trang ZCA, Google Drive) chưa được xem bằng mắt sau khi đổi màu. Lý do: không chạy được API local, vì `.env` trỏ vào môi trường thật. Nên xem lại trên staging/prod sau khi deploy.
- Những thay đổi màu dễ nhận thấy:
  - Primary ở ZCA, Google Drive, điều chỉnh số dư, Nơi chốn, form người dùng, kết quả đồng bộ media.
  - Nút 🗑 xoá trong dòng giờ dùng `dangerSoft` (nền đỏ nhạt ngay khi đứng yên).
  - Nút chọn đang bật của chip lọc giờ là sky nhạt thay vì nền đặc.
- Hai file `src/modules/auth/api/session-user-api.ts` và `src/shared/ui/nav-visibility.ts` đã fail `prettier --check` từ trước thay đổi này. Không sửa vì ngoài phạm vi.

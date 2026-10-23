# Kế hoạch: Thống nhất style pseudo-class cho button toàn bộ web app

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Phạm vi: `apps/web` (`src/**`, `app/**`), tài liệu `global/web-ui-direction.md` (knowledge EN + docs VI)
- Rủi ro: **MEDIUM** (khoảng 70 file, thay đổi giao diện có chủ đích, không đụng API/schema/hành vi)

## 1. Hiện trạng (khảo sát bằng script trên code đang chạy)

Tổng: **287 button** (276 `<button>` thô + 11 `<Button>`), nằm trong 70 file. `Button` primitive (`src/shared/ui/button.tsx`) chỉ thêm focus ring và chỉ được dùng ở 4 nơi.

| Trạng thái | Hiện trạng | Hệ quả |
| --- | --- | --- |
| Cursor | 142 nút có `cursor-pointer`, 145 nút không có. Preflight của Tailwind v4 đặt `cursor: default` cho button | Khoảng nửa app hiện con trỏ mũi tên khi rê vào nút |
| Disabled | 84 nút có prop `disabled`: 21 nút không có style disabled, 81 nút vẫn đổi màu khi hover lúc đang disabled. Opacity dùng lẫn `50` (45), `60` (7), `40` (5). Cursor dùng lẫn `not-allowed` (8), `default` (6), `wait` (1) | Nút bị khóa trông như vẫn bấm được |
| Focus (bàn phím) | Chỉ 6 nút có style focus riêng, mỗi nút một kiểu: `ring-2 sky-500 offset-1` (Button), `focus:ring-1` (ô ID của DataTable, hiện cả khi bấm chuột), `outline blue-500`, `ring blue-500`... `zca-screen.tsx:471` có `focus:outline-none` mà không có style thay thế. Các nút còn lại dùng outline mặc định của trình duyệt (Chrome và Safari khác nhau) | Lỗi a11y: dùng phím Tab thì có nút không thấy focus. Vòng focus không đồng nhất |
| Active (đang nhấn) | Touch: đã có rule chung trong `styles.css` (`scale(.97)` + `opacity .85`, `data-press="none"` thì mờ còn `.6`), rule này ổn. Có 2 nút dùng riêng `active:scale-95` | Lệch với rule chung |
| Hover | 88 token hover khác nhau. Vai trò "primary" được định nghĩa ít nhất 5 lần với 5 màu: `slate-900` (41 nút, đúng direction), `blue-600` (8), `indigo-600` (5), `emerald-600` (2), `sky-700` (1). Nền hover của secondary dùng lẫn `slate-50`/`100`/`200`, dark mode dùng lẫn `slate-800`/`700` | Cùng một vai trò mà mỗi màn hình phản hồi một kiểu |
| Transition | 155 nút có transition, 111 nút có hover nhưng không có transition | Có nút đổi màu mượt, có nút đổi giật |
| `!important` | 52 nút dùng `!bg-white`, `hover:!bg-slate-100`... Đây là tàn dư từ thời còn CSS BEM global cho button (commit `d521544`). Nay `styles.css` không còn rule nào cho button nên các `!` này thừa | Khó override, dễ gây xung đột |

Các hằng số tone đang bị định nghĩa trùng lặp:
- `PRIMARY`/`SECONDARY` trong `form-dialog.tsx` và `calendar-event-sheet.tsx`: trùng nguyên văn.
- `PRIMARY_BUTTON`/`SECONDARY_BUTTON`/`GHOST_BUTTON` trong `contacts/.../profile-styles.ts`.
- `PRIMARY_BUTTON`/`SECONDARY_BUTTON`/`DANGER_BUTTON` trong `zca/.../google-storage-account-panel.tsx`: primary màu xanh `blue-600`.
- `STORAGE_LINK_*`/`PRIMARY_BUTTON_CLASS` trong `zca/.../thread-storage-link-form.tsx` (`blue-600`).
- `NEUTRAL_TONE`/`POSITIVE_TONE` trong `zca/.../chat-row-parts.tsx`.
- `PAGE_BUTTON` (audit), `NAV_BUTTON`/`SEGMENT` (calendar-screen), `TOPBAR_ICON_BUTTON`/`MENU_FOOTER_BUTTON` (app-navigation), `MOBILE_ACTION_BUTTON`.

## 2. Mục tiêu và phạm vi

**Trong phạm vi**, chỉ các trạng thái tương tác: cursor, hover, focus-visible, active/pressed, disabled, selected (`aria-pressed`/segmented), transition. Áp dụng cho `<button>`, `<Button>`, và link hay `[role=button]` được style như button (gồm focus và tone).

**Giữ nguyên**: kích thước, chiều cao, padding, **radius** (theo memory "keep small radius": không gộp chung radius), cỡ chữ, layout, tap target (`touch.ts`), hành vi và i18n. Không thêm thư viện (không dùng `tailwind-merge` hay `cva`).

## 3. Đặc tả trạng thái thống nhất

### 3.1 Lớp nền toàn cục (`styles.css`, `@layer base`): tự áp cho mọi button, không cần sửa từng nút

```css
@layer base {
  button:not(:disabled),
  [role='button']:not([aria-disabled='true']) {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  button,
  [role='button'] {
    transition-property: color, background-color, border-color, outline-color, opacity, transform;
    transition-duration: 120ms;
    transition-timing-function: ease-out;
  }

  :is(button, a, summary, [role='button'], [role='tab']):focus-visible {
    outline: 2px solid #0284c7; /* sky-600 */
    outline-offset: 1px;
  }
}
```

- Rule dark đang có (`html[data-theme='dark'] …:focus-visible { outline-color: #93c5fd }`) được giữ và mở rộng sang `summary`, `[role=button]`, `[role=tab]`. Đây là vòng focus xanh nhạt đã ghi trong direction.
- Rule nằm trong `@layer base` nên utility luôn thắng. Nút nào thật sự cần ngoại lệ thì override tường minh, ví dụ `disabled:opacity-100 disabled:cursor-default`.
- Rule pressed cho touch (`@media (hover: none)`) giữ nguyên. Desktop không thêm hiệu ứng nhấn (giao diện data-dense, giống GitHub/Linear: chỉ dùng hover và focus).
- Hover chỉ chạy trên thiết bị có chuột, vì `hover:` của Tailwind v4 đã bọc sẵn `@media (hover: hover)`, nên không bị "dính" hover trên điện thoại.

### 3.2 Recipe tone dùng chung: file mới `src/shared/ui/button-styles.ts`

Mỗi tone **chỉ chứa màu và trạng thái** (nền, viền, chữ, hover, dark mode), không chứa size hay radius. Hover dùng `not-disabled:hover:` thay cho `enabled:hover:`, vì `:enabled` không khớp với thẻ `<a>`, link sẽ mất hover. Màu chọn theo cách dùng phổ biến nhất hiện nay và theo `web-ui-direction.md`:

| Tone | Light | Dark | Dùng cho |
| --- | --- | --- | --- |
| `primary` | `border-slate-900 bg-slate-900 text-white`, hover `bg-slate-800` | `border-sky-600 bg-sky-600 text-white`, hover `bg-sky-500` | Lưu, tạo, + thêm, xác nhận |
| `secondary` | `border-slate-300 bg-white text-slate-700`, hover `border-slate-400 bg-slate-50 text-slate-900` | `border-slate-700 bg-slate-800 text-slate-200`, hover `bg-slate-700 text-slate-100` | Hủy, nút toolbar, phân trang |
| `ghost` | `border-transparent bg-transparent text-slate-600`, hover `bg-slate-100 text-slate-900` | `text-slate-300`, hover `bg-slate-800 text-slate-100` | Icon button, nút phụ trong hàng |
| `accent` | `border-transparent text-sky-700`, hover `bg-sky-50` | `text-sky-400`, hover `bg-sky-950/40` | Nút dạng link, ô ID, "Xem" |
| `danger` | `border-rose-600 bg-rose-600 text-white`, hover `bg-rose-700` | hover `bg-rose-500` | Xác nhận xóa |
| `dangerSoft` | `border-rose-200 bg-rose-50 text-rose-700`, hover `bg-rose-100` | `border-rose-800 bg-rose-950/40 text-rose-300`, hover `bg-rose-950/70` | Nút Xóa thứ cấp, Đăng xuất |
| `positiveSoft` | `border-emerald-600 bg-emerald-50 text-emerald-700`, hover `bg-emerald-100` | `bg-emerald-950/60 text-emerald-300`, hover `bg-emerald-900/60` | Trạng thái "đã cấp quyền" (ZCA) |
| `segment` / `segmentSelected` | chưa chọn: `bg-transparent text-slate-600`, hover `text-slate-900`. Đã chọn: `bg-white text-slate-900 shadow-xs` | đã chọn: `bg-slate-800 text-slate-100` | Nhóm toggle (grain, chế độ xem lịch, bộ lọc trạng thái nợ) |

Export dưới dạng `BUTTON_TONE = { … } as const` cùng `type ButtonTone = keyof typeof BUTTON_TONE`.

### 3.3 Quy tắc cho mọi button sau khi migrate

1. Không tự khai báo `cursor-*`, `transition-colors`, `disabled:opacity-*`, `disabled:cursor-*`, `focus:*`/`focus:outline-none`, `active:scale-*` (lớp nền đã lo phần này).
2. Không dùng tiền tố `!` cho màu của button.
3. Màu lấy từ `BUTTON_TONE`. Ngoại lệ được tự đặt màu riêng (vẫn tuân thủ mục 1 và 2): chip sự kiện lịch (màu theo sự kiện), hàng của mobile list và agenda (`data-press="none"`), tab bar, ô trong More sheet, link sidebar, legend biểu đồ, option của autocomplete.
4. Nút được đặt `disabled` vì là mục "đang chọn" mà không muốn bị mờ thì ghi tường minh `disabled:opacity-100 disabled:cursor-default`, kèm comment lý do.

## 4. Các bước thực hiện (Phase 2, sau khi duyệt)

1. **Lớp nền**: thêm block 3.1 vào `apps/web/src/styles.css`, mở rộng rule focus của dark mode.
2. **Recipe**: tạo `src/shared/ui/button-styles.ts` (`BUTTON_TONE`, `ButtonTone`). `button.tsx`: bỏ focus ring riêng vì lớp nền đã lo, giữ nguyên API.
3. **Shared UI** (khoảng 40 nút): `form-dialog`, `confirm-dialog`, `modal`, `mobile-action-bar`, `app-navigation`, `workspace-header`, `period-filter-toolbar`, `data-table` (ô ID: bỏ `focus:ring-1 focus:outline-none`, dùng tone `accent`), `data-table-mobile-list`, `trend-summary-strip`, `pwa-status-stack`, `error-boundary`. Bỏ `!` và các token thừa.
4. **Module** (mỗi nhóm một commit): `dashboard` (86) → `zca` (56) → `contacts` / `debts` / `settings` / `audit` / `calendar` / `users` / `expenses` / `auth` (khoảng 105). Thay các hằng số tone cục bộ ở mục 1 bằng `BUTTON_TONE`. Vẫn giữ hằng số cho size hoặc shape cục bộ (`FOOTER_BUTTON`, `CELL_BUTTON`...) vì size và radius ngoài phạm vi.
5. **Guard chống tái phát**: tạo `src/shared/ui/button-states.spec.ts` (chạy bằng `tsx --test` như các spec khác). Spec quét opening tag `<button`/`<Button` và các hằng số có tên `*BUTTON*`/`*TONE*` trong `src/**/*.tsx|ts`, rồi fail khi gặp token bị cấm ở mục 3.3 (1) và (2). Ngoại lệ chỉ được phép khi có `disabled:opacity-100`.
6. **Tài liệu** (hard completion gate):
   - `.agents/knowledge/global/web-ui-direction.md`: thêm mục "Button interaction states" (lớp nền, tone, ngoại lệ, guard). Thêm `apps/web/src/shared/ui/button-styles.ts` và `button.tsx` vào `depends_on`. Thay đoạn "Dark-mode button tones" bằng tham chiếu tới `BUTTON_TONE`.
   - `.agents/docs/global/web-ui-direction.md` (VI): giải thích lý do, cách chọn tone và cách khai báo ngoại lệ.
   - Cập nhật `.agents/docs/README.md` nếu index thay đổi. Chạy `node .claude/hooks/docs-drift-check.mjs`.

## 5. Kiểm chứng

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web` (gồm guard spec), `npm run build --workspace @zalobot/web`.
- Chạy lại script khảo sát: kỳ vọng cursor và disabled đồng nhất, 0 nút `outline-none`, 0 nút dùng `!`, 0 token bị cấm.
- Kiểm tra thủ công trên browser pane, cả light và dark: phím Tab đi qua header, toolbar, bảng (ô ID), dialog và sheet; rê chuột lên nút disabled (không đổi màu, cursor `not-allowed`); nhấn trên giả lập mobile (rule touch vẫn chạy). Các trang cần xem: Transactions, Debts, Calendar, Zalo & Users, Google Drive, Activity, Contacts profile, More sheet.

## 6. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
| --- | --- |
| `opacity: .5` toàn cục làm mờ những nút cố ý không mờ (6 chỗ dùng `disabled:cursor-default`, ví dụ footer dialog hay ô summary của lịch) | Rà từng chỗ trong lúc migrate. Chỗ nào cần thì ghi tường minh `disabled:opacity-100` |
| Outline bị cắt trong container `overflow-hidden` (nhóm segmented, ô bảng) | `outline-offset: 1px`. Nhóm segmented dùng `focus-visible:-outline-offset-2` (outline thụt vào trong) |
| Đổi màu primary (blue/indigo/emerald → slate-900/sky-600) là thay đổi nhìn thấy được ở ZCA, Google Drive, điều chỉnh số dư, form người dùng, error boundary, places | Chờ anh quyết ở câu hỏi Q1 |
| Diff lớn (khoảng 70 file) | Thay đổi máy móc, chia commit theo nhóm, không đổi hành vi. Version để pre-commit hook tự bump |
| Token cũ còn sót override lớp nền (utility luôn thắng `@layer base`) | Guard spec cùng script khảo sát |

## 7. Câu hỏi cần anh chốt khi duyệt

- **Q1. Primary lệch màu (khoảng 16 nút `blue-600`/`indigo-600`/`emerald-600`/`sky-700`)**: đổi hết về primary chuẩn (`slate-900`, dark `sky-600`)? **Đề xuất: có.** Riêng `sky-600` ở calendar agenda/grid là trạng thái *đang chọn sự kiện*, không phải primary, nên giữ nguyên.
- **Q2. Cursor khi disabled**: `not-allowed` (**đề xuất**, đang là kiểu phổ biến hơn) hay `default`?
- **Q3. Guard spec (bước 5)**: thêm vào để chặn tái phát? **Đề xuất: có.**

# Playbook: Biến dashboard web thành app mobile/PWA "như native"

Tài liệu tổng hợp từ dự án zalobot (Next.js 16 static export + Tailwind v4 + TanStack Query), ngày 22/10/2026. Mục đích: đưa sang dự án khác và bảo agent làm giống. Phần cuối có sẵn **prompt mẫu** để dán cho agent.

Các con số dưới đây đều đã chạy thật trên prod và được góp ý trên iPhone thật.

---

## 0. Nguyên tắc chung

1. **Desktop giữ nguyên.** Mọi thay đổi mobile chỉ nằm sau breakpoint (`max-[960px]:`, `max-sm:`) hoặc nhánh `useIsCompact()`/`useIsPhone()`.
2. **Mobile là app, không phải web co lại**: có thanh tab dưới đáy, danh sách thay cho bảng, sheet trượt lên, vùng chạm 40px, không cuộn ngang.
3. **Phong cách B2B gọn, phẳng**:
   - Bo góc nhỏ: nút/thẻ/dialog tối đa 4px (`rounded-[3px]`), badge 2px.
   - `rounded-full` chỉ dùng cho avatar, chấm trạng thái, công tắc, spinner.
   - Không FAB tròn, không pill.
4. **Không thêm thư viện UI/animation.** Dùng CSS + Web Animations API + touch events.
5. **Làm theo từng giai đoạn**, mỗi giai đoạn một commit, và test trên **prod thật ở khổ 375px** sau mỗi lần deploy.

---

## 1. Breakpoint: một nguồn duy nhất

- Một file `breakpoints.ts`:
  - `PHONE_MAX_WIDTH = 640`: danh sách, bottom sheet, vùng chạm 40px.
  - `COMPACT_MAX_WIDTH = 960`: topbar + thanh tab + danh sách thay bảng; gồm cả tablet dọc và điện thoại xoay ngang.
- Hook `useIsPhone()`, `useIsCompact()` dùng `useSyncExternalStore(matchMedia)`, giá trị server là `false` (coi như desktop cho tới khi hydrate).
- Trong Tailwind viết thẳng `max-sm:` / `max-[640px]:` và `max-[960px]:`, không đặt thêm mốc khác.

## 2. Khung app (shell)

### Topbar (≤ 960px)
- Sticky, cao 52px: `[Tên trang] [icon ẩn/hiện số tiền] [icon làm mới]`. Mỗi nút 40px.
- **Không có nút ☰**: menu chỉ mở qua tab "Thêm".
- Tiêu đề lấy từ map `pathname → i18n key` dùng chung với header desktop. Route nào cũng phải có trong map, nếu không topbar hiện tên app.

### Thanh tab dưới đáy
- `fixed bottom-0`, cao `56px + env(safe-area-inset-bottom)`, 5 ô bằng nhau: 4 trang dùng nhiều nhất + **"Thêm"**.
- Nhãn dài thì dùng khoá i18n rút gọn riêng cho tab.
- **Vạch chỉ báo 2px trượt ngang**: một phần tử duy nhất. Đo `offsetLeft/offsetWidth` của tab đang chọn rồi set `transform`/`width`, transition 300ms đường cong iOS. Lần đặt đầu tiên không có transition.
- **Phản hồi tức thì**: tab vừa bấm sáng lên ngay (state `pendingTab`, xoá khi pathname đổi). Icon nảy nhẹ (scale 1 → 0.86 → 1, 260ms). Nếu mạng chậm thì có vạch tải nhỏ qua `useLinkStatus()` (Next).

### Menu "Thêm"
- Là **bottom sheet** (dùng chung component Modal), mọi trang xếp **lưới 3 cột**, ô cao 72px: icon 24px + nhãn, trang hiện tại tô đặc. Tiêu đề nhóm viết nhỏ.
- Chân sheet: [đổi giao diện] [ngôn ngữ], rồi nút Đăng xuất.
- **Không dùng drawer trái**: người dùng chê "hiện nửa màn hình, có thanh cuộn bên trong".

### Safe-area
- Viewport `viewportFit: 'cover'`.
- Layout chừa `env(safe-area-inset-top/left/right)`. Phía dưới chừa `56px + 1.25rem + inset-bottom` cho thanh tab.
- Topbar sticky đặt `top: env(safe-area-inset-top)`, thêm một dải màu nền `fixed` che vùng status bar.

### Thanh hành động chính (`MobileActionBar`)
- Nút chính **đã có sẵn** của màn hình chuyển xuống một thanh `fixed` nằm ngay trên thanh tab: cao 40px, bo 3px, nút chia đều chiều ngang.
- Nút cũ trên toolbar thêm `max-[960px]:hidden`.
- Có một spacer trong luồng trang để dòng cuối không bị thanh che.
- Không dùng thanh này để thêm tính năng mới.

### Toast
- Một hằng vị trí dùng chung:
  - Desktop: góc phải dưới.
  - Mobile: rộng hết màn, nằm trên thanh tab, cộng `env(safe-area-inset-bottom)`.

## 3. Bảng → danh sách trên mobile

- Component bảng dùng chung có **chế độ danh sách** khi ≤ 960px và có ít nhất một cột khai báo slot:
  - `mobileSlot: 'primary' | 'secondary' | 'trailing'`.
  - `mobileCell`: text thuần, không có nút.
  - `mobileHeader`: đưa nút lọc của cột lên dải lọc cuộn ngang.
- **Dòng**: một `<button>` cao tối thiểu 52px, `border-b`, không card/shadow.
  - Dòng 1: primary (tự cắt) + trailing (số tiền, `tabular-nums`).
  - Dòng 2: các secondary nối bằng ` · `.
- **Chạm dòng** mở **bottom sheet chi tiết**:
  - Mọi cột hiện dạng nhãn/giá trị, render bằng `column.cell`, nên sửa inline vẫn chạy.
  - Cột `actions` nằm ở footer sticky.
  - Ô nhập và nút trong sheet tự lên 40px nhờ selector con, ví dụ `[&_:is(input,select,textarea)]:min-h-10 [&_button]:min-h-10`.
- **Sửa trên cảm ứng** đi qua nút "Sửa" ở chân sheet. **Không dựa vào double-click.**
- **Chọn nhiều để gộp**: nút "Chọn" bật chế độ chọn (dòng thành ô checkbox 40px), hoặc nút chọn trong footer sheet. Nút Gộp nằm ở thanh hành động dưới đáy khi đã chọn từ 2 dòng.
- **Bảng không có slot** vẫn cuộn ngang, nhưng trên mobile **bỏ hộp cuộn lồng `max-h`** để cả trang cuộn.
- **Màn hình riêng**:
  - Lịch: mặc định agenda (dải tuần 7 ngày + danh sách theo ngày) thay cho lưới tháng.
  - Trang tổng quan: mỗi mục 5 dòng + "Xem tất cả".

## 4. Vùng chạm, toolbar, chữ

- **Vùng chạm**: mọi control ≥ 40×40px trên điện thoại. Dùng hằng `TAP_CONTROL`, `TAP_INPUT` (40px + full width).
- **Toolbar trên điện thoại** gồm ô tìm kiếm full width cao 40px và **một hàng chip cuộn ngang**. Hằng `MOBILE_TOOLBAR_ROW` phải có `min-w-0 max-w-full flex-nowrap overflow-x-auto`.
  - Thiếu `min-w-0` thì hàng chip `nowrap` sẽ kéo **cả trang** rộng ~980px; thanh tab `fixed` cũng rộng theo. Lỗi này đã gặp thật trên prod.
- **Chọn kỳ trên điện thoại**: dùng `<select>` native thay cho nhóm nút, để chu kỳ + ‹ nhãn › nằm trên một dòng.
- **Ô nhập 16px trên màn cảm ứng** (bắt buộc với iOS):
  ```css
  @media (hover: none) and (pointer: coarse) {
    input:not([type='checkbox']):not([type='radio']):not([type='range']),
    select,
    textarea { font-size: 16px !important; }
  }
  ```
  - Cách `maximum-scale=1` **không giữ được** trong PWA đã cài trên iPhone thật.
- **Phản hồi chạm** (chỉ khi `@media (hover: none)`):
  - `-webkit-tap-highlight-color: transparent`.
  - Nút: `active` → `scale(.97)` + `opacity .85`.
  - Link, tab, dòng full width (`data-press="none"`): `opacity .6` + đổi nền.
  - `touch-action: manipulation`.
  - `user-select: none` và `-webkit-touch-callout: none` trên nav/nút.
- **PWA**: `@media (display-mode: standalone) { html, body { overscroll-behavior-y: none } }`.

## 5. Dialog / bottom sheet

- **Một component `Modal`** dựa trên `<dialog>` native + `showModal()`: có top layer, nền "trơ", Escape qua sự kiện `cancel`. Cấm tự viết overlay `fixed inset-0`.
- **Điện thoại < 640px**: bottom sheet rộng hết màn, bo góc trên, có thanh kéo 36×4px, chừa `pb-[env(safe-area-inset-bottom)]`. Form dài dùng `phoneLayout="fullscreen"`.
- **`<dialog>` không được cuộn**: dùng `overflow: clip` (Tailwind `overflow-hidden supports-[overflow:clip]:overflow-clip`), **không** để `overflow: hidden`.
  - `hidden` vẫn là scroll container. Lúc sheet bắt đầu ở `translateY(100%)`, dialog cao gấp đôi màn hình. WebKit cuộn tới panel đang focus, rồi bị kéo về khi sheet trượt lên, nên sheet vọt lên rồi rớt xuống.
- **Bàn phím ảo**:
  - Kích thước dialog theo visual viewport (CSS var `--app-vvh`/`--app-vv-top` cập nhật từ `window.visualViewport`).
  - **Ghi giá trị lần đầu đồng bộ** trong `useLayoutEffect`, trước `showModal()` và trước animation. Hook phải được khai báo trước layout effect mở dialog. `requestAnimationFrame` chỉ dùng cho resize/scroll về sau.
  - Lý do: nếu frame đầu dialog cao `100dvh` rồi frame sau mới đổi sang chiều cao visual viewport, sheet bị giật giữa chừng (trên PWA iOS hai giá trị này lệch nhau).
  - Panel tự cuộn, header/footer `sticky` có nền đặc.
  - Ô được focus thì `scrollIntoView` sau 300ms.
  - Viewport đặt `interactiveWidget: 'resizes-content'`.
- **Không tự focus input khi mở** (bàn phím sẽ bật lên): gắn `autofocus` cho panel.
- **Nút trong sheet**: ✕ 40×40, nút footer cao 40px và chia đều chiều ngang.
- **Không có hộp cuộn lồng** bên trong sheet.

## 6. Chuyển động (bộ thông số dùng chung `motion.ts`)

| Thông số | Giá trị |
|---|---|
| Đường cong chung (kiểu iOS: vạch tab, icon nảy, đổi trang, vuốt bật về) | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Sheet mở (kiểu Modal Bottom Sheet, giảm tốc) | 350ms, `cubic-bezier(0, 0, 0.2, 1)` |
| Sheet đóng (tăng tốc) | 250ms, `cubic-bezier(0.4, 0, 1, 1)` |
| Fade vào / ra | 200 / 160ms |
| Đổi trang | 220ms (chỉ opacity) |
| Vạch chỉ báo tab | 300ms |
| Icon nảy | 260ms |

- **Sheet**: dùng **Web Animations API** (`el.animate`), **không** dùng `@starting-style`, vì Safari < 17.5 bỏ qua nên người dùng thấy "không trượt".
  - Mở: `translateY(100%) → 0`, 350ms, đường cong giảm tốc: đi đều rồi chậm dần vào chỗ, không vọt.
  - Đóng: chỉ khai báo keyframe đích `translateY(100%)` (có `fill: 'forwards'`), 250ms tăng tốc, nên sheet đi tiếp từ vị trí hiện tại, kể cả khi đang vuốt dở.
  - Nền mờ fade cùng thời lượng và cùng đường cong với sheet.
  - **Không dùng đường cong iOS cho sheet**: nó dồn ~85% quãng đường vào 150ms đầu, với sheet cao (như menu "Thêm") thì nhìn như sheet nhảy vọt lên. Kéo dài thời lượng cũng không chữa được.
  - Giữ DOM thêm đúng thời lượng đóng (250ms) sau khi `open=false` để kịp chạy hiệu ứng đóng.
- **Đổi trang**: fade cột nội dung khi pathname đổi. **Chỉ dùng opacity.** Transform trên tổ tiên sẽ thành containing block của các phần tử `fixed` (toast, thanh hành động) và làm chúng giật.
- **Vào màn** (`@keyframes` trong `@theme` của Tailwind):
  - 10 dòng đầu của danh sách trượt lên 6px, mỗi dòng trễ 20ms.
  - Toast trượt lên 16px.
  - Thanh hành động trượt lên từ đáy.
  - Thanh cập nhật phiên bản trượt xuống.
- **Mở rộng/thu gọn**: giữ phần tử luôn mount, animate `grid-template-rows: 0fr ↔ 1fr` + opacity, gắn `inert` khi đóng, mũi tên xoay 180°.
- **Rung**: `navigator.vibrate(8)` khi cử chỉ vượt ngưỡng. Chỉ chạy trên Android; iOS web không có API rung.
- **Giảm chuyển động**: tôn trọng `prefers-reduced-motion`. Helper JS tự bỏ qua, CSS ép thời lượng còn ~0ms.

## 7. Cử chỉ

- **Vuốt để đóng**: dùng **touch events** (`touchmove` với `passive: false` rồi `preventDefault`), vì iOS huỷ pointer events ngay khi trang bắt đầu cuộn.
  - Khoá trục sau 8px.
  - Kéo ngược hướng thì cản lại (chỉ đi 1/4 quãng).
  - Thả quá **25%** kích thước, hoặc vận tốc > **0.5px/ms**, thì đóng; không thì bật về (300ms, đường cong iOS).
  - Tách phần tính toán ra hàm thuần và viết unit test.
  - Sheet chỉ kéo được từ dải trên cùng 64px, và chỉ khi dialog cho phép đóng.
- **Kéo để làm mới**: **chỉ trong app đã cài** (`display-mode: standalone`), vì trình duyệt đã có sẵn.
  - Ở đỉnh trang, kéo chỉ đi nửa tốc độ ngón tay, ngưỡng 64px, tối đa 96px.
  - Nhãn: Kéo / Thả / Đang làm mới. Icon ↻ xoay theo độ kéo.
  - Thả ra thì gọi `queryClient.invalidateQueries()` và quay tới khi xong, sau đó bật về.
  - Không chạy khi đang khoá cuộn (dialog đang mở).

## 8. PWA

- **Manifest**: `display: standalone`, `id`/`start_url`/`scope` = `/` (không bao giờ đổi `id`), có icon thường + maskable.
- **Service worker viết tay** (không thư viện), đăng ký dạng `/sw.js?v=<version>`:
  - Điều hướng trang: lấy mạng trước, offline thì dùng bản đã lưu, cuối cùng là `offline.html`.
  - `/_next/static/*`: lấy cache trước.
  - Ảnh/icon/font: trả cache ngay, đồng thời tải bản mới ở nền.
  - **Không đụng `/api/*`**: không bao giờ cache dữ liệu tài chính, link đăng nhập hay OAuth.
- **Cập nhật phiên bản**:
  - Service worker mới **chờ**, không tự `skipWaiting`. App hiện thông báo; trên mobile là một hàng 40px trong luồng trang (không đè nội dung).
  - Bấm "Tải lại" thì app gửi `SKIP_WAITING`, sau đó `controllerchange` tải lại trang một lần.
  - **Tự áp dụng ở lần chuyển trang kế tiếp** nếu người dùng không bấm.
  - Lưu ý: trình duyệt có thể mất 20–40 giây mới kích hoạt service worker mới.
- **Header cache (nginx)**:
  - HTML, `sw.js`, manifest: `Cache-Control: no-cache`.
  - `/_next/static/`: `public, max-age=31536000, immutable` (dùng `location ^~` để regex không bắt trước).
  - File trong `public/` (icon, favicon): `max-age=86400`.
  - **Cloudflare có thể đè header của `sw.js`**: cần Cache Rule bỏ qua cache cho `/sw.js`.
- **Đăng nhập trong app đã cài trên iOS**: app không dùng chung storage với Safari, nên cần đăng nhập bằng mã (bot gửi mã kèm link).

## 9. Bài học (lỗi đã gặp thật)

1. **Tràn ngang 980px**: flex con `nowrap` thiếu `min-w-0`. Mỗi trang cần đo `document.documentElement.scrollWidth === 375`.
2. **iOS zoom khi focus**: chỉ ô nhập 16px mới hết hẳn.
3. **Sheet "không trượt" trên iPhone**: `@starting-style` không chạy trên iOS cũ, phải chuyển sang Web Animations.
4. **Toast/thanh `fixed` giật khi chuyển trang**: do transform trên tổ tiên. Chỉ fade opacity.
5. **Prod "chưa đổi" sau deploy**: HTML không có `Cache-Control` nên trình duyệt giữ bản cũ.
6. **Commit cuốn nhầm thay đổi của phiên khác**: khi nhiều agent cùng sửa một thư mục, chỉ stage đúng file/hunk của mình. Build thử bản trên `main` trong một worktree riêng trước khi push.
7. **Đo animation trong trình duyệt bị ẩn sẽ ra sai**: khi không vẽ khung hình, transition đứng yên ở giá trị đầu. Phải chụp màn hình để buộc trình duyệt vẽ.
8. **Lộ dữ liệu khi ẩn số tiền**: ô nhập điền sẵn số dư thật. Khi đang ẩn số tiền thì để trống.
9. **Sheet vọt lên cao rồi rớt xuống trong app iPhone đã cài**: có ba nguyên nhân cộng lại:
   - `<dialog>` để `overflow: hidden` nên cuộn được.
   - Biến visual viewport được ghi trễ một frame.
   - Đường cong iOS dồn quãng đường vào đầu.

   Cách sửa: `overflow: clip`, ghi biến đồng bộ trước `showModal()`, và dùng motion Modal Bottom Sheet 350/250ms (mục 5–6). Chrome trên máy tính không tái hiện được, phải thử trên iPhone thật.

## 10. Checklist test mỗi lần deploy (khổ 375×812 và 768)

- [ ] Mọi trang: `scrollWidth` bằng đúng bề rộng màn hình, có thanh tab, không còn `<table>` ở chế độ compact.
- [ ] Không phần tử nào (nút/thẻ/dialog) có `border-radius` > 4px, trừ avatar/chấm/công tắc.
- [ ] Topbar hiện đúng tên trang ở mọi route.
- [ ] Sheet: trượt lên một mạch rồi chậm dần vào chỗ, không vọt quá rồi tụt (thử trên iPhone, app đã cài); kéo ngắn thì bật lại; kéo ở phần nội dung không đóng; Escape vẫn đóng.
- [ ] Menu "Thêm": đủ mục, không cuộn trên iPhone 12 trở lên.
- [ ] Dialog: không tự bật bàn phím; footer luôn thấy được; không lộ dữ liệu bị ẩn.
- [ ] PWA: thông báo bản mới không che nội dung; reload giữ đúng URL; header cache đúng.
- [ ] Thử trên iPhone thật: ô nhập không zoom, cảm giác vuốt, kéo để làm mới trong app đã cài.

---

## 11. Prompt mẫu để dán cho agent ở dự án khác

```text
Mục tiêu: làm giao diện mobile + PWA của dự án này giống app native, theo playbook đính kèm
(mobile-pwa-playbook.md). Desktop phải giữ nguyên.

Làm theo thứ tự, mỗi giai đoạn một commit, lập kế hoạch và chờ tôi duyệt trước khi sửa code:
1. Audit: đo scrollWidth ở 375px cho từng trang, liệt kê bảng/toolbar/dialog/nút < 40px,
   hover-only, double-click, bo góc > 4px, ô nhập < 16px.
2. Nền tảng: breakpoints.ts (640/960) + hook; safe-area + viewportFit cover; thanh tab dưới đáy
   (4 trang chính + "Thêm") có vạch trượt; menu "Thêm" là bottom sheet lưới 3 cột (không drawer,
   không nút ☰); MobileActionBar; vị trí toast chung; hằng TAP_CONTROL/TAP_INPUT/MOBILE_TOOLBAR_ROW
   (có min-w-0).
3. Bảng → danh sách 2 dòng + bottom sheet chi tiết (mobileSlot primary/secondary/trailing), sửa qua
   nút trong sheet, chế độ chọn để gộp.
4. Toolbar: ô tìm kiếm full width + một hàng chip cuộn ngang; mọi control >= 40px; ô nhập 16px trên
   màn cảm ứng.
5. Modal dùng <dialog>: bottom sheet trên điện thoại, dialog overflow: clip (không hidden), theo
   visual viewport (ghi biến đồng bộ trong useLayoutEffect trước showModal), header/footer sticky,
   không tự focus input.
6. Chuyển động: motion.ts (cubic-bezier(0.32,0.72,0,1) cho tab/icon/đổi trang; sheet kiểu Modal
   Bottom Sheet bằng Web Animations API: mở 350ms cubic-bezier(0,0,0.2,1), đóng 250ms
   cubic-bezier(0.4,0,1,1), nền mờ cùng nhịp),
   fade khi đổi trang (chỉ opacity), danh sách hiện lần lượt, toast/thanh trượt vào, co giãn bằng
   grid-rows, nút thu nhỏ khi nhấn; vuốt xuống đóng sheet (touch events); kéo để làm mới chỉ trong
   app đã cài; rung trên Android; tôn trọng prefers-reduced-motion.
7. PWA: manifest, service worker viết tay (không cache API), thông báo cập nhật nằm trong luồng
   trang + tự áp dụng khi chuyển trang, header cache nginx (HTML no-cache, static immutable).
Ràng buộc: bo góc nhỏ (<= 4px, không pill/FAB tròn), không thêm thư viện UI/animation, không `any`,
chuỗi mới qua i18n, route qua hằng. Sau mỗi giai đoạn: typecheck, lint, test, build, rồi test trên
prod ở 375px theo checklist mục 10 của playbook.
```

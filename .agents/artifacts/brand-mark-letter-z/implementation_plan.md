# Kế hoạch: đổi logo/icon từ chữ "T" sang chữ "Z"

Rủi ro: **MEDIUM** (nhiều asset nhị phân + 1 dòng UI, không đụng API/DB). Thay đổi nhận diện thương hiệu nên cần anh duyệt.

## Hiện trạng

Mọi logo đang là chữ **T**, còn sót từ thời tích hợp Telegram (`e7e2e9b`). Phong cách giữ nguyên: nền tối gradient `#0f172a → #090d16`, nét chữ gradient xanh `#38bdf8 → #2563eb → #4f46e5`, nét dày bo tròn, chấm sáng góc trên phải, quầng sáng mờ phía sau.

| Nơi dùng | File | Hiện tại |
| --- | --- | --- |
| Icon gốc 512 (manifest `any`, SVG) | `apps/web/public/icon.svg` | T + chấm + 2 chấm dưới |
| Favicon SVG 32 | `apps/web/public/favicon.svg` | T + chấm |
| Favicon ICO | `apps/web/public/favicon.ico` | raster của T |
| PWA `any` | `icon-192.png`, `icon-512.png` | raster của `icon.svg` |
| PWA `maskable` (full-bleed, mark ~80% trong safe zone) | `icon-maskable-192.png`, `icon-maskable-512.png` | T |
| iOS home screen 180 | `apple-touch-icon.png` | T |
| Ảnh chia sẻ link (OG) | `og-image.svg` (monogram dòng 70–72), `og-image.png` | T; **bản PNG hiện mất hết chữ** (lúc render trước đây không có font) |
| Sidebar desktop | `apps/web/src/shared/ui/app-navigation.tsx:315` | ô vuông 24px chữ `T` |

`offline.html` dùng `/favicon.svg` và `/icon-192.png` nên tự đổi theo.

## Thiết kế chữ Z (lưới 512, cùng tỉ lệ với chữ T cũ)

- Thanh trên: x 136–376, y 132–212 (giữ đúng thanh ngang của T), bo góc 24.
- Thanh dưới: x 136–376, y 300–380, bo góc 24.
- Đường chéo: hình bình hành nối mép phải thanh trên xuống mép trái thanh dưới, dày ~80px theo phương ngang (cùng độ dày nét), các góc giao được bo để liền khối.
- Giữ chấm sáng góc trên phải (376,136) và quầng sáng phía sau; bỏ 2 chấm nhỏ dưới đáy vì sẽ đè lên thanh dưới của Z.
- Toàn bộ chữ nằm trong hình tròn safe zone (bán kính 40% = 205px quanh tâm; góc xa nhất ~172px) nên bản maskable không bị cắt.
- Favicon 32: cùng hình học thu nhỏ, nét dày hơn tương đối (thanh ~6.5px) để còn đọc được ở 16px.
- OG monogram 72×72: Z trắng trên ô gradient, như T trắng hiện tại.

## Thay đổi

1. **SVG nguồn** (viết tay, bỏ path T): `icon.svg`, `favicon.svg`, monogram trong `og-image.svg`. Thêm `icon-maskable.svg` (nền full-bleed không bo góc, mark thu 80%) làm nguồn cho bản maskable — không đưa vào manifest.
2. **Raster** bằng một script dùng một lần trong scratchpad (không commit, không thêm dependency), dùng `sharp` đã có trong repo (`apps/api`) + `magick` cho `.ico`:
   - `icon.svg` → `icon-192.png`, `icon-512.png`
   - `icon-maskable.svg` → `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180, full-bleed vì iOS tự bo góc)
   - `favicon.svg` → `favicon.ico` (16 + 32)
   - `og-image.svg` → `og-image.png` (1200×630); kiểm tra chữ có hiện. Nếu sharp vẫn không render được chữ thì báo lại, không tự đổi chữ trong OG thành path.
3. **Sidebar**: `app-navigation.tsx` đổi `T` → `Z` (giữ ô 24px, `rounded-[3px]`).
4. Không đổi `manifest.ts`, `layout.tsx`, `sw.js` (tên file giữ nguyên). Service worker có `VERSION` theo build nên bản deploy mới tự lấy icon mới; nginx cache file `public/` 1 ngày.

## Tài liệu

- `.agents/knowledge/global/pwa.md` + `.agents/docs/global/pwa.md`: ghi mark là chữ **Z**, nguồn SVG (`icon.svg`, `icon-maskable.svg`, `favicon.svg`, `og-image.svg`) và cách xuất lại PNG/ICO.
- `.agents/knowledge/global/web-ui-direction.md` (+ bản VI): "product mark" = ô `Z` 24px.
- `node .claude/hooks/docs-drift-check.mjs` exit 0.

## Kiểm tra

- Xem trực tiếp từng PNG (512, maskable 512 + khung tròn safe zone, 180, favicon 16/32, OG) để duyệt hình.
- `npm run typecheck`/`lint --workspace @zalobot/web`.
- Browser pane: sidebar desktop hiện ô `Z`, tab trình duyệt hiện favicon Z.
- **Lưu ý**: icon PWA đã cài trên iPhone/Android không tự đổi; phải gỡ rồi thêm lại vào màn hình chính (hoặc chờ Android cập nhật manifest).

## Phụ lục: prompt làm bản chữ "C"

Anh muốn chữ C dùng cho dự án/app khác, nên prompt nằm ở câu trả lời trong chat (và bản sao bên dưới) — kế hoạch này không tạo file chữ C trong repo zalobot.

```text
Thiết kế lại bộ logo/icon của app thành monogram chữ "C", giữ đúng phong cách sau:

Phong cách
- Nền: vuông 512×512, bo góc rx=112, gradient chéo #0f172a → #1e293b → #090d16, viền trong 4px #334155 opacity 0.6.
- Chữ: một khối liền, nét dày ~80px (khoảng 16% cạnh), đầu nét bo tròn, tô gradient chéo #38bdf8 → #2563eb → #4f46e5, đổ bóng mềm màu #2563eb (dy 8, blur 12, opacity 0.35).
- Phía sau chữ có quầng sáng tròn r≈140 ở nửa trên, gradient dọc #38bdf8 (opacity 0.3) → trong suốt.
- Một chấm nhấn tròn r=20 màu #38bdf8 với lõi trắng r=12, đặt ở đầu nét trên của chữ C.
- Không dùng font: chữ vẽ bằng <path> để giống nhau trên mọi máy.

Hình học chữ C (lưới 512)
- Cung tròn tâm (256,256), bán kính ngoài ~124, trong ~44 (nét 80), mở về bên phải khoảng 90° (từ -45° đến +45°), hai đầu nét cắt bo tròn.
- Toàn bộ chữ nằm trong vòng tròn bán kính 205 quanh tâm (safe zone maskable).

Bộ file cần xuất (giữ nguyên tên file hiện có của app)
- icon.svg (512, nền bo góc) → icon-192.png, icon-512.png
- icon-maskable.svg (nền full-bleed không bo góc, chữ thu 80%) → icon-maskable-192.png, icon-maskable-512.png, apple-touch-icon.png (180)
- favicon.svg (32×32, rx=7, nét dày tương đối hơn để đọc được ở 16px) → favicon.ico (16+32)
- Monogram trong ảnh OG 1200×630: ô 72×72 rx=18 nền gradient, chữ C trắng → xuất lại og-image.png và kiểm tra chữ trong ảnh còn hiện.
- Ô logo nhỏ trong sidebar/header của app đổi ký tự sang "C".

Cách làm
- Viết SVG tay, xuất PNG/ICO bằng sharp (hoặc ImageMagick) qua một script chạy một lần, không thêm dependency mới.
- Không đổi tên file, manifest hay service worker.
- Mở từng PNG để duyệt: bản maskable phải còn nguyên chữ khi cắt tròn; favicon 16px vẫn nhận ra chữ C.
```

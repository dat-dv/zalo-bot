# Walkthrough: logo/icon chữ Z

## Đã thay đổi

- SVG nguồn (vẽ tay, chữ Z là **một path liền**: góc ngoài bo 24, chỗ nét chéo nối thanh ngang để sắc):
  - `apps/web/public/icon.svg` (512, nền bo góc, quầng sáng, chấm nhấn góc trên phải; bỏ 2 chấm đáy của chữ T cũ).
  - `apps/web/public/icon-maskable.svg` (mới; nền tràn viền, chữ thu 80%) — chỉ là nguồn xuất PNG, không khai báo trong manifest.
  - `apps/web/public/favicon.svg` (32px, cùng path thu nhỏ bằng `transform`).
  - `apps/web/public/og-image.svg` (monogram Z trắng trong ô gradient).
- Xuất lại bằng script dùng một lần trong scratchpad (sharp của `apps/api` + ImageMagick, không commit, không thêm dependency): `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180), `favicon.ico` (16 + 32), `og-image.png` (1200×630).
- Sidebar desktop: `apps/web/src/shared/ui/app-navigation.tsx` ô logo `T` → `Z`.
- Tài liệu: `.agents/knowledge/global/pwa.md` (+ `depends_on` các SVG nguồn), `.agents/docs/global/pwa.md`, `web-ui-direction.md` (EN + VI).

Lần render đầu, nét chéo ghép từ 3 hình riêng bị lồi một mỏm nhỏ ở góc nối thanh trên; đã gộp thành một path liền rồi xuất lại.

## Kiểm tra

- Xem trực tiếp: `icon-512.png`, `icon-maskable-512.png` (chữ nằm gọn trong vùng an toàn), favicon 16/32 phóng to (vẫn đọc ra Z), `apple-touch-icon.png`, `og-image.png` (**chữ trong ảnh OG đã hiện lại**, bản cũ bị mất chữ).
- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Chưa xem ô `Z` trên sidebar trong browser pane (dev server lỗi `EPERM uv_cwd`); thay đổi chỉ là một ký tự trong span có sẵn.

## Lưu ý vận hành

- App đã cài trên điện thoại giữ icon cũ cho tới khi gỡ và thêm lại vào màn hình chính; tab trình duyệt có thể giữ favicon cũ tới 1 ngày (nginx cache `public/`).

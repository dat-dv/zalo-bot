---
RequestFeedback: true
---

# Kế hoạch: chuyển toàn bộ UI web sang Tailwind CSS

## Mục tiêu

Thay thế hệ thống styling tùy biến tập trung tại `apps/web/src/styles.css` bằng Tailwind CSS, trong khi giữ nguyên giao diện nghiệp vụ, responsive behavior, dark mode, accessibility và các tương tác hiện có.

## Hiện trạng đã xác minh

- Web app Next.js 16 hiện chưa có Tailwind hoặc PostCSS config; package manager là npm (`package-lock.json`).
- `apps/web/src/styles.css` có 2.779 dòng CSS; 23 file TSX đang dùng class CSS.
- 9 module UI trong source khớp với knowledge và developer docs.
- `npm run agent-system:validate` đã đạt (87 artifacts, 151 dependencies, không có dependency cycle).
- Worktree hiện có các thay đổi từ tác vụ cố định sidebar trước đó; sẽ giữ nguyên và không ghi đè.

## Phương án kỹ thuật

Dùng Tailwind CSS v4 cho Next.js:

1. Cài `tailwindcss`, `@tailwindcss/postcss` và cấu hình PostCSS cho `apps/web`.
2. Thay stylesheet toàn cục bằng điểm nhập Tailwind, giữ lại chỉ các base styles thực sự toàn cục (font, root color tokens, reset và scrollbar nếu cần).
3. Đưa các pattern tái sử dụng vào component/shared class composition thay vì tái tạo CSS selector lớn. Không đưa logic nghiệp vụ vào utility classes.
4. Chuyển đổi theo thứ tự phụ thuộc để các màn hình dùng chung cùng một vocabulary layout:
   - App shell, private layout, navigation và workspace header.
   - Shared primitives: data table, filters, autocomplete, charts và summary strip.
   - Feature screens: dashboard, expenses, debts, contacts, calendar, tasks, reminders, settings.
   - Public/legal pages và dark-mode compatibility.
5. Xóa các CSS selector đã được thay thế từng phần. Sau khi mọi JSX đã chuyển sang utility classes, thu gọn `styles.css` chỉ còn base layer cần thiết.

## Tài liệu cần đồng bộ

- Cập nhật `.agents/knowledge/global/web-ui-direction.md` (English): Tailwind là styling layer chuẩn của web app, quy tắc responsive và shared UI responsibilities.
- Cập nhật `.agents/docs/global/web-ui-direction.md` (Vietnamese): hướng dẫn phát triển UI bằng utility classes và các quy tắc không được hồi quy.
- Cập nhật `.agents/docs/README.md` nếu mapping/hướng dẫn chung cần bổ sung.

## Xác minh

- Chạy `npm run lint`, `npm run typecheck`, `npm run build:web`.
- Kiểm tra thủ công các route private, một public page, desktop và breakpoint `<= 960px` để xác nhận navigation, scroll container, table overflow, form focus và dark mode.
- Chạy `git diff --check` và kiểm tra không còn stylesheet legacy không sử dụng.

## Rủi ro và cách giảm thiểu

| Rủi ro                                                             | Giảm thiểu                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Thay đổi visual lớn vì 2.779 dòng CSS được dùng bởi nhiều màn hình | Di chuyển theo shared primitives trước, xác minh từng cụm route trước khi xóa selector cũ.      |
| Utility classes làm JSX khó đọc                                    | Tách các phần lặp lại thành shared UI component hoặc dùng class composition có tên rõ ràng.     |
| Hồi quy dark mode, focus state hoặc mobile drawer                  | Kiểm tra riêng light/dark và desktop/mobile; giữ semantic HTML, ARIA và focus-visible hiện hữu. |
| Cài dependency cần tải package từ npm                              | Chỉ cài trong Phase 2 sau khi kế hoạch được duyệt; báo rõ nếu môi trường không cho phép tải.    |

## Tiêu chí hoàn thành

- Toàn bộ UI trong `apps/web` dùng Tailwind CSS làm hệ thống styling chính.
- Không còn component nào phụ thuộc vào selector legacy đã bị thay thế.
- Hành vi và cấu trúc thông tin hiện hữu được giữ nguyên, gồm desktop sidebar/main scroll, mobile drawer, bảng dữ liệu, form và dark mode.
- Lint, typecheck và build web đều đạt; knowledge và developer docs đã đồng bộ.

## Kết quả thực hiện (đợt 1)

- Đã cài Tailwind CSS v4 và `@tailwindcss/postcss` cho `@zalobot/web`, thêm `apps/web/postcss.config.mjs` và kích hoạt Tailwind trong stylesheet chính.
- Đã chuyển sang utility classes: private app shell (gồm scroll container desktop), desktop sidebar/mobile drawer, workspace header, period toolbar, và toàn bộ public/legal pages.
- Đã giữ nguyên stylesheet legacy cho shared data table và các feature screen chưa được chuyển đổi để không làm thay đổi UI nghiệp vụ trong cùng đợt.
- Đã cập nhật knowledge và developer documentation để Tailwind là chuẩn cho UI mới/migrated, không thêm selector legacy mới.

## Xác minh (đợt 1)

- `npm run lint --workspace @zalobot/web`: thành công.
- `npm run typecheck --workspace @zalobot/web`: thành công.
- `npm run build --workspace @zalobot/web -- --webpack`: thành công.
- `next build` mặc định với Turbopack bị giới hạn bởi môi trường thực thi khi PostCSS/Tailwind tạo tiến trình nội bộ (`Operation not permitted`); Webpack build đã xác minh quá trình biên dịch đầy đủ.

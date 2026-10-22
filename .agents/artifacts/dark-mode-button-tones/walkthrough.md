# Walkthrough: Hài hoà màu button ở dark mode

Plan đã duyệt: phương án xanh sky cho nút chính.

## Đã làm

- **Nút chính (~33 chỗ)**: `dark:bg-slate-100 dark:text-slate-900` → `dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500`.
- **Trạng thái đang chọn (5 chỗ)**: ô menu đang mở và nút ngôn ngữ trong sheet "Thêm", link sidebar đang mở, 2 toggle ở Analytics → `dark:border-slate-600 dark:bg-slate-700 dark:text-white`.
- **Toast (10 chỗ)**: `dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`.
- **Nút Đăng xuất** trong sheet "Thêm": thêm `dark:!bg-rose-950/40`, viền `dark:border-rose-800`.
- Giữ nguyên: light mode, nút phụ, vạch chỉ báo 2px của tab bar.
- Cách làm: đổi đúng chuỗi class `dark:` trên từng dòng bị ảnh hưởng. Không tạo abstraction mới.

## Kiểm tra

- `npm run typecheck --workspace @zalobot/web`: pass.
- `npm run lint --workspace @zalobot/web`: pass.
- `grep`: không còn `dark:bg-slate-100` ngoài vạch chỉ báo tab bar.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- **Chưa kiểm tra bằng mắt**: dev server không khởi động được trong preview (macOS chặn quyền `~/Documents`, lỗi `EPERM uv_cwd`).

## Tài liệu

- `global/web-ui-direction.md` (knowledge EN + docs VI): thêm quy tắc màu nút ở dark mode.
- 8 module (auth, calendar, contacts, dashboard, debts, expenses, settings, users): thêm mục "Dark-mode buttons" / "Màu nút ở dark mode".

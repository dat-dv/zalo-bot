# Walkthrough: Mã đăng nhập dashboard chỉ gồm chữ số

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Anh đã chốt: mã bot sinh ra gồm 8 chữ số, `DASHBOARD_LOGIN_CODE` tối thiểu 6 chữ số.

## Đã thay đổi

- **Contracts** (`packages/contracts/src/index.ts`):
  - Bỏ `DASHBOARD_ACCESS_CODE_ALPHABET`. Thêm `DASHBOARD_ACCESS_CODE_MAX_LENGTH = 32`.
  - `isDashboardAccessCode` chấp nhận chuỗi chữ số bất kỳ độ dài (≤ 32). `normalizeDashboardAccessCode` chỉ bỏ dấu `-` và khoảng trắng.
  - i18n vi/en: bỏ cụm "8 ký tự", placeholder đổi thành `12345678`, xoá key `auth.accessCode.invalidFormat`.
- **Web** (`access-code-form.tsx`):
  - Ô nhập chỉ giữ chữ số và dùng `inputMode="numeric"`.
  - Không còn kiểm tra định dạng hay độ dài. Nút bị khoá khi ô trống.
- **API**:
  - `dashboard-access-code.ts`: sinh 8 chữ số bằng `crypto.randomInt(10)`. `DASHBOARD_ACCESS_CODE_LENGTH` chuyển từ contracts về đây.
  - DTO: `MaxLength(DASHBOARD_ACCESS_CODE_MAX_LENGTH)`.
  - `env.validator.ts`: `DASHBOARD_LOGIN_CODE` phải toàn số và có ≥ 6 chữ số. Giá trị có ký tự nhưng chuẩn hoá ra rỗng (vd `--`) cũng bị báo lỗi.
  - Sửa comment rate limiter. Cập nhật 3 file spec.
- **Tài liệu**: knowledge (EN) và docs (VI) cho `dashboard-session`, `environment-guard`, `zalo-command-intake`, `modules/auth`, cùng docs `pwa`. Sửa comment trong `.env.example`.

## Kiểm tra đã chạy

- `npm run build --workspace @zalobot/contracts` (dist cũ làm web typecheck lỗi ở phần reminders không liên quan), rồi `npm run typecheck`: pass.
- `npm run lint`: exit 0.
- `npm run test --workspace @zalobot/api`: 594/594 pass.
- `npm run test --workspace @zalobot/web`: 116/116 pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm tra

- Chưa thử thủ công trên trình duyệt (nhập `893091`, dán `1234-5678`).

## Lưu ý deploy

- `DASHBOARD_LOGIN_CODE` trên server phải toàn số và có ≥ 6 chữ số, nếu không API sẽ không khởi động.
- Mã 1 lần dạng chữ còn hạn lúc deploy sẽ không dùng được nữa. Nhắn "dashboard" lại để lấy mã mới.

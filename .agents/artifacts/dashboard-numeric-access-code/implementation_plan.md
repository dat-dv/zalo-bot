# Kế hoạch: Mã đăng nhập dashboard chỉ gồm chữ số

- Route: `implement` | Authority (Phase 1): `inspect-and-plan`
- Rủi ro: **MEDIUM** (sửa contracts, API, bot, web; đụng luồng xác thực)

## Bối cảnh

Ô "Mã đăng nhập" đang báo `Mã gồm 8 ký tự chữ và số.` khi nhập `893091`. Kiểm tra code cho thấy định dạng 8 ký tự Crockford base32 (`0-9A-Z` bỏ `I L O U`) được áp ở **mọi tầng**, không riêng frontend:

| Nơi | Hành vi hiện tại |
| --- | --- |
| `packages/contracts/src/index.ts` (`isDashboardAccessCode`) | Bắt đúng 8 ký tự trong `DASHBOARD_ACCESS_CODE_ALPHABET` |
| `apps/web/.../access-code-form.tsx` | Chặn submit, hiện lỗi `invalidFormat` |
| `apps/api/src/reports/dashboard-access-code.ts` (`hashDashboardAccessCode`) | Mã sai định dạng → `null` → API trả 401 |
| `apps/api/src/config/env.validator.ts` | `DASHBOARD_LOGIN_CODE` sai định dạng → API không khởi động |
| `dashboard-tool.strategy.ts` | Bot gửi mã 1 lần dạng `K7P2-QX9M` |

Anh đã chọn: **toàn bộ mã là số**. Frontend chỉ nhận số và không kiểm tra độ dài.

## Thay đổi

### 1. Contracts: `packages/contracts/src/index.ts`
- Bỏ `DASHBOARD_ACCESS_CODE_ALPHABET`. Giữ `DASHBOARD_ACCESS_CODE_LENGTH = 8`, giờ chỉ dùng cho độ dài mã bot sinh ra.
- Thêm `DASHBOARD_ACCESS_CODE_MAX_LENGTH = 32` để chặn input quá dài ở API.
- `normalizeDashboardAccessCode`: bỏ khoảng trắng và dấu gạch, không cần uppercase nữa.
- `isDashboardAccessCode`: đúng khi chuỗi không rỗng, chỉ gồm `0-9` và dài tối đa `MAX_LENGTH`. Không ép độ dài cố định.
- i18n (vi + en):
  - `auth.accessCode.desc`: bỏ cụm "8 ký tự".
  - `auth.accessCode.placeholder`: `VD: 12345678`.
  - Xoá key `auth.accessCode.invalidFormat`.

### 2. Web: `apps/web/src/modules/auth/presentation/components/access-code-form.tsx`
- `onChange` chỉ giữ chữ số (`replace(/\D/g, '')`), nên dán `1234-5678` vẫn ra `12345678`.
- Input dùng `inputMode="numeric"` (bàn phím số trên điện thoại). Bỏ `autoCapitalize`/`uppercase`.
- Bỏ kiểm tra định dạng và trạng thái lỗi `invalidFormat`. Nút "Đăng nhập" bị disable khi ô trống. Mọi kiểm tra còn lại để backend quyết định (sai mã → `rejected`).

### 3. API
- `dashboard-access-code.ts`: sinh mã **8 chữ số** bằng `crypto.randomInt(0, 10)` (phân bố đều). `formatDashboardAccessCode` vẫn chia đôi: `1234-5678`.
- `dto/dashboard-access-code.dto.ts`: sửa mô tả ví dụ, `@MaxLength(DASHBOARD_ACCESS_CODE_MAX_LENGTH)`.
- `config/env.validator.ts`: `DASHBOARD_LOGIN_CODE` phải chỉ gồm chữ số (cho phép khoảng trắng/gạch) và dài **tối thiểu 6 chữ số** (xem điểm cần quyết định bên dưới).
- `access-code-rate-limiter.ts`: sửa comment "8-character code".
- Cập nhật spec: `dashboard-access-code.spec.ts`, `env.validator.spec.ts`, `reports-token.service.spec.ts` (nếu dùng mã chữ).

### 4. Bot: `apps/api/src/zca/text/strategies/dashboard-tool.strategy.ts`
- Không đổi logic. Tin trả lời tự hiển thị mã mới dạng `1234-5678`.

### 5. Tài liệu (Hard Completion Gate)
- Knowledge (EN): `global/dashboard-session.md` (định dạng mã, mã cố định), `global/environment-guard.md`, `modules/auth/README.md`, `global/zalo-command-intake.md` (nếu có nhắc định dạng mã).
- Docs (VI): các file tương ứng dưới `.agents/docs/`.
- `.env.example`: thêm comment định dạng `DASHBOARD_LOGIN_CODE` (chỉ số).

## Điểm cần anh quyết định

1. **Độ dài mã 1 lần bot sinh ra**: đề xuất **8 chữ số**. Mã 6 chữ số dễ gõ hơn nhưng yếu hơn 100 lần (1 triệu so với 100 triệu khả năng). Rate limit toàn hệ thống là 200 lần/15 phút, mã sống 20 phút.
2. **Độ dài tối thiểu của `DASHBOARD_LOGIN_CODE`** (chỉ kiểm tra ở backend khi khởi động, frontend không biết): đề xuất **≥ 6 chữ số**, `893091` vẫn hợp lệ. Mã cố định không bao giờ hết hạn. Với rate limit 200 lần/15 phút, mã 6 số có thể bị dò ra trong khoảng vài tuần nếu bị tấn công liên tục. Nên dùng mã dài hơn (10–12 số). Nếu anh muốn bỏ hẳn giới hạn này thì báo em.

## Rủi ro & lưu ý triển khai

- **Phá vỡ tương thích**: nếu `DASHBOARD_LOGIN_CODE` trên server (Coolify) đang có chữ cái, API sẽ **không khởi động** sau khi deploy. Cần đổi env sang toàn số trước khi deploy.
- Mã 1 lần cũ (dạng chữ) còn hạn lúc deploy sẽ không dùng được nữa. Chúng chỉ sống 20 phút, nên chỉ cần nhắn "dashboard" lại để lấy mã mới.
- Không đổi schema DB (`code_hash` vẫn là SHA-256 của mã đã chuẩn hoá).

## Kiểm tra

- `npm run typecheck`
- `npm run lint --workspace @zalobot/api` và `--workspace @zalobot/web`
- `npm run test --workspace @zalobot/api`
- `node .claude/hooks/docs-drift-check.mjs`
- Thử thủ công: nhập `893091` trên form; dán `1234-5678`; gõ chữ thì không ăn.

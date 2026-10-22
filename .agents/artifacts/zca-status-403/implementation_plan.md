# Implementation plan: Trang `/zca` báo "chỉ dành cho admin" khi API trả 403

Ngày: 2026-10-22 · Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM-thấp** (nhiều file, chỉ đổi giao diện; không đổi API, schema hay phân quyền)

Chẩn đoán gốc: [diagnosis.md](diagnosis.md)

## Mục tiêu

Hiện tại, một user không phải admin vẫn mở được trang **Zalo & Người dùng**. Trang không báo gì: thẻ trạng thái trống, danh sách rỗng hoặc báo "Chưa có cuộc trò chuyện…", còn lỗi 403 chỉ hiện trong DevTools.

Sau khi sửa:

- Khi `GET /api/zca/status` trả **403**, trang `/zca` thay toàn bộ nội dung bằng một khung thông báo:
  - Tiêu đề: **"Trang này chỉ dành cho admin"**
  - Nội dung: "Tài khoản bạn đang đăng nhập dashboard chưa có quyền admin. Hãy nhờ admin cấp quyền hoặc đăng nhập bằng tài khoản admin."
  - Một link **"Về trang tổng quan"** (`APP_ROUTES.home`)
- Status query không retry khi gặp 403, để thông báo hiện ngay, không chờ thêm một vòng retry.
- Admin vẫn thấy trang như cũ.

## Không làm (ngoài phạm vi)

- Không đổi API hay phân quyền: 401/403 giữ nguyên.
- Không ẩn mục menu "Zalo & Người dùng" với user thường, vì web chưa có tín hiệu "tôi là admin" tập trung. Nếu anh muốn thì làm ở task sau.
- Không sửa trang `/zca/thread?id=…` (cũng admin-only). Nếu anh muốn có cùng hành vi thì em làm tiếp ở task sau.
- Lỗi status khác 403 (mạng, 500) giữ nguyên cách xử lý hiện tại.

## Các bước

### 1. `apps/web/src/modules/zca/api/zca-query.ts`

- `useZcaStatusQuery`: thêm `retry: (failureCount, error) => !isForbiddenError(error) && failureCount < 1`. Giữ mặc định 1 lần retry cho các lỗi khác, giống `useGoogleStorageAccountQuery` và `useUsersQuery`. `isForbiddenError` đã được import sẵn trong file.
- `useZcaThreadConfigsQuery` và `useGoogleDriveFolderLinkQuery` (đều admin-only): thêm cùng điều kiện retry, để user thường không phải chịu thêm request 403 thừa.

Lý do không chặn các query khác bằng `enabled: status thành công`: cách đó buộc admin chờ thêm một vòng request (status xong mới gọi tiếp). Mấy request 403 song song lúc mở trang không gây hại, và giờ cũng không retry nữa.

### 2. Component mới: `apps/web/src/modules/zca/presentation/components/zca-admin-only-notice.tsx`

- Component trình bày thuần, không gọi API. Dùng `useLocale()` để lấy chữ.
- Một `section` có viền và bo `rounded-[3px]` (giữ radius nhỏ như các panel hiện có). Gồm tiêu đề `h1`, đoạn mô tả `role="status"`, và `Link` tới `APP_ROUTES.home` (import từ `@zalobot/contracts`, không hardcode).
- Có màu cho dark mode giống `google-storage-account-panel.tsx`. Trên mobile chiếm hết chiều ngang, trên desktop giới hạn `max-w-3xl`.

### 3. `apps/web/src/modules/zca/view/zca-screen.tsx`

- Lấy thêm `error: statusError` từ `useZcaStatusQuery`.
- Tính `const isForbidden = isForbiddenError(statusError);` (import từ `../model/google-storage-account`).
- Đặt `if (isForbidden) return <ZcaAdminOnlyNotice />;` **sau mọi hook** và ngay trước `return` JSX chính, để không vi phạm rules of hooks.

### 4. i18n: `packages/contracts/src/index.ts` (cả catalog `vi` và `en`, đặt cạnh các key `zca.*`)

| Key | vi | en |
| --- | --- | --- |
| `zca.forbidden.title` | Trang này chỉ dành cho admin | This page is for admins only |
| `zca.forbidden.body` | Tài khoản bạn đang đăng nhập dashboard chưa có quyền admin. Hãy nhờ admin cấp quyền hoặc đăng nhập bằng tài khoản admin. | The account signed in to the dashboard is not an admin. Ask an admin to grant access or sign in with an admin account. |
| `zca.forbidden.backHome` | Về trang tổng quan | Back to overview |

### 5. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md`, mục "Web UI (`ZcaScreen`…)": ghi rằng khi status trả 403 thì màn hình chỉ hiện `ZcaAdminOnlyNotice`, và các query admin-only không retry khi gặp 403.
- `.agents/docs/modules/zca/README.md`: thêm mô tả cho `ZcaScreen`, đồng thời sửa mục **Xử lý sự cố** (dòng 287) thành "trang hiện thông báo *Trang này chỉ dành cho admin*…". Thêm `zca-admin-only-notice.tsx` vào `depends_on` nếu frontmatter liệt kê từng file.
- Chạy `node .claude/hooks/docs-drift-check.mjs` và yêu cầu exit 0.

## Kiểm tra

1. `npm run typecheck --workspace @zalobot/web` và `--workspace @zalobot/contracts`
2. `npm run lint --workspace @zalobot/web`
3. `npm run test --workspace @zalobot/web` (các test hiện có, gồm `isForbiddenError`)
4. `npm run build --workspace @zalobot/web` (static export)
5. Kiểm tra giao diện bằng dev server local:
   - Admin: trang `/zca` vẫn hiển thị đầy đủ.
   - Non-admin: chặn `GET /api/zca/status` cho trả 403 (nếu local có user thường thì đăng nhập bằng user đó; nếu không, giả lập 403 trong browser pane chỉ để kiểm tra, không sửa code), sau đó chụp màn hình khung thông báo ở desktop, mobile và dark mode.
   - Nếu không giả lập được non-admin, em sẽ báo rõ phần này chưa kiểm tra.

Em không thêm unit test mới. Logic mới chỉ là một điều kiện `isForbiddenError` (đã có test) cộng một component trình bày, và web hiện chưa có hạ tầng test render component.

## Rollback

Revert một commit: chỉ đụng giao diện web, chữ i18n và tài liệu, không có migration.

# Kế hoạch: Hiển thị tài khoản đang đăng nhập & ẩn menu chỉ dành cho admin

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM**: thêm 1 API đọc, đổi điều hướng dùng chung; không đổi DB, không đổi quyền phía API.
- Nguồn gốc: chẩn đoán `.agents/artifacts/google-storage-forbidden/diagnosis.md`. Anh gặp thông báo "chỉ admin" mà không biết phiên đang là ai.
- Skills: backend, backend-bridge-frontend, frontend-orchestration, tanstack-query, enterprise-ui

## 1. Hiện trạng

- `GET /api/dashboard` trả `user: { name: <ID thô>, isAdmin, googleConnected }`, nhưng web không hiển thị phần này. Endpoint còn nặng vì tải luôn tài chính, lịch, việc cần làm.
- Thanh bên luôn ghi "Cá nhân"; mục "Thêm" trên điện thoại cũng không có thông tin người dùng.
- Menu hiện "Zalo & Người dùng" và "Google Drive" cho mọi người. API của hai trang này chặn người không phải admin (`requireDashboardAdmin`), nên họ vào trang rồi mới gặp lỗi hoặc thông báo chặn.

## 2. Thiết kế

### 2.1 API: `GET API_ROUTES.sessionMe = '/api/me'`

Đặt trong `ReportsController`, xác thực bằng Bearer như các route dashboard khác (`getAccessUserId`). Endpoint nhẹ, chỉ trả danh tính:

```ts
// packages/contracts
export interface IDashboardSessionUser {
  id: string;                 // users.id của phiên
  name: string | null;        // tên Zalo; null nếu chưa biết
  avatarUrl: string | null;
  isAdmin: boolean;
  isDashboardOwner: boolean;  // đăng nhập bằng DASHBOARD_LOGIN_CODE
}
```

Thêm `UsersService.getSessionProfile(userId)`, chọn tên theo thứ tự ưu tiên:

1. `dashboard-owner` → `name: null`, `isDashboardOwner: true`. Web tự hiện nhãn i18n "Chủ hệ thống (mã đăng nhập)".
2. Danh bạ ZCA (`zcaService.getAvailableThreads(false)`, đọc cache Redis, không gọi Zalo): `alias || name || displayName`. Đây cũng là cách `getUsers()` đang dùng trên `/zca`.
3. `users.firstName`.
4. `null`: web hiện "Chưa rõ tên", vẫn kèm ID.

`avatarUrl`: `users.avatarUrl`, nếu trống thì lấy avatar trong danh bạ ZCA.

### 2.2 Web: dữ liệu phiên

- `modules/auth/api/session-user-api.ts`: `getSessionUser(signal)`.
- `modules/auth/api/session-user-query.ts`: `useSessionUserQuery()`, key `['session', 'me']`, `staleTime: 5 phút`, chỉ chạy khi có access token.
- Đăng nhập hoặc đăng xuất đã gọi `queryClient.clear()`, nên đổi tài khoản là dữ liệu phiên tự làm mới.

### 2.3 Web: hiển thị tài khoản

Component `SessionUserCard` (`modules/auth/presentation/components/session-user-card.tsx`) gồm:

- Ảnh đại diện (avatar, hoặc chữ cái đầu của tên nếu không có ảnh).
- Tên, cắt bớt nếu dài.
- ID dạng chữ nhỏ, có nút copy (`navigator.clipboard`; báo "Đã copy" trong 2 giây).
- Nhãn **Admin** (emerald) hoặc **Người dùng** (slate). Với `dashboard-owner` hiện "Chủ hệ thống".
- 4 trạng thái: đang tải (skeleton 1 dòng); lỗi (ẩn thẻ, không chặn menu); có dữ liệu; chưa đăng nhập (không render).

Vị trí:

| Màn hình | Vị trí |
| --- | --- |
| Máy tính (sidebar 210px) | Đầu phần footer của sidebar (trên nút giao diện sáng/tối), ngăn cách bằng `border-t` như hiện tại |
| Điện thoại / tablet (≤960px) | Đầu sheet "Thêm" (trên danh sách mục), mỗi vùng chạm cao 40px |

Giữ `rounded-[3px]`. Chữ "Cá nhân" dưới logo giữ nguyên.

### 2.4 Web: ẩn mục chỉ dành cho admin

- `NavItem` thêm `adminOnly?: boolean`; đánh dấu `zca` và `googleStorage`.
- Hàm thuần `visibleNavSections(sections, isAdmin)`: bỏ các mục `adminOnly` khi `isAdmin !== true`, và bỏ cả nhóm nếu nhóm không còn mục nào (nhóm HỆ THỐNG vẫn còn "Cài đặt").
- **Quy tắc hiển thị**: chỉ hiện mục admin khi đã xác nhận `isAdmin === true`. Trong lúc đang tải, hoặc khi API lỗi, thì ẩn.
  - Hệ quả: admin tải lại hẳn trang (F5) sẽ thấy hai mục này hiện ra sau khoảng một nhịp tải. Chuyển trang trong app thì không bị, vì dữ liệu đã cache 5 phút.
- Áp dụng cho cả sidebar và sheet "Thêm". Tab bar dưới cùng (Tổng quan, Thu chi, Vay, Lịch) không có mục admin nên không đổi.
- Ẩn menu chỉ để gọn giao diện; **quyền vẫn do API chặn** (`requireDashboardAdmin`). Người không phải admin gõ thẳng URL thì vẫn gặp màn hình chặn như hiện nay.

### 2.5 i18n (vi/en, `@zalobot/contracts`)

`session.title` ("Đang đăng nhập"), `session.owner` ("Chủ hệ thống (mã đăng nhập)"), `session.unknownName` ("Chưa rõ tên"), `session.roleAdmin`, `session.roleUser`, `session.copyId`, `session.copied`.

## 3. Tests

- API: spec cho `UsersService.getSessionProfile`: owner; tên lấy từ danh bạ ZCA; fallback `firstName`; fallback null; admin và không phải admin.
- API: spec cho `ReportsController.me`: trả đúng shape; không có token thì 401.
- Web: spec cho `visibleNavSections`: admin thấy đủ; không phải admin mất `zca` và `googleStorage`, nhóm HỆ THỐNG còn "Cài đặt"; `isAdmin` undefined thì ẩn.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build --workspace @zalobot/web`. Thử trên trình duyệt nếu có môi trường chạy được, nếu không thì ghi rõ là chưa kiểm tra.

## 4. Tài liệu

- `.agents/knowledge/global/dashboard-session.md` (EN) và `.agents/docs/global/dashboard-session.md` (VI): endpoint `/api/me`, thứ tự chọn tên, thẻ tài khoản, quy tắc ẩn menu admin (chỉ là UI, quyền ở API).
- `.agents/knowledge/project-overview.md`: ghi chú `/zca` và `/google-storage` chỉ hiện trong menu với admin.
- Chạy `node .claude/hooks/docs-drift-check.mjs` (phải exit 0).

## 5. Ngoài phạm vi

- Không đổi `GET /api/dashboard` (vẫn trả `user` như cũ).
- Không thêm chức năng chuyển tài khoản trong thẻ; đăng xuất vẫn dùng nút hiện có.
- Không chặn route phía web; không đổi quyền phía API.

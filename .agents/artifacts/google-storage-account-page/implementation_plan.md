# Kế hoạch: Trang riêng cho tài khoản Google Drive lưu trữ

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM** (thêm route + mục điều hướng mới, chuyển UI; backend giữ nguyên)
- Kế thừa: `.agents/artifacts/google-storage-account-panel/` (commit `d7f600b`, đã có API và thẻ `GoogleStorageAccountCard` trên `/zca`)
- Skills: frontend-orchestration, nextjs-static, tanstack-query, enterprise-ui

## 1. Mục tiêu

Tài khoản Google lưu trữ có **trang riêng** trong nhóm **HỆ THỐNG** của menu, thay vì nằm chung trong trang Zalo & Người dùng.

## 2. Thiết kế

### 2.1 Route & điều hướng

| Mục | Giá trị đề xuất |
| --- | --- |
| Đường dẫn | `APP_ROUTES.googleStorage = '/google-storage'` (`apps/web/app/(private)/google-storage/page.tsx`) |
| Nhãn menu | `nav.googleStorage`: vi "Google Drive" / en "Google Drive" |
| Vị trí | Nhóm HỆ THỐNG: Zalo & Người dùng → **Google Drive** → Cài đặt |
| Icon | `NavigationIcon` mới `'drive'` (SVG nét giống các icon khác) |
| Tiêu đề trên topbar | Thêm vào bảng route trong `workspace-header.tsx`: `googleStorage.title` / `googleStorage.subtitle` |
| Mobile | Không ghim vào tab bar; nằm trong mục "Thêm" như `/zca`, `/settings` |

### 2.2 Nội dung trang (`modules/zca/view/google-storage-screen.tsx`)

Trang dùng lại API và hook có sẵn (`useGoogleStorageAccountQuery`, mutation đăng nhập/đăng xuất). Không thêm endpoint.

1. **Khối tài khoản**: logic hiện tại của `GoogleStorageAccountCard`, trình bày rộng hơn.
   - Hiện đủ 4 trạng thái UI: đang tải, lỗi kèm nút Thử lại, chưa kết nối, đã kết nối.
   - Hiện email, trạng thái quyền Drive/Photos và các nút Đăng nhập / Đổi tài khoản / Cấp lại quyền / Đăng xuất.
   - API trả **403** (người không phải admin): hiện "Chỉ admin xem được trang này" thay vì lỗi chung.
2. **Lối tắt**: nút **Mở thư mục `zalobot` trên Drive** (`useGoogleDriveFolderLinkQuery` / `getThreadDriveOpenUrl()`), chỉ hiện khi đã kết nối và đủ quyền.
3. **Khối "Cách hoạt động"**: 3–4 dòng tĩnh (i18n), giải thích:
   - Media của mọi kênh lưu vào tài khoản này, theo thư mục `zalobot/<channelId>/…`.
   - Đổi tài khoản thì media mới vào tài khoản mới; link cũ vẫn có trong lịch sử của từng kênh.
   - Đăng xuất thì bot ngừng lưu lên Google; file cũ giữ nguyên; kết nối Google cá nhân của admin giữ token cũng bị ngắt.

Bố cục: một cột, rộng tối đa khoảng `max-w-3xl`. Trên điện thoại các nút chiếm cả hàng, cao 40px. Giữ `rounded-[3px]`.

### 2.3 Trang `/zca`

Bỏ `GoogleStorageAccountCard` khỏi `ZcaScreen` (đề xuất). Xem Q2 cho phương án giữ một dòng tóm tắt có link sang trang mới.

### 2.4 Tách component

- Đổi `GoogleStorageAccountCard` thành `GoogleStorageAccountPanel` (organism, vẫn ở `modules/zca/presentation/components/`) với bố cục trang. Không giữ hai bản song song.
- Thêm `presentation/components/google-storage-how-it-works.tsx` (khối tĩnh).
- Chuỗi mới: `nav.googleStorage`, `googleStorage.title|subtitle|forbidden|openRoot|howItWorks.*` (vi/en) trong `@zalobot/contracts`. Tái dùng các key `zca.googleAccount.*` đã có.

## 3. Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build --workspace @zalobot/web`. Build phải xuất ra `/google-storage` dạng trang tĩnh.
- Thêm test cho hàm thuần (nếu có), ví dụ chọn nhãn nút theo trạng thái tài khoản.
- Trình duyệt: hiện chưa chạy được (preview bị `EPERM`, API local chạy code cũ). Nếu lúc làm vẫn vậy thì ghi rõ là chưa kiểm tra.

## 4. Tài liệu

- `.agents/knowledge/project-overview.md`: thêm `/google-storage` vào danh sách trang.
- `knowledge/modules/zca/channel-storage.md` (EN) và `docs/modules/zca/channel-storage.md` (VI): mục Web UI và mục 2.1b đổi sang trang mới.
- Chạy `node .claude/hooks/docs-drift-check.mjs` (phải exit 0).

## 5. Ngoài phạm vi

- Không đổi API hay hành vi đăng nhập/đăng xuất.
- Không thêm danh sách kênh/dung lượng Drive (cần API mới; làm sau nếu anh muốn).

## 6. Câu hỏi mở

- **Q1 – Đường dẫn & tên**: `/google-storage` với nhãn "Google Drive" (đề xuất), hay tên khác, ví dụ "Lưu trữ Google", `/storage`?
- **Q2 – Trang `/zca`**: bỏ hẳn thẻ (đề xuất), hay giữ một dòng tóm tắt "Google: email@… · Quản lý →" dẫn sang trang mới?

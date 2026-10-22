# Kế hoạch: Sửa 5 góp ý về trải nghiệm iPhone / PWA

- Route: `implement`, Phase 1 (Planning), Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM**. Chạm các phần dùng chung (`styles.css`, `IosViewportFix`, `Modal`, `AppNavigation`) và màn ZCA. Không đổi API/DB.
- Skills: `enterprise-ui`, `frontend-orchestration`, `nextjs-static`
- Trạng thái: **chờ duyệt**, chưa sửa code.

## 1. Góp ý và nguyên nhân (đã kiểm trong code)

| # | Góp ý | Nguyên nhân |
|---|---|---|
| 1 | Trên iPhone (PWA), chạm vào ô nhập thì trang bị zoom | iOS tự zoom khi ô nhập có chữ < 16px. Hiện app chặn bằng `IosViewportFix` (chèn `maximum-scale=1` sau khi hydrate). Cách này không chắc chắn: thẻ `viewport` do Next quản lý có thể bị ghi lại, và trong app đã cài vẫn zoom như anh thấy. Ô nhập của app đang dùng chữ 11–13px. |
| 2 | Nút "Làm mới", "Đăng xuất ZCA" to và bị rớt dòng | Ở `zca-screen.tsx`, hàng header gồm nhãn "Cập nhật lúc …" + 2 nút có chữ, đều cao 40px, cùng `flex-wrap` trên 375px, nên rớt thành nhiều dòng. Trên topbar cũng đã có nút ↻. |
| 3 | Sheet trượt lên chưa có cảm giác "trượt" như app mobile | Đang dùng CSS `@starting-style`, 200ms `ease-out`: quá nhanh, đường cong không giống iOS. Safari dưới 17.5 bỏ qua hoàn toàn nên không có hiệu ứng. |
| 4 | Bấm menu thì nav hiện ra nửa màn hình và có thanh cuộn bên trong | Drawer trái rộng 280px, liệt kê dọc 11 mục + 5 tiêu đề nhóm + đăng xuất/giao diện/ngôn ngữ, nên phải cuộn. Ngoài ra topbar có nút ☰ trùng chức năng với tab "Thêm". |
| 5 | Nút "Đồng bộ thông tin", "Kho Google Drive" bo tròn quá | Chúng dùng `rounded-lg` (8px). Trong `apps/web` còn 63 chỗ `rounded-lg`, 3 chỗ `rounded-2xl`, 1 chỗ `rounded-xl`, tập trung ở ZCA (`zca-screen`, `sync-media-modal`, thread config) và dialog users. Một số badge đếm dạng pill `rounded-full`. Phần còn lại của app dùng `rounded-[3px]`/`rounded`. |

## 2. Các bước

### Bước 1: Hết zoom khi chạm ô nhập (góp ý 1, Q1)
- `styles.css`: chỉ trên thiết bị cảm ứng (`@media (hover: none) and (pointer: coarse)`), `input`, `select`, `textarea` dùng chữ **16px**. Cần `!important` để thắng các class `text-xs` của Tailwind. Ô nhập trên điện thoại đã cao 40px nên chữ 16px vẫn vừa.
- Desktop vẫn giữ chữ 11–13px.
- Giữ `IosViewportFix` làm lớp phòng hờ.
- Cập nhật knowledge/docs: trước đây ghi "không tăng chữ input lên 16px"; nay đổi thành 16px trên màn cảm ứng.

### Bước 2: Header trang ZCA gọn một dòng (góp ý 2)
- Trên điện thoại, header thành **một hàng không rớt dòng**:
  - Bên trái: "Cập nhật lúc …", chữ nhỏ, tự cắt nếu dài.
  - Bên phải: nút **↻ chỉ có icon** 40×40 (`aria-label` "Làm mới danh bạ Zalo"), và nút **"Đăng xuất"** viết ngắn, cao 40px, viền đỏ nhạt.
- Desktop giữ nguyên.

### Bước 3: Hiệu ứng trượt như app iOS (góp ý 3)
- Bỏ `@starting-style` và chuyển sang **Web Animations API** (`element.animate`), chạy được trên mọi iOS từ 13.4.
  - **Mở**: sheet trượt từ dưới lên trong **380ms**, đường cong kiểu iOS `cubic-bezier(0.32, 0.72, 0, 1)` (nhanh lúc đầu, chậm êm lúc cuối). Nền mờ hiện dần cùng lúc.
  - **Đóng**: trượt xuống trong 260ms.
  - **Desktop**: mờ dần + phóng nhẹ (200ms).
- **Vuốt**: khi thả tay, sheet đi tiếp từ vị trí ngón tay với cùng đường cong, thay vì đứng lại rồi mới đóng.
- Vẫn tắt hiệu ứng khi máy bật "Giảm chuyển động".

### Bước 4: Menu "Thêm" thành sheet toàn màn hình dạng lưới (góp ý 4, Q2)
- Thay drawer trái bằng **một sheet trượt từ dưới lên, gần full màn hình**. Dùng chung `Modal`, nên có sẵn hiệu ứng ở bước 3, vuốt xuống để đóng, khoá cuộn nền và Escape.
- **Nội dung dạng lưới 3 cột**: mỗi ô là icon 24px + nhãn, cao khoảng 72px, ô trang hiện tại được tô sáng. Vẫn giữ 5 nhóm (Tổng quan, Tài chính, Kế hoạch, Dữ liệu, Hệ thống) với tiêu đề nhỏ.
- **Chân sheet**: giao diện sáng/tối và ngôn ngữ trên một hàng, nút Đăng xuất ở dưới cùng.
- **Không phải cuộn** trên iPhone 12–16 (cao 844px trở lên). Trên iPhone SE (667px) có thể cuộn nhẹ, và cả sheet cuộn chứ không có hộp cuộn lồng bên trong.
- **Q2 (đề xuất)**: bỏ nút ☰ trên topbar ở màn hẹp, chỉ mở menu qua tab "Thêm" như app iOS/Android. Topbar còn: tên trang | ẩn/hiện số tiền | làm mới.
- Desktop vẫn giữ sidebar như cũ.

### Bước 5: Bo góc nhỏ thống nhất (góp ý 5, Q3)
- **Q3 (đề xuất)**: trong các trang dashboard (`apps/web/src` + `app/(private)`), đổi `rounded-lg`, `rounded-xl`, `rounded-2xl` của **nút, link dạng nút, ô nhập, thẻ (card) và dialog** về `rounded-[3px]`/`rounded`. Đổi luôn các badge đếm dạng pill `rounded-full` về `rounded-[2px]`.
- **Giữ `rounded-full`** cho avatar, chấm trạng thái, công tắc bật/tắt, vòng quay tải.
- **Không đụng** các trang public (`/about`, `/privacy`, `/terms`) và phần cong trên của bottom sheet.
- Ghi quy tắc vào `web-ui-direction`: nút/thẻ/dialog tối đa `rounded` (4px).

### Bước 6: Bộ chuyển động cho mobile (góp ý thêm, Q4)

Nguyên tắc chung:
- Ngắn: 150–300ms, cùng đường cong kiểu iOS `cubic-bezier(0.32, 0.72, 0, 1)` như bước 3.
- Chỉ dùng `transform`/`opacity` để không giật.
- Chỉ chạy ở màn hẹp, desktop không đổi.
- Tắt hết khi máy bật "Giảm chuyển động".
- Không thêm thư viện: dùng CSS + Web Animations API.
- Gom các thông số vào một file `src/shared/ui/motion.ts` (thời lượng, đường cong, keyframes), để mọi chỗ chuyển động giống nhau.

| # | Hiệu ứng | Cảm giác |
|---|---|---|
| a | **Chuyển tab/trang**: nội dung trang mới hiện mờ dần và trượt lên 8px (220ms) | không còn "chớp" khi đổi tab |
| b | **Thanh tab**: chỉ báo tab đang chọn (vạch 2px trên đầu tab) **trượt ngang** sang tab mới; icon nảy nhẹ khi bấm (scale 0.9 → 1) | giống tab bar iOS/Android |
| c | **Danh sách lần đầu tải**: khoảng 10 dòng đầu hiện lần lượt (mờ dần + trượt lên 6px, mỗi dòng trễ 20ms); skeleton chuyển sang dữ liệu thật bằng mờ chéo | danh sách "chảy" vào thay vì bật ra |
| d | **Toast**: trượt lên từ đáy khi hiện, trượt xuống khi ẩn | thông báo có điểm vào/ra rõ ràng |
| e | **Thanh hành động dưới đáy** (Gộp, Thêm nơi chốn…) và **thanh cập nhật phiên bản**: trượt vào/ra thay vì bật tắt | không nhảy layout đột ngột |
| f | **Mở/đóng phần mở rộng** (biểu đồ trong dải tổng thu/chi, chi tiết trong sheet, ngày trong lịch): co giãn chiều cao mượt | không giật nội dung bên dưới |
| g | **Chip/tab lọc**: màu nền đổi mượt (150ms) khi chọn; nút có hiệu ứng nhấn thu nhỏ nhẹ (scale 0.97) thay cho chỉ mờ đi | phản hồi chạm rõ hơn |
| h | **Kéo để làm mới**: vòng ↻ xoay theo khoảng kéo và bật nảy lại khi thả | giống pull-to-refresh gốc |
| i | **Rung nhẹ** (Android, `navigator.vibrate(8)`) khi kéo qua ngưỡng làm mới hoặc ngưỡng vuốt đóng sheet. iOS không cho web rung nên bỏ qua. | xác nhận bằng xúc giác |

Hiệu ứng a dùng View Transitions API nếu trình duyệt hỗ trợ (Safari 18+, Chrome 111+). Không hỗ trợ thì dùng animation CSS khi trang mount. Cả hai cách đều không làm chậm điều hướng.

## 3. File dự kiến chạm

- **Dùng chung:** `src/styles.css`, `src/shared/ui/{modal,app-navigation,ios-viewport-fix}.tsx`, `src/shared/hooks/use-swipe-dismiss.ts`.
- **ZCA:** `src/modules/zca/view/{zca-screen,sync-media-modal,thread-config-screen}.tsx`, `src/modules/zca/presentation/components/**`.
- **Users:** `src/modules/users/presentation/components/*.tsx`.
- **Badge/bo góc lẻ:** vài file dashboard/contacts/calendar/auth.
- **i18n:** `nav.moreTitle`, `zca.refreshDirectory` (vi + en).
- **Docs:** `web-ui-direction` (EN + VI), docs các module `zca`, `users`.

## 4. Kiểm tra

- Tự động: typecheck, lint, test, build.
- Trên prod (Coolify tự deploy khi push lên `main`), khổ 375px:
  - Header ZCA còn 1 dòng.
  - Menu "Thêm" dạng lưới, không có hộp cuộn lồng.
  - Không còn nút bo tròn lớn (đo bằng script quét `border-radius` > 4px trên nút/thẻ).
  - Hiệu ứng sheet chạy đủ 380ms (kiểm bằng `getAnimations()`).
- **Cần anh thử trên iPhone thật**: chạm ô nhập không còn zoom, và cảm giác trượt/vuốt. Trình duyệt test của em không giả lập được hai việc này.

## 5. Câu hỏi cần anh chốt

- **Q1**: Ô nhập dùng chữ 16px trên màn cảm ứng để hết zoom (đề xuất, đây là cách chắc chắn duy nhất trên iOS)? Desktop không đổi.
- **Q2**: Bỏ nút ☰ trên topbar ở màn hẹp, menu chỉ mở qua tab "Thêm" (đề xuất)? Hay giữ cả hai?
- **Q3**: Thu nhỏ bo góc cho nút + ô nhập + thẻ + dialog + badge (đề xuất)? Hay chỉ nút?
- **Q4**: Làm cả 9 hiệu ứng a–i ở bước 6 (đề xuất)? Hay chỉ chọn một số? Nếu muốn bớt, nên giữ tối thiểu a, b, d, e, g vì đây là các chỗ người dùng chạm nhiều nhất.

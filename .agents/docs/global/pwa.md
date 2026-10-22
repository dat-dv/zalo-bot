---
metadata:
  agent-artifact:
    id: docs-global-pwa
    type: documentation
    depends_on:
      - .agents/knowledge/global/pwa.md
      - apps/web/app/manifest.ts
      - apps/web/public/sw.js
      - apps/web/public/offline.html
      - apps/web/nginx.conf
      - apps/web/src/shared/pwa
      - apps/web/src/shared/ui/pwa-status-stack.tsx
---

# Ứng dụng cài được (PWA)

Tài liệu này ánh xạ với tri thức canonical [`pwa.md`](../../knowledge/global/pwa.md).

## Vì sao làm PWA

Phần lớn người dùng mở dashboard trên điện thoại. PWA cho phép:

- Cài dashboard lên màn hình chính và mở toàn màn hình như một app.
- Vẫn mở được khung app khi mất mạng.
- Tự nhận bản mới sau mỗi lần deploy, không cần xoá cache.

Push notification **không** làm, vì lời nhắc đã gửi qua Zalo.

## Các thành phần

| Thành phần | Vai trò |
| --- | --- |
| `app/manifest.ts` | Sinh `/manifest.webmanifest`: tên, màu, icon (có bản maskable), lối tắt tới Thu chi, Vay & cho vay, Nhắc nhở. Dùng `APP_ROUTES`, không hardcode đường dẫn. |
| `public/sw.js` | Service worker tự viết, không thư viện. |
| `public/offline.html` | Trang hiện khi mất mạng mà trang cần mở chưa từng được lưu. |
| `src/shared/pwa/*` | Đăng ký service worker, bắt sự kiện cài app, theo dõi online/offline. |
| `src/shared/ui/pwa-status-stack.tsx` | Thông báo "Đang offline" và "Đã có phiên bản mới – Tải lại" ở giữa phía trên màn hình. |
| `InstallAppRow` (Settings → Tuỳ chọn) | Nơi duy nhất mời cài app. |
| `apps/web/nginx.conf` | Không cache `sw.js`, manifest và HTML (`no-cache`). `/_next/static/*` cache 1 năm `immutable` vì tên file có hash. Các file trong `public/` như favicon, icon, og-image cache 1 ngày, vì tên không đổi giữa các lần deploy. |

## Service worker cache gì

- **Trang (HTML)**: luôn lấy từ mạng trước và lưu bản mới nhất. Mất mạng thì mở bản đã lưu của trang đó; chưa có thì hiện `offline.html`.
- **`/_next/static/*`**: file đã có hash, không bao giờ đổi, nên lấy từ cache trước.
- **Ảnh, icon, font**: trả bản trong cache ngay, đồng thời tải bản mới ở nền.
- **Không bao giờ đụng tới**: `/api/*`, `/webhook`, `/zalo/`, `/oauth2callback`, request khác `GET` và request sang domain khác.
  - Lý do: dữ liệu tài chính phải luôn lấy từ server, và link đăng nhập `/api/access` cùng luồng OAuth phải tới server nguyên vẹn.

## Cập nhật phiên bản hoạt động thế nào

1. Service worker được đăng ký dạng `/sw.js?v=<version>`, trong đó `version` lấy từ `apps/web/package.json` và tăng sau mỗi commit. Version mới thì trình duyệt cài service worker mới.
2. Service worker mới cài xong sẽ **chờ**, không tự thay bản cũ. App hiện thẻ "Đã có phiên bản mới" ngay dưới header (trên điện thoại), có nút ✕ để ẩn tới lần tải trang sau vì thẻ che một phần đầu trang.
3. Người dùng bấm "Tải lại": app gửi `SKIP_WAITING`, service worker mới bật lên và trang tải lại đúng một lần. Cache của version cũ bị xoá.
   - Nếu người dùng không bấm, bản mới **tự áp dụng ở lần chuyển trang kế tiếp** (đổi pathname trong app). Đằng nào trang cũng đổi, nên tải lại lúc đó không làm mất gì: các form chỉ nằm trong một trang. Trang tải lại giữ đúng URL mới.
   - Trên màn hẹp, thông báo là một hàng cao 40px nằm ngay dưới topbar, trong luồng trang (`PwaUpdateBar`). Nó đẩy nội dung xuống chứ không đè lên thanh chọn kỳ hay các tab nữa.
4. Khi app quay lại foreground, nó tự kiểm tra bản mới, vì app đã cài thường để mở nhiều ngày.

Vì HTML luôn lấy từ mạng trước và nginx đặt `no-cache`, chỉ cần reload là người dùng có bản mới, kể cả khi chưa bấm "Tải lại".

## Cài app

- **Android/Chrome**: Settings → Tuỳ chọn → "Ứng dụng trên điện thoại" → nút **Cài ứng dụng**. App chặn thanh gợi ý cài mặc định của Chrome để không làm phiền.
- **iOS Safari**: không có nút cài tự động; dòng này hướng dẫn bấm Chia sẻ → "Thêm vào MH chính".
- **Trình duyệt trong Zalo**: không cài được; hướng dẫn mở bằng Safari hoặc Chrome.
- Đang chạy trong app đã cài thì hiện nhãn "Đã cài".

## Đăng nhập trong app đã cài

App đã cài trên iOS không dùng chung đăng nhập với Safari. Người dùng nhắn `dashboard` cho bot và nhập **mã 8 ký tự** trong tin trả lời. Xem [`dashboard-session.md`](dashboard-session.md).

## Kiểm tra trên máy dev

Service worker chỉ chạy ở bản build production, không chạy trong `npm run dev`.

1. `npm run build --workspace @zalobot/web`, rồi phục vụ thư mục `apps/web/out` trên `localhost`.
2. DevTools → Application: Manifest không có lỗi, icon maskable hiển thị đúng; Service Workers ở trạng thái `activated`.
3. Tắt server rồi điều hướng: trang đã mở thì hiện bản đã lưu, trang chưa mở thì hiện `offline.html`. Request `/api/*` báo lỗi mạng chứ không lấy từ cache.
4. Tăng `version` trong `apps/web/package.json`, build lại và mở lại tab: thẻ "Đã có phiên bản mới" xuất hiện; bấm "Tải lại" thì trang tải lại một lần.

## Xử lý sự cố

- **Người dùng kẹt ở bản cũ**: kiểm tra header `Cache-Control` của `/sw.js` (phải là `no-cache`) và version trong URL đăng ký. Prod đi qua Cloudflare, và Cloudflare đang đổi header của `/sw.js` thành `max-age=14400` (đo ngày 22/10/2026). Nếu cần cập nhật ngay, tạo Cache Rule trên Cloudflare để bỏ qua cache cho `/sw.js`, hoặc bật "Respect existing headers". Việc này làm trên dashboard Cloudflare, không nằm trong repo.
- **Đổi icon mà vẫn thấy icon cũ**: file trong `public/` được cache 1 ngày. Trước đây là 1 năm `immutable` nên không bao giờ tự đổi.
- **Cần gỡ khẩn cấp**: phát hành một `sw.js` tự huỷ đăng ký (`self.registration.unregister()`) và xoá các cache `zalobot-*`.
- **Kết nối Google trong app đã cài trên iOS không quay về app**: làm thao tác này trên trình duyệt.
- PWA cần HTTPS (domain production) hoặc `localhost`.
